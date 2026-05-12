/**
 * Blunznfish engine adapter — Fairy-Stockfish (ffish.js) powered variant-aware engine.
 *
 * Uses a custom-built ffish.js WASM (v0.1) that adds `mustCheck` support to
 * Fairy-Stockfish. This enables native forced-check enforcement: when a
 * checking move exists, only checking moves are returned as legal.
 *
 * Supported overlays via custom variant definitions in variants.ini:
 *   - mustCheck (forced-check rule) — ✅ native in blunznfish WASM v0.1
 *   - Atomic (blastOnCapture)       — ✅ native (must inherit from :chess, not :atomic)
 *   - Crazyhouse (piece drops)      — ✅ native
 *   - King of the Hill (flag)       — ✅ native
 *   - Chess960                      — ✅ native
 *   - Check counting (King Hunt)    — ✅ native
 *
 * Reverse Blunzinger (must avoid giving check) is NOT supported natively by
 * ffish. The app's authoritative rules in `core/blunziger/` enforce that
 * mechanic. For Reverse mode, the engine provides standard chess move
 * generation and the app filters moves client-side.
 *
 * When ffish.js cannot be loaded (e.g. in test environments without WASM support),
 * the adapter gracefully falls back to heuristic analysis.
 *
 * IMPORTANT: This engine is **advisory only**. The app's authoritative rules
 * (violations, penalties, overlays) remain in `core/blunziger/`.
 */

import type {
  VariantEngineAdapter,
  EngineInfo,
  AnalyzePositionOptions,
  EngineLine,
} from '../types';
import { evaluateBasePosition } from '../../evaluation/evaluatePosition';
import { findBestMoveUci, heuristicAnalysis } from './shared';

// ── ffish module type (subset used by this adapter) ──────────────────

interface FfishBoard {
  legalMoves(): string;
  push(uciMove: string): boolean;
  pop(): void;
  fen(): string;
  isGameOver(): boolean;
  isCheck(): boolean;
  turn(): boolean;
  delete(): void;
}

interface FfishModule {
  Board: { new (variant?: string, fen?: string, is960?: boolean): FfishBoard };
  loadVariantConfig(config: string): void;
  validateFen(fen: string, variant?: string): number;
}

// ── Variant key resolution ───────────────────────────────────────────

/**
 * Resolves the ffish variant key from the app-level variantKey option.
 *
 * The variantKey is passed via AnalyzePositionOptions.variantKey and is
 * constructed by the caller based on the active MatchConfig overlays.
 *
 * Supported ffish variant keys with mustCheck (defined in public/variants.ini):
 *   - "chess"                       — standard chess (default, no mustCheck)
 *   - "blunziger"                   — base Blunziger (mustCheck = true)
 *   - "blunziger_kinghunt"          — King Hunt with check counting + mustCheck
 *   - "blunziger_koth"              — King of the Hill + mustCheck
 *   - "blunziger_atomic"            — Atomic (blastOnCapture) + mustCheck
 *   - "blunziger_crazyhouse"        — Crazyhouse + mustCheck
 *   - "blunziger_960"               — Chess960 + mustCheck
 *   - "blunziger_koth_atomic"       — KotH + Atomic + mustCheck
 *   - "blunziger_crazyhouse_koth"   — Crazyhouse + KotH + mustCheck
 *   - "blunziger_kinghunt_koth"     — King Hunt + KotH + mustCheck
 *   - "blunziger_atomic_crazyhouse" — Atomic + Crazyhouse + mustCheck
 *   - "blunziger_960_crazyhouse"    — Chess960 + Crazyhouse + mustCheck
 *   - "blunziger_960_koth"          — Chess960 + KotH + mustCheck
 *
 * Reverse Blunzinger does NOT have native mustCheck support in ffish.
 * The app uses "chess" as the variant key for Reverse mode and enforces
 * the reverse forced-check rule entirely in core/blunziger/.
 */
function resolveVariant(variantKey?: string): string {
  return variantKey ?? 'chess';
}

// ── mustCheck runtime detection ──────────────────────────────────────

/**
 * Detects whether the loaded ffish WASM build supports the mustCheck option.
 *
 * Strategy: Create a Board with the 'blunziger' variant (which has
 * mustCheck = true in variants.ini) using a position where a checking move
 * exists. If mustCheck is supported, legalMoves() returns only checking moves
 * (significantly fewer than the full set of legal moves).
 *
 * Test position: Italian Game after 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5
 * (r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4)
 * From this position Bxf7+ gives check. In standard chess White has ~30 legal
 * moves. With mustCheck enforced, only checking moves are returned.
 */
function detectMustCheckSupport(ffish: FfishModule): boolean {
  const testFen = 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
  let board: FfishBoard | null = null;
  try {
    board = new ffish.Board('blunziger', testFen);
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

// ── ffish-based analysis ─────────────────────────────────────────────

/**
 * Find best move using ffish's variant-aware legal move generation
 * combined with heuristic position evaluation.
 */
function ffishBestMove(ffish: FfishModule, fen: string, variantKey?: string): string | null {
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

      // Evaluate resulting position with heuristic
      const score = evaluateBasePosition(board.fen()).scoreCp;
      if (isWhite ? score > bestScore : score < bestScore) {
        bestScore = score;
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
 * Analyze position using ffish for move generation and heuristic for scoring.
 */
function ffishAnalysis(ffish: FfishModule, fen: string, variantKey?: string): EngineLine[] {
  const bestMove = ffishBestMove(ffish, fen, variantKey);
  const base = heuristicAnalysis(fen);
  if (bestMove && base.length > 0) {
    return [{
      ...base[0],
      bestMove,
      pv: [bestMove],
    }];
  }
  return base;
}

// ── Adapter factory ──────────────────────────────────────────────────

export function createBlunznfishAdapter(): VariantEngineAdapter {
  let ffish: FfishModule | null = null;
  let disposed = false;
  let initialized = false;
  let mustCheckSupported = false;

  return {
    info: INFO,

    async initialize(): Promise<void> {
      if (initialized) return;
      try {
        // Load ffish via dynamic Function-based import to prevent the bundler and
        // test runner (vitest) from statically resolving and pre-loading the module.
        // ffish.js is a WASM module that crashes vitest's jsdom worker process.
        // This is safe: the argument is a compile-time constant string literal, no
        // user input is involved, and the import target is the known 'ffish' package.
        const loadFfish: () => Promise<{ default: unknown }> = new Function(
          'return import("ffish")',
        ) as () => Promise<{ default: unknown }>;
        const mod = await loadFfish();
        const Module = (mod.default ?? mod) as (opts: Record<string, unknown>) => Promise<FfishModule>;
        ffish = await Module({
          locateFile: (file: string) => {
            // In browser: serve from public/
            if (typeof window !== 'undefined') return `/${file}`;
            return file;
          },
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
