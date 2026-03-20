import type { Square, Move, Color } from 'chess.js';

export type { Square, Move, Color };

export type GameMode = 'hvh' | 'hvbot' | 'botvbot';
export type BotLevel = 'easy' | 'medium' | 'hard';

// ── Variant Mode System ──────────────────────────────────────────────

export type VariantModeId =
  | 'classic_blunziger'
  | 'double_check_pressure'
  | 'blitz_blunziger'
  | 'penalty_instead_of_loss'
  | 'king_hunter'
  | 'reverse_blunziger';

export interface VariantConfig {
  enableBlunziger: boolean;
  enableKingOfTheHill: boolean;
  reverseForcedCheck: boolean;
  doubleCheckPressureImmediateLoss: boolean;
  invalidReportLossThreshold: number;
  enableClock: boolean;
  initialTimeMs: number;
  incrementMs: number;
  missedCheckPenalty: 'loss' | 'extra_move';
  /** Seconds subtracted from violator's clock on missed forced check (penalty + clock mode). 0 = disabled. */
  missedCheckTimePenaltySeconds: number;
  scoringMode: 'none' | 'checks_count';
  gameEndsOnCheckmate: boolean;
  moveLimit: number;
}

export interface GameModeDefinition {
  id: VariantModeId;
  name: string;
  description: string;
  config: VariantConfig;
}

/**
 * Legacy alias for backward compatibility.
 * New code should use `VariantConfig` directly.
 * @deprecated Use VariantConfig instead.
 */
export type BlunzigerConfig = VariantConfig;

// ── Preset Configs ───────────────────────────────────────────────────

const BASE_VARIANT_CONFIG: VariantConfig = {
  enableBlunziger: true,
  enableKingOfTheHill: false,
  reverseForcedCheck: false,
  doubleCheckPressureImmediateLoss: false,
  invalidReportLossThreshold: 2,
  enableClock: false,
  initialTimeMs: 0,
  incrementMs: 0,
  missedCheckPenalty: 'loss',
  missedCheckTimePenaltySeconds: 0,
  scoringMode: 'none',
  gameEndsOnCheckmate: true,
  moveLimit: 0,
};

export const GAME_MODE_DEFINITIONS: GameModeDefinition[] = [
  {
    id: 'classic_blunziger',
    name: 'Classic Blunziger',
    description:
      'Standard chess with the forced-check rule. If a checking move exists, you are expected to play it. Opponent can report a miss for an immediate win.',
    config: { ...BASE_VARIANT_CONFIG },
  },
  {
    id: 'double_check_pressure',
    name: 'Double Check Pressure',
    description:
      'Normal Blunziger rules apply, but if TWO or more checking moves exist and you miss them, you lose immediately (no report needed).',
    config: {
      ...BASE_VARIANT_CONFIG,
      doubleCheckPressureImmediateLoss: true,
    },
  },
  {
    id: 'blitz_blunziger',
    name: 'Blitz Blunziger',
    description:
      'Blunziger mode with chess clocks. If your time runs out, you lose.',
    config: {
      ...BASE_VARIANT_CONFIG,
      enableClock: true,
      initialTimeMs: 5 * 60 * 1000, // 5 minutes
      incrementMs: 0,
    },
  },
  {
    id: 'penalty_instead_of_loss',
    name: 'Penalty Instead of Loss',
    description:
      'Missing a forced check does not cause loss. Instead the opponent receives one extra consecutive move as penalty.',
    config: {
      ...BASE_VARIANT_CONFIG,
      missedCheckPenalty: 'extra_move',
    },
  },
  {
    id: 'king_hunter',
    name: 'King Hunter',
    description:
      'Checks are worth points. Game ends after a configured move limit. Player with more check-points wins.',
    config: {
      ...BASE_VARIANT_CONFIG,
      scoringMode: 'checks_count',
      moveLimit: 40,
    },
  },
  {
    id: 'reverse_blunziger',
    name: 'Reverse Blunziger',
    description:
      'If a checking move exists, you are FORBIDDEN from giving check (must play a non-checking move). Violation = immediate loss. Exception: if ALL legal moves give check, any move is allowed.',
    config: {
      ...BASE_VARIANT_CONFIG,
      enableBlunziger: false,
      reverseForcedCheck: true,
    },
  },
];

