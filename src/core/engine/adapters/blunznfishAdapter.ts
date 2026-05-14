/**
 * Blunznfish engine adapter — Fairy-Stockfish (ffish.js) powered variant-aware engine.
 *
 * Uses a custom-built ffish.js WASM that adds `mustCheck` support to
 * Fairy-Stockfish. This enables native forced-check enforcement: when a
 * checking move exists, only checking moves are returned as legal.
 *
 * Supported overlays via custom variant definitions in variants.ini:
 *   - mustCheck (forced-check rule) — ✅ native in blunznfish WASM
 *   - Atomic (blastOnCapture)       — ✅ native (must inherit from :chess, not :atomic)
 *   - Crazyhouse (piece drops)      — ✅ native
 *   - King of the Hill (flag)       — ✅ native
 *   - Chess960                      — ✅ native
 *   - Check counting (King Hunt)    — ✅ native
 *
 * Reverse Blunzinger (must avoid giving check) is NOT supported natively by
 * ffish. The app's authoritative rules in `core/blunzinger/` enforce that
 * mechanic. For Reverse mode, the engine provides standard chess move
 * generation and the app filters moves client-side.
 *
 * When ffish.js cannot be loaded (e.g. in test environments without WASM support),
 * the adapter gracefully falls back to heuristic analysis.
 *
 * IMPORTANT: This engine is **advisory only**. The app's authoritative rules
 * (violations, penalties, overlays) remain in `core/blunzinger/`.
 *
 * ## Updating the ffish WASM
 *
 * 1. Replace `public/ffish.js` and `public/ffish.wasm` with the new build files.
 * 2. Update `FFISH_WASM_VERSION` below to match the new version.
 * 3. Update `src/core/engine/ffish.d.ts` if the API changed.
 * 4. Run `npm test` to verify compatibility.
 */

import type {
  VariantEngineAdapter,
  EngineInfo,
  AnalyzePositionOptions,
  EngineLine,
} from '../types';
import type { FairyStockfish, FfishBoard } from '../ffish';
import { findBestMoveUci, heuristicAnalysis } from './shared';

/**
 * Current ffish WASM build version. Update this when replacing the WASM files
 * in public/ so the version is traceable.
 */
export const FFISH_WASM_VERSION = '0.1';

// ── Variant key resolution ───────────────────────────────────────────

/**
 * Resolves the ffish variant key from the app-level variantKey option.
 *
 * The variantKey is passed via AnalyzePositionOptions.variantKey and is
 * constructed by the caller based on the active MatchConfig overlays.
 *
 * Supported ffish variant keys with mustCheck (defined in public/variants.ini):
 *   - "chess"                       — standard chess (default, no mustCheck)
 *   - "blunzinger"                   — base Blunzinger (mustCheck = true)
 *   - "blunzinger_kinghunt"          — King Hunt with check counting + mustCheck
 *   - "blunzinger_koth"              — King of the Hill + mustCheck
 *   - "blunzinger_atomic"            — Atomic (blastOnCapture) + mustCheck
 *   - "blunzinger_crazyhouse"        — Crazyhouse + mustCheck
 *   - "blunzinger_960"               — Chess960 + mustCheck
 *   - "blunzinger_koth_atomic"       — KotH + Atomic + mustCheck
 *   - "blunzinger_crazyhouse_koth"   — Crazyhouse + KotH + mustCheck
 *   - "blunzinger_kinghunt_koth"     — King Hunt + KotH + mustCheck
 *   - "blunzinger_atomic_crazyhouse" — Atomic + Crazyhouse + mustCheck
 *   - "blunzinger_960_crazyhouse"    — Chess960 + Crazyhouse + mustCheck
 *   - "blunzinger_960_koth"          — Chess960 + KotH + mustCheck
 *
 * Reverse Blunzinger does NOT have native mustCheck support in ffish.
 * The app uses "chess" as the variant key for Reverse mode and enforces
 * the reverse forced-check rule entirely in core/blunzinger/.
 */
function resolveVariant(variantKey?: string): string {
  return variantKey ?? 'chess';
}

// ── mustCheck runtime detection ──────────────────────────────────────

/**
 * Detects whether the loaded ffish WASM build supports the mustCheck option.
 *
 * Strategy: Create a Board with the 'blunzinger' variant (which has
 * mustCheck = true in variants.ini) using a position where a checking move
 * exists. If mustCheck is supported, legalMoves() returns only checking moves
 * (significantly fewer than the full set of legal moves).
 *
 * Test position: Italian Game after 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5
 * (r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4)
 * From this position Bxf7+ gives check. In standard chess White has ~30 legal
 * moves. With mustCheck enforced, only checking moves are returned.
 */
