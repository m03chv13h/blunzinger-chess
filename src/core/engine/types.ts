/**
 * Pluggable engine abstraction layer.
 *
 * Engines are **advisory** — they provide evaluation scores, candidate move
 * rankings, and bot-play support.  The app's authoritative rules, violation
 * handling, and match-state logic remain in `core/blunziger/`.
 */

// ── Engine identification ────────────────────────────────────────────

export type EngineId =
  | 'blunznforön'
  | 'heuristic'
  | 'blunznfish';

export type EngineAvailability =
  | 'available'
  | 'unavailable'
  | 'coming_soon';

export interface EngineInfo {
  id: EngineId;
  /** User-facing display name. */
  name: string;
  description: string;
  availability: EngineAvailability;
  supportsEvaluation: boolean;
  supportsBotPlay: boolean;
  supportsVariantAwareness: boolean;
}

// ── Engine analysis types ────────────────────────────────────────────

export interface EngineScore {
  /** Centipawn score (positive = White better). */
  scoreCp?: number;
  /** Mate-in-N (positive = White mates, negative = Black mates, null = no mate). */
  mateIn?: number | null;
  favoredSide?: 'white' | 'black' | 'equal';
}

export interface EngineLine {
  /** Best move in UCI long-algebraic notation (e.g. "e2e4"), or null if none. */
  bestMove?: string | null;
  /** Principal variation as UCI move strings. */
  pv?: string[];
  score: EngineScore;
}

export interface AnalyzePositionOptions {
  fen: string;
  depth?: number;
  multiPv?: number;
  variantKey?: string;
}

// ── Engine adapter interface ─────────────────────────────────────────

export interface VariantEngineAdapter {
  readonly info: EngineInfo;

  /**
   * One-time initialisation (e.g. load WASM, spin up worker).
   * Resolves when the engine is ready for analysis.
   */
  initialize(): Promise<void>;

  /**
   * Analyze a position and return one or more principal-variation lines.
   *
   * Engines that do not support multi-PV may return a single line regardless
   * of `options.multiPv`.
   */
  analyzePosition(options: AnalyzePositionOptions): Promise<EngineLine[]>;

  /**
   * Request the best move for a given position.
   * Returns a UCI move string (e.g. "e2e4") or null when no move is available.
   */
  getBestMove(options: AnalyzePositionOptions): Promise<string | null>;

  /**
   * Release resources (terminate workers, free WASM memory).
   */
  dispose(): void;
}
