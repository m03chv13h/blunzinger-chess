/**
 * Blunznfish engine adapter — Fairy-Stockfish (ffish.js) powered variant-aware engine.
 *
 * Uses ffish.js (WebAssembly build of Fairy-Stockfish) for variant-aware legal
 * move generation and position analysis. The engine supports overlays like
 * Atomic, Crazyhouse, King of the Hill, Chess960, and check-counting (King Hunt)
 * natively via custom variant definitions in variants.ini.
 *
 * The Blunziger forced-check rule (mustCheck) is NOT natively supported by
 * Fairy-Stockfish. The app's authoritative rules in `core/blunziger/` enforce
 * that mechanic. This engine provides advisory evaluation and best-move hints
 * that account for overlay-specific rules (explosions, drops, flag squares, etc.)
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
 * Supported ffish variant keys (defined in public/variants.ini):
 *   - "chess"                       — standard chess (default)
 *   - "blunziger"                   — base Blunziger (standard chess rules)
 *   - "blunziger_kinghunt"          — King Hunt with check counting
 *   - "blunziger_koth"              — King of the Hill
 *   - "blunziger_atomic"            — Atomic Chess
 *   - "blunziger_crazyhouse"        — Crazyhouse
 *   - "blunziger_960"               — Chess960
 *   - "blunziger_koth_atomic"       — KotH + Atomic
 *   - "blunziger_crazyhouse_koth"   — Crazyhouse + KotH
 *   - "blunziger_kinghunt_koth"     — King Hunt + KotH
 *   - "blunziger_atomic_crazyhouse" — Atomic + Crazyhouse
 *   - "blunziger_960_crazyhouse"    — Chess960 + Crazyhouse
 *   - "blunziger_960_koth"          — Chess960 + KotH
 */
function resolveVariant(variantKey?: string): string {
  return variantKey ?? 'chess';
}

// ── Adapter info ─────────────────────────────────────────────────────

const INFO: EngineInfo = {
  id: 'blunznfish',
  name: 'Blunznfish',
  description:
    'Variant-aware engine powered by Fairy-Stockfish (ffish.js). Provides native support for Atomic, Crazyhouse, King of the Hill, Chess960, and check-counting overlays. Forced-check rule is enforced by the app.',
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
  };
}