function detectMustCheckSupport(ffish: FairyStockfish): boolean {
  const testFen = 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
  let board: FfishBoard | null = null;
  try {
    board = new ffish.Board('blunzinger', testFen);
    const moves = board.legalMoves();
    if (!moves) return false;

    const moveList = moves.split(' ').filter(Boolean);
    // In standard chess from this position White has ~30 legal moves.
    // With mustCheck enforced and Bxf7+ available as a checking move,
    // only checking moves are returned — significantly fewer than 10.
    return moveList.length > 0 && moveList.length < 10;
  } catch {
    return false;
  } finally {
    board?.delete();
  }
}

// ── Adapter info ─────────────────────────────────────────────────────

const INFO: EngineInfo = {
  id: 'blunznfish',
  name: 'Blunznfish',
  description:
    'Variant-aware engine powered by custom Fairy-Stockfish (ffish.js) WASM build with native mustCheck (forced-check) support. Also supports Atomic, Crazyhouse, King of the Hill, Chess960, and check-counting overlays.',
  availability: 'available',
  supportsEvaluation: true,
  supportsBotPlay: true,
  supportsVariantAwareness: true,
};

// ── ffish-native position evaluation ─────────────────────────────────

/** Standard piece values in centipawns (lowercase piece letters). */
const PIECE_CP: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0, // kings are excluded from material counting (value 0)
};

/** Threshold in centipawns below which the position is considered equal. */
const EQUAL_THRESHOLD_CP = 25;

/** Score assigned to a won position (checkmate or variant win). */
const MATE_SCORE_CP = 10000;

/** Penalty applied when the side to move is in check. */
const CHECK_PENALTY_CP = 50;

/** Centipawn weight per legal move for mobility evaluation. */
const MOBILITY_WEIGHT_CP = 3;

/**
 * Parse material balance from a FEN string (pure string manipulation,
 * no chess.js dependency). Returns score from White's perspective.
 */
function materialFromFen(fen: string): number {
  const placement = fen.split(' ')[0];
  let material = 0;
  for (const ch of placement) {
    const lower = ch.toLowerCase();
    const value = PIECE_CP[lower];
    if (value !== undefined && value > 0) {
      material += ch === lower ? -value : value; // lowercase = black, uppercase = white
    }
  }
  return material;
}

/**
 * Evaluate a position using ffish's variant-aware capabilities.
 *
 * Uses ffish for:
 *   - Game-over / result detection (checkmate, stalemate, variant end)
 *   - Check detection
 *   - Legal move count (mobility)
 *   - Capture detection (for move ordering)
 *
 * Material is parsed directly from the FEN (no chess.js needed).
 *
 * Returns centipawn score from White's perspective.
 */
function ffishEvaluatePosition(board: FfishBoard): { scoreCp: number; mateIn: number | null } {
  // Terminal states
  if (board.isGameOver()) {
    const result = board.result();
    if (result === '1-0') return { scoreCp: MATE_SCORE_CP, mateIn: 0 };
    if (result === '0-1') return { scoreCp: -MATE_SCORE_CP, mateIn: 0 };
    return { scoreCp: 0, mateIn: null }; // draw
  }

  const fen = board.fen();
  const material = materialFromFen(fen);

  // Mobility — use ffish's variant-aware legal move count
  const currentMobility = board.numberLegalMoves();
  const isWhiteTurn = board.turn(); // true = white

  // Check bonus — being in check is bad for the side to move
  const checkPenalty = board.isCheck() ? CHECK_PENALTY_CP : 0;

  // Simple mobility-based evaluation from the current side's perspective
  // We use a single-side mobility count with a scaling factor
  const mobilityScore = currentMobility * MOBILITY_WEIGHT_CP;
  const mobilityFromWhite = isWhiteTurn ? mobilityScore : -mobilityScore;
  const checkFromWhite = isWhiteTurn ? -checkPenalty : checkPenalty;

  const scoreCp = material + mobilityFromWhite + checkFromWhite;
  return { scoreCp, mateIn: null };
}

// ── ffish-based analysis ─────────────────────────────────────────────

/**
 * Find best move using ffish's variant-aware legal move generation
 * and ffish-native position evaluation.
 */
function ffishBestMove(ffish: FairyStockfish, fen: string, variantKey?: string): string | null {
  const variant = resolveVariant(variantKey);
  const is960 = variant.includes('960');
  let board: FfishBoard | null = null;
  try {
    board = new ffish.Board(variant, fen, is960);
    const movesStr = board.legalMoves();
    if (!movesStr) return null;

    const moves = movesStr.split(' ').filter(Boolean);
    if (moves.length === 0) return null;
    if (moves.length === 1) return moves[0];

    const isWhite = fen.split(' ')[1] === 'w';
    let bestMove = moves[0];
    let bestScore = isWhite ? -Infinity : Infinity;

    for (const move of moves) {
      board.push(move);

      if (board.isGameOver()) {
        // Game-ending move — this is likely checkmate or variant win
        board.pop();
        return move;
      }

      // Evaluate resulting position with ffish-native evaluation
      const eval_ = ffishEvaluatePosition(board);
      if (isWhite ? eval_.scoreCp > bestScore : eval_.scoreCp < bestScore) {
        bestScore = eval_.scoreCp;
        bestMove = move;
      }

      board.pop();
    }

    return bestMove;
  } catch {
    // ffish failed for this position — fall back to heuristic
    return findBestMoveUci(fen);
  } finally {
    board?.delete();
  }
}