export function getGameModeDefinition(id: VariantModeId): GameModeDefinition {
  const def = GAME_MODE_DEFINITIONS.find((d) => d.id === id);
  if (!def) throw new Error(`Unknown game mode: ${id}`);
  return def;
}

// ── Result Reasons ───────────────────────────────────────────────────

export type GameResultReason =
  | 'checkmate'
  | 'stalemate'
  | 'draw'
  | 'valid-report'
  | 'invalid-report-threshold'
  | 'resignation'
  | 'insufficient-material'
  | 'threefold-repetition'
  | 'fifty-move-rule'
  | 'king_of_the_hill'
  | 'double_check_pressure_violation'
  | 'reverse_blunziger_violation'
  | 'timeout'
  | 'timeout_penalty'
  | 'score_limit'
  | 'score_limit_draw';

export interface GameResult {
  winner: Color | 'draw';
  reason: GameResultReason;
  detail?: string;
}

export interface ViolationRecord {
  violatingSide: Color;
  moveIndex: number;
  fenBeforeMove: string;
  checkingMoves: Move[];
  actualMove: Move;
  reportable: boolean;
}

export interface InvalidReportCounts {
  w: number;
  b: number;
}

export interface ReportFeedback {
  valid: boolean;
  message: string;
}

// ── Score / Clock / Extra-Turn State ─────────────────────────────────

export interface ScoreState {
  w: number;
  b: number;
}

export interface ClockState {
  whiteMs: number;
  blackMs: number;
  lastTimestamp: number | null;
}

export interface ExtraTurnState {
  pendingExtraMovesWhite: number;
  pendingExtraMovesBlack: number;
}

// ── Game State ───────────────────────────────────────────────────────

export interface GameState {
  fen: string;
  moveHistory: Move[];
  sideToMove: Color;
  pendingViolation: ViolationRecord | null;
  invalidReports: InvalidReportCounts;
  config: VariantConfig;
  result: GameResult | null;
  lastReportFeedback: ReportFeedback | null;
  mode: GameMode;
  botLevel: BotLevel;
  botColor: Color;
  variantModeId: VariantModeId;
  scores: ScoreState;
  clocks: ClockState | null;
  extraTurns: ExtraTurnState;
  plyCount: number;
}

// ── Setup Config ─────────────────────────────────────────────────────

export interface GameSetupConfig {
  mode: GameMode;
  botSide: Color;
  botDifficulty: BotLevel;
  variantModeId: VariantModeId;
  enableKingOfTheHill: boolean;
  // Mode-specific overrides
  invalidReportLossThreshold: number;
  initialTimeMs: number;
  incrementMs: number;
  moveLimit: number;
  /** Seconds subtracted from violator's clock on missed forced check (penalty + clock mode). */
  missedCheckTimePenaltySeconds: number;
}

export const DEFAULT_SETUP_CONFIG: GameSetupConfig = {
  mode: 'hvh',
  botSide: 'b',
  botDifficulty: 'easy',
  variantModeId: 'classic_blunziger',
  enableKingOfTheHill: false,
  invalidReportLossThreshold: 2,
  initialTimeMs: 5 * 60 * 1000,
  incrementMs: 0,
  moveLimit: 40,
  missedCheckTimePenaltySeconds: 5,
};

/** Build a frozen VariantConfig from the setup choices. */
export function buildVariantConfig(setup: GameSetupConfig): VariantConfig {
  const base = getGameModeDefinition(setup.variantModeId).config;
  return {
    ...base,
    enableKingOfTheHill: setup.enableKingOfTheHill,
    invalidReportLossThreshold: setup.invalidReportLossThreshold,
    ...(base.enableClock
      ? { initialTimeMs: setup.initialTimeMs, incrementMs: setup.incrementMs }
      : {}),
    ...(base.moveLimit > 0 ? { moveLimit: setup.moveLimit } : {}),
    ...(base.missedCheckPenalty === 'extra_move' && base.enableClock
      ? { missedCheckTimePenaltySeconds: setup.missedCheckTimePenaltySeconds }
      : {}),
  };
}

export const DEFAULT_CONFIG: VariantConfig = {
  ...BASE_VARIANT_CONFIG,
};

export const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
