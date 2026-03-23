import type { GameSetupConfig, GameResult, PositionHistoryEntry, Move, ViolationReportEntry, MissedCheckEntry, PieceRemovalEntry, TimeReductionEntry, ScoreState, GameMode, VariantMode, GameType } from '../core/blunziger/types';

/** A completed game record stored for analysis. */
export interface GameRecord {
  id: string;
  /** Timestamp when the game was completed. */
  completedAt: number;
  /** The setup config used for this game. */
  config: GameSetupConfig;
  /** The final game result. */
  result: GameResult;
  /** The final FEN position (for thumbnail). */
  finalFen: string;
  /** Total number of moves made. */
  moveCount: number;
  /** Final scores. */
  scores: ScoreState;
  /** Full position history for review. */
  positionHistory: PositionHistoryEntry[];
  /** Full move history for review. */
  moveHistory: Move[];
  /** Violation reports for review. */
  violationReports: ViolationReportEntry[];
  /** Missed checks for review. */
  missedChecks: MissedCheckEntry[];
  /** Piece removals for review. */
  pieceRemovals: PieceRemovalEntry[];
  /** Time reductions for review. */
  timeReductions: TimeReductionEntry[];
}

let counter = 0;

export function createGameRecord(
  config: GameSetupConfig,
  result: GameResult,
  finalFen: string,
  moveCount: number,
  scores: ScoreState,
  positionHistory: PositionHistoryEntry[],
  moveHistory: Move[],
  violationReports: ViolationReportEntry[],
  missedChecks: MissedCheckEntry[],
  pieceRemovals: PieceRemovalEntry[],
  timeReductions: TimeReductionEntry[],
): GameRecord {
  counter += 1;
  return {
    id: `${Date.now()}-${counter}`,
    completedAt: Date.now(),
    config,
    result,
    finalFen,
    moveCount,
    scores,
    positionHistory,
    moveHistory,
    violationReports,
    missedChecks,
    pieceRemovals,
    timeReductions,
  };
}

const MODE_LABELS: Record<GameMode, string> = {
  hvh: 'Human vs Human',
  hvbot: 'Human vs Bot',
  botvbot: 'Bot vs Bot',
};

const VARIANT_LABELS: Record<VariantMode, string> = {
  classic_blunzinger: 'Classic Blunzinger',
  reverse_blunzinger: 'Reverse Blunzinger',
  classic_king_hunt_move_limit: 'King Hunt (Move)',
  classic_king_hunt_given_check_limit: 'King Hunt (Check)',
};

const GAME_TYPE_LABELS: Record<GameType, string> = {
  report_incorrectness: 'Report',
  penalty_on_miss: 'Penalty',
};

export function getGameModeLabel(mode: GameMode): string {
  return MODE_LABELS[mode];
}

export function getVariantLabel(variant: VariantMode): string {
  return VARIANT_LABELS[variant];
}

export function getGameTypeLabel(gameType: GameType): string {
  return GAME_TYPE_LABELS[gameType];
}

export function getResultLabel(result: GameResult): string {
  if (result.winner === 'draw') return 'Draw';
  return `${result.winner === 'w' ? 'White' : 'Black'} wins`;
}
