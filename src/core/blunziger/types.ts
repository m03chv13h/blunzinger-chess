import type { Square, Move, Color } from 'chess.js';
import type { EngineId } from '../engine/types';

export type { Square, Move, Color };

export type GameMode = 'hvh' | 'hvbot' | 'botvbot';
export type BotLevel = 'easy' | 'medium' | 'hard';

// ── A) Variant Mode ──────────────────────────────────────────────────

export type VariantMode =
  | 'classic_blunzinger'
  | 'reverse_blunzinger'
  | 'classic_king_hunt_move_limit'
  | 'classic_king_hunt_given_check_limit';

// ── B) Game Type ─────────────────────────────────────────────────────

export type GameType =
  | 'report_incorrectness'
  | 'penalty_on_miss';

// ── C) Overlay / Options Config ──────────────────────────────────────

export interface OverlayConfig {
  enableKingOfTheHill: boolean;
  enableClock: boolean;
  initialTimeMs: number;
  incrementMs: number;
  decrementMs: number;
  enableDoubleCheckPressure: boolean;
}

// ── Game-Type-Specific Config ────────────────────────────────────────

export interface ReportGameTypeConfig {
  invalidReportLossThreshold: number;
}

export interface PenaltyGameTypeConfig {
  enableAdditionalMovePenalty: boolean;
  additionalMoveCount: number;
  enablePieceRemovalPenalty: boolean;
  pieceRemovalCount: number;
  enableTimeReductionPenalty: boolean;
  timeReductionSeconds: number;
}

// ── Variant-Specific Config ──────────────────────────────────────────

export interface VariantSpecificConfig {
  /** Total ply limit for Classic Blunzinger - King Hunt - Move Limit */
  kingHuntPlyLimit: number;
  /** Target check count for Classic Blunzinger - King Hunt - Given Check Limit */
  kingHuntGivenCheckTarget: number;
}

// ── Match Config (immutable during game) ─────────────────────────────

export interface MatchConfig {
  variantMode: VariantMode;
  gameType: GameType;
  overlays: OverlayConfig;
  reportConfig: ReportGameTypeConfig;
  penaltyConfig: PenaltyGameTypeConfig;
  variantSpecific: VariantSpecificConfig;
}

// ── Variant Mode Definitions ─────────────────────────────────────────

export interface VariantModeDefinition {
  id: VariantMode;
  name: string;
  description: string;
}

export const VARIANT_MODE_DEFINITIONS: VariantModeDefinition[] = [
  {
    id: 'classic_blunzinger',
    name: 'Classic Blunzinger',
    description:
      'If a checking move exists, the player is required to play a checking move.',
  },
  {
    id: 'reverse_blunzinger',
    name: 'Reverse Blunzinger',
    description:
      'If non-checking moves exist, the player is required to play a non-checking move. If all legal moves give check, any move is allowed.',
  },
  {
    id: 'classic_king_hunt_move_limit',
    name: 'Classic Blunzinger - King Hunt - Move Limit',
    description:
      'Classic Blunzinger forced-check rules with King Hunt scoring. Game ends at a configured ply limit. Player with more check-points wins.',
  },
  {
    id: 'classic_king_hunt_given_check_limit',
    name: 'Classic Blunzinger - King Hunt - Given Check Limit',
    description:
      'Classic Blunzinger forced-check rules with King Hunt scoring. First player to reach the configured number of given checks wins immediately.',
  },
];

export function getVariantModeDefinition(id: VariantMode): VariantModeDefinition {
  const def = VARIANT_MODE_DEFINITIONS.find((d) => d.id === id);
  if (!def) throw new Error(`Unknown variant mode: ${id}`);
  return def;
}

// ── Variant Mode Helpers ─────────────────────────────────────────────

/** Classic forced-check rule: player must play a checking move if one exists. */
export function isClassicForcedCheck(mode: VariantMode): boolean {
  return mode !== 'reverse_blunzinger';
}

/** Reverse forced-check rule: player must avoid giving check if non-checking moves exist. */
export function isReverseForcedCheckMode(mode: VariantMode): boolean {
  return mode === 'reverse_blunzinger';
}

