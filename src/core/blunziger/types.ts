import type { Square, Move, Color } from 'chess.js';
import type { EngineId } from '../engine/types';
import type { Chess960State } from './chess960';
import { getRandomChess960Index, chess960IndexToFen } from './chess960';

export type { Square, Move, Color };
export type { Chess960State };

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
  enableCrazyhouse: boolean;
  enableChess960: boolean;
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
  /** Initial FEN for the game. Defaults to standard chess. Set to a Chess960 FEN when that overlay is enabled. */
  initialFen: string;
  /** Chess960 position index (0-959). Present only when Chess960 is enabled. */
  chess960Index?: number;
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
  /** Drop moves that give check (Crazyhouse overlay only). */
  checkingDropMoves?: DropMove[];
  /** Drop moves the player was required to choose from (Crazyhouse overlay only). */
  requiredDropMoves?: DropMove[];
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
  /** SAN notation of moves the player should have played, or squares for removal violations. */
  availableMoves: string[];
  /** Regular (normal) checking moves available, in SAN notation. */
  availableRegularMoves?: string[];
  /** Drop (piece placement) checking moves available, in SAN notation (e.g. "N@d4"). */
  availableDropMoves?: string[];
  /** Squares whose piece removal would create a check. */
  availableRemovalSquares?: string[];
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

// ── Crazyhouse State ─────────────────────────────────────────────────

export type CrazyhousePieceType = 'p' | 'n' | 'b' | 'r' | 'q';

export interface PlayerReserve {
  p: number;
  n: number;
  b: number;
  r: number;
  q: number;
}

export interface CrazyhouseState {
  whiteReserve: PlayerReserve;
  blackReserve: PlayerReserve;
}

export const EMPTY_RESERVE: PlayerReserve = { p: 0, n: 0, b: 0, r: 0, q: 0 };

export interface DropMove {
  type: 'drop';
  piece: CrazyhousePieceType;
  to: Square;
  color: Color;
}

// ── Position History (for post-game review) ──────────────────────────

export interface PositionHistoryEntry {
  fen: string;
  scores: ScoreState;
  moveNotation: string | null;
  crazyhouse?: CrazyhouseState;
  chess960?: Chess960State;
  clockWhiteMs?: number;
  clockBlackMs?: number;
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
  /** Bot difficulty for the White side (botvbot mode). */
  botLevelWhite: BotLevel;
  /** Bot difficulty for the Black side (botvbot mode). */
  botLevelBlack: BotLevel;
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
  /** Crazyhouse reserve state (present only when overlay is enabled). */
  crazyhouse: CrazyhouseState | null;
  /** Chess960 castling state (present only when Chess960 overlay is enabled). */
  chess960: Chess960State | null;
}

// ── Setup Config ─────────────────────────────────────────────────────

export interface GameSetupConfig {
  mode: GameMode;
  botSide: Color;
  botDifficulty: BotLevel;
  /** Bot difficulty for the White side (botvbot only; falls back to botDifficulty). */
  botDifficultyWhite: BotLevel;
  /** Bot difficulty for the Black side (botvbot only; falls back to botDifficulty). */
  botDifficultyBlack: BotLevel;
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
  enableCrazyhouse: boolean;
  enableChess960: boolean;
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
  botDifficultyWhite: 'easy',
  botDifficultyBlack: 'easy',
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
  enableCrazyhouse: false,
  enableChess960: false,
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

export const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Build a frozen MatchConfig from the setup choices. */
export function buildMatchConfig(setup: GameSetupConfig): MatchConfig {
  const clockEnabled = setup.enableClock;
  const chess960Enabled = setup.enableChess960;
  let initialFen = INITIAL_FEN;
  let chess960Index: number | undefined;

  if (chess960Enabled) {
    chess960Index = getRandomChess960Index();
    initialFen = chess960IndexToFen(chess960Index);
  }

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
      enableCrazyhouse: setup.enableCrazyhouse,
      enableChess960: chess960Enabled,
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
    initialFen,
    chess960Index,
  };
}

export const DEFAULT_CONFIG: MatchConfig = buildMatchConfig(DEFAULT_SETUP_CONFIG);