/**
 * Analyze position using ffish for both move generation and evaluation.
 * No heuristic fallback when ffish is available — fully ffish-native.
 */
function ffishAnalysis(ffish: FairyStockfish, fen: string, variantKey?: string): EngineLine[] {
  const variant = resolveVariant(variantKey);
  const is960 = variant.includes('960');
  let board: FfishBoard | null = null;
  try {
    board = new ffish.Board(variant, fen, is960);
    const eval_ = ffishEvaluatePosition(board);
    const bestMove = ffishBestMove(ffish, fen, variantKey);

    return [
      {
        bestMove,
        pv: bestMove ? [bestMove] : [],
        score: {
          scoreCp: eval_.scoreCp,
          mateIn: eval_.mateIn,
          favoredSide:
            eval_.scoreCp > EQUAL_THRESHOLD_CP
              ? 'white'
              : eval_.scoreCp < -EQUAL_THRESHOLD_CP
                ? 'black'
                : 'equal',
        },
      },
    ];
  } catch {
    // ffish failed — fall back to heuristic for this analysis
    return heuristicAnalysis(fen);
  } finally {
    board?.delete();
  }
}

// ── Adapter factory ──────────────────────────────────────────────────

export function createBlunznfishAdapter(): VariantEngineAdapter {
  let ffish: FairyStockfish | null = null;
  let disposed = false;
  let initialized = false;
  let mustCheckSupported = false;

  return {
    info: INFO,

    async initialize(): Promise<void> {
      if (initialized) return;
      try {
        // Load ffish.js and ffish.wasm from public/ — no npm dependency needed.
        // ffish.js is the Emscripten JS glue that initialises the WASM module.
        // We fetch the script text and evaluate it with a pre-configured Module
        // object so the Emscripten code picks up locateFile and the runtime-init
        // callback. This fails fast in test environments (jsdom) where fetch to
        // localhost is not available, triggering the graceful heuristic fallback.
        if (typeof window === 'undefined') {
          throw new Error('ffish requires a browser environment');
        }

        const response = await fetch('/ffish.js');
        if (!response.ok) throw new Error(`Failed to load /ffish.js: ${response.status}`);
        const ffishCode = await response.text();

        ffish = await new Promise<FairyStockfish>((resolve, reject) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const win = window as any;
          const prev = win['Module'];
          win['Module'] = {
            locateFile: (file: string) => `/${file}`,
            onRuntimeInitialized: () => {
              const mod = win['Module'] as FairyStockfish;
              if (prev !== undefined) {
                win['Module'] = prev;
              } else {
                delete win['Module'];
              }
              resolve(mod);
            },
          };

          try {
            // Evaluate the Emscripten JS glue — it reads the pre-configured
            // window.Module and begins loading the WASM.
            new Function(ffishCode)();
          } catch (e) {
            if (prev !== undefined) {
              win['Module'] = prev;
            } else {
              delete win['Module'];
            }
            reject(e);
          }
        });

        // Load custom variant definitions
        if (typeof fetch === 'function') {
          try {
            const response = await fetch('/variants.ini');
            if (response.ok) {
              const config = await response.text();
              ffish.loadVariantConfig(config);
            }
          } catch {
            // variants.ini not available — use built-in variants only
          }
        }

        // Detect mustCheck support in the loaded WASM build
        mustCheckSupported = detectMustCheckSupport(ffish);

        initialized = true;
      } catch {
        // ffish.js not available (e.g. test environment without WASM)
        // Adapter falls back to heuristic analysis
        ffish = null;
        initialized = true;
      }
    },

    async analyzePosition(options: AnalyzePositionOptions): Promise<EngineLine[]> {
      if (disposed) return [];
      if (ffish) {
        return ffishAnalysis(ffish, options.fen, options.variantKey);
      }
      return heuristicAnalysis(options.fen);
    },

    async getBestMove(options: AnalyzePositionOptions): Promise<string | null> {
      if (disposed) return null;
      if (ffish) {
        return ffishBestMove(ffish, options.fen, options.variantKey);
      }
      return findBestMoveUci(options.fen);
    },

    dispose(): void {
      disposed = true;
      ffish = null;
    },

    /**
     * Returns whether the loaded ffish WASM build supports native mustCheck
     * enforcement. When true, the engine's legal move generation already
     * filters moves according to the forced-check rule, making the app's
     * violation detection redundant (but kept as a safety net).
     */
    get mustCheckSupported(): boolean {
      return mustCheckSupported;
    },
  };
}