/** King Hunt variant: tracks check-scoring. */
export function isKingHuntVariant(mode: VariantMode): boolean {
  return mode === 'classic_king_hunt_move_limit' || mode === 'classic_king_hunt_given_check_limit';
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
  | 'timeout'
  | 'timeout_penalty'
  | 'king_hunt_ply_limit'
  | 'king_hunt_ply_limit_draw'
  | 'king_hunt_given_check_limit'
  | 'piece_removal_no_piece_loss';

export interface GameResult {
  winner: Color | 'draw';
  reason: GameResultReason;
  detail?: string;
}

export type ViolationType =
  | 'missed_check'
  | 'gave_forbidden_check'
  | 'missed_check_removal'
  | 'gave_forbidden_check_removal';

export interface ViolationRecord {
  violatingSide: Color;
  moveIndex: number;
  fenBeforeMove: string;
  checkingMoves: Move[];
  /** The moves the player was required to choose from. */
  requiredMoves: Move[];
  /** The move that was actually played (not set for piece removal violations). */
  actualMove?: Move;
  reportable: boolean;
  violationType: ViolationType;
  /** True when Double Check Pressure overlay is active and ≥2 required moves exist. */
  severe: boolean;
  /** Squares whose removal would satisfy the variant rule (piece removal violations only). */
  requiredRemovalSquares?: Square[];
  /** The square that was actually chosen for removal (piece removal violations only). */
  chosenRemovalSquare?: Square;
}

export interface InvalidReportCounts {
  w: number;
  b: number;
}

export interface ReportFeedback {
  valid: boolean;
  message: string;
}

export interface ViolationReportEntry {
  /** Index of the move in moveHistory associated with this report. */
  moveIndex: number;
  /** Side that made the report. */
  reportingSide: Color;
  /** Whether the report was correct (violation existed). */
  valid: boolean;
}

/** Lightweight record of a missed-check (or gave-forbidden-check) violation for the move table. */
export interface MissedCheckEntry {
  /** Index of the violating move in moveHistory. */
  moveIndex: number;
  /** Type of violation committed. */
  violationType: ViolationType;
}

/** Record of a piece removed as penalty, displayed as an icon next to the offending move. */
export interface PieceRemovalEntry {
  /** Index of the move in moveHistory that triggered the penalty. */
  moveIndex: number;
  /** Type of the piece that was removed (p, n, b, r, q). */
  pieceType: string;
  /** Color of the removed piece. */
  pieceColor: Color;
}

/** Record of a clock-time reduction applied as penalty. */
export interface TimeReductionEntry {
  /** Index of the move in moveHistory that triggered the penalty. */
  moveIndex: number;
  /** Seconds deducted from the violator's clock. */
  seconds: number;
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

export interface PendingPieceRemoval {
  /** Side whose piece will be removed (the violator) */
  targetSide: Color;
  /** Side who chooses which piece to remove (the opponent) */
  chooserSide: Color;
  /** Squares containing removable pieces (excludes king) */
  removableSquares: Square[];
  /** How many more pieces to remove (starts at pieceRemovalCount, decrements) */
  remainingRemovals: number;
  /** Index of the move in moveHistory that triggered this penalty */
  triggerMoveIndex: number;
}

// ── Position History (for post-game review) ──────────────────────────

export interface PositionHistoryEntry {
  fen: string;
  scores: ScoreState;
  moveNotation: string | null;
}

// ── Game State ───────────────────────────────────────────────────────

export interface GameState {
  fen: string;
  moveHistory: Move[];
  sideToMove: Color;
  pendingViolation: ViolationRecord | null;
  invalidReports: InvalidReportCounts;
  config: MatchConfig;
  result: GameResult | null;
  lastReportFeedback: ReportFeedback | null;
  mode: GameMode;
  botLevel: BotLevel;
  botColor: Color;
  /** Engine used for the White bot side (advisory — app rules remain authoritative). */
  engineIdWhite: EngineId;
  /** Engine used for the Black bot side (advisory — app rules remain authoritative). */
  engineIdBlack: EngineId;
  scores: ScoreState;
  clocks: ClockState | null;
  extraTurns: ExtraTurnState;
  pendingPieceRemoval: PendingPieceRemoval | null;
  plyCount: number;
  /** Ordered snapshot of every board-changing state transition for post-game review. */
  positionHistory: PositionHistoryEntry[];
  /** History of all violation reports made during the game. */
  violationReports: ViolationReportEntry[];
  /** History of all missed-check violations that occurred during the game. */
  missedChecks: MissedCheckEntry[];
  /** History of pieces removed as penalty (for display in move list). */
  pieceRemovals: PieceRemovalEntry[];
  /** History of time reductions applied as penalty (for display in move list). */
  timeReductions: TimeReductionEntry[];
  /** True when the current side to move is in an extra (bonus) turn granted by a penalty. */
  inExtraTurn: boolean;
}

// ── Setup Config ─────────────────────────────────────────────────────

export interface GameSetupConfig {
  mode: GameMode;
  botSide: Color;
  botDifficulty: BotLevel;
  variantMode: VariantMode;
  gameType: GameType;
  // Engine selection
  engineId: EngineId;
  /** Engine for the White bot side (botvbot only; falls back to engineId). */
  engineIdWhite: EngineId;
  /** Engine for the Black bot side (botvbot only; falls back to engineId). */
  engineIdBlack: EngineId;
  // Overlays
  enableKingOfTheHill: boolean;
  enableClock: boolean;
  initialTimeMs: number;
  incrementMs: number;
  decrementMs: number;
  enableDoubleCheckPressure: boolean;
  // Report config
  invalidReportLossThreshold: number;
  // Penalty config
  enableAdditionalMovePenalty: boolean;
  additionalMoveCount: number;
  enablePieceRemovalPenalty: boolean;
  pieceRemovalCount: number;
  enableTimeReductionPenalty: boolean;
  timeReductionSeconds: number;
  // Variant specific
  kingHuntPlyLimit: number;
  kingHuntGivenCheckTarget: number;
}

export const DEFAULT_SETUP_CONFIG: GameSetupConfig = {
  mode: 'hvh',
  botSide: 'b',
  botDifficulty: 'easy',
  variantMode: 'classic_blunzinger',
  gameType: 'report_incorrectness',
  engineId: 'heuristic',
  engineIdWhite: 'heuristic',
  engineIdBlack: 'heuristic',
  enableKingOfTheHill: false,
  enableClock: false,
  initialTimeMs: 5 * 60 * 1000,
  incrementMs: 0,
  decrementMs: 0,
  enableDoubleCheckPressure: false,
  invalidReportLossThreshold: 2,
  enableAdditionalMovePenalty: false,
  additionalMoveCount: 1,
  enablePieceRemovalPenalty: false,
  pieceRemovalCount: 1,
  enableTimeReductionPenalty: false,
  timeReductionSeconds: 60,
  kingHuntPlyLimit: 80,
  kingHuntGivenCheckTarget: 5,
};

/** Build a frozen MatchConfig from the setup choices. */
export function buildMatchConfig(setup: GameSetupConfig): MatchConfig {
  const clockEnabled = setup.enableClock;
  return {
    variantMode: setup.variantMode,
    gameType: setup.gameType,
    overlays: {
      enableKingOfTheHill: setup.enableKingOfTheHill,
      enableClock: clockEnabled,
      initialTimeMs: clockEnabled ? setup.initialTimeMs : 0,
      incrementMs: clockEnabled ? setup.incrementMs : 0,
      decrementMs: clockEnabled ? setup.decrementMs : 0,
      enableDoubleCheckPressure: setup.enableDoubleCheckPressure,
    },
    reportConfig: {
      invalidReportLossThreshold: setup.invalidReportLossThreshold,
    },
    penaltyConfig: {
      enableAdditionalMovePenalty: setup.enableAdditionalMovePenalty,
      additionalMoveCount: setup.additionalMoveCount,
      enablePieceRemovalPenalty: setup.enablePieceRemovalPenalty,
      pieceRemovalCount: setup.pieceRemovalCount,
      enableTimeReductionPenalty: clockEnabled ? setup.enableTimeReductionPenalty : false,
      timeReductionSeconds: setup.timeReductionSeconds,
    },
    variantSpecific: {
      kingHuntPlyLimit: setup.kingHuntPlyLimit,
      kingHuntGivenCheckTarget: setup.kingHuntGivenCheckTarget,
    },
  };
}

export const DEFAULT_CONFIG: MatchConfig = buildMatchConfig(DEFAULT_SETUP_CONFIG);

export const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
