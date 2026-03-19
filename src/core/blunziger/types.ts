import type { Square, Move, Color } from 'chess.js';

export type { Square, Move, Color };

export type GameMode = 'hvh' | 'hvbot' | 'botvbot';
export type BotLevel = 'easy' | 'medium' | 'hard';
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
  | 'king_of_the_hill';

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

export interface BlunzigerConfig {
  invalidReportLossThreshold: number;
  enableKingOfTheHill: boolean;
}

export interface InvalidReportCounts {
  w: number;
  b: number;
}

export interface ReportFeedback {
  valid: boolean;
  message: string;
}

export interface GameState {
  fen: string;
  moveHistory: Move[];
  sideToMove: Color;
  pendingViolation: ViolationRecord | null;
  invalidReports: InvalidReportCounts;
  config: BlunzigerConfig;
  result: GameResult | null;
  lastReportFeedback: ReportFeedback | null;
  mode: GameMode;
  botLevel: BotLevel;
  botColor: Color;
}

export const DEFAULT_CONFIG: BlunzigerConfig = {
  invalidReportLossThreshold: 2,
  enableKingOfTheHill: false,
};

export const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
