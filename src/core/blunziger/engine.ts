import { Chess } from 'chess.js';
import type {
  Move,
  Color,
  GameState,
  GameResult,
  ViolationRecord,
  BlunzigerConfig,
  InvalidReportCounts,
  GameMode,
  BotLevel,
  Square,
} from './types';
import { DEFAULT_CONFIG, INITIAL_FEN } from './types';

/**
 * Create the initial game state.
 */
export function createInitialState(
  mode: GameMode = 'hvh',
  config: BlunzigerConfig = DEFAULT_CONFIG,
  botLevel: BotLevel = 'easy',
  botColor: Color = 'b',
): GameState {
  return {
    fen: INITIAL_FEN,
    moveHistory: [],
    sideToMove: 'w',
    pendingViolation: null,
    invalidReports: { w: 0, b: 0 },
    config,
    result: null,
    mode,
    botLevel,
    botColor,
  };
}

/**
 * Get all legal moves from the current position.
 */
export function getLegalMoves(fen: string): Move[] {
  const chess = new Chess(fen);
  return chess.moves({ verbose: true });
}

/**
 * Get all legal moves that give check.
 */
export function getCheckingMoves(fen: string): Move[] {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  return moves.filter((move) => {
    const testChess = new Chess(fen);
    testChess.move(move.san);
    return testChess.inCheck();
  });
}

/**
 * Is this a forced-check turn? (Does the current side have any checking moves?)
 */
export function isForcedCheckTurn(fen: string): boolean {
  return getCheckingMoves(fen).length > 0;
}

/**
 * Detect whether a move constitutes a violation (non-checking move when checking was available).
 */
export function detectViolation(
  fenBeforeMove: string,
  move: Move,
  moveIndex: number,
): ViolationRecord | null {
  const checkingMoves = getCheckingMoves(fenBeforeMove);
  if (checkingMoves.length === 0) {
    return null; // No checking moves were available, no violation
  }

  // Check if the played move is one of the checking moves
  const isCheckingMove = checkingMoves.some(
    (cm) => cm.from === move.from && cm.to === move.to && cm.promotion === move.promotion,
  );

  if (isCheckingMove) {
    return null; // Played a checking move, no violation
  }

  // Determine the side from the FEN
  const chess = new Chess(fenBeforeMove);
  const violatingSide = chess.turn();

  return {
    violatingSide,
    moveIndex,
    fenBeforeMove,
    checkingMoves,
    actualMove: move,
    reportable: true,
  };
}

/**
 * Apply a move with Blunziger rules. Returns a new game state.
 * The move is NOT forced - any legal move is allowed.
 * Violations are detected AFTER the move.
 */
export function applyMoveWithRules(
  state: GameState,
  moveInput: string | { from: Square; to: Square; promotion?: string },
): GameState {
  if (state.result) {
    return state; // Game is over
  }

  const chess = new Chess(state.fen);
  let move: Move;
  try {
    const result = chess.move(moveInput);
    if (!result) {
      return state; // Invalid move
    }
    move = result;
  } catch {
    return state; // Invalid move
  }

  const fenBeforeMove = state.fen;
  const newFen = chess.fen();
  const moveIndex = state.moveHistory.length;

  // Detect if the previous pending violation becomes non-reportable
  // (opponent just made a move instead of reporting)
  let updatedPendingViolation = state.pendingViolation;
  if (updatedPendingViolation && updatedPendingViolation.reportable) {
    // The opponent is now making their move, so the previous violation is no longer reportable
    updatedPendingViolation = { ...updatedPendingViolation, reportable: false };
  }

  // Detect violation for the current move
  const newViolation = detectViolation(fenBeforeMove, move, moveIndex);

  // Check for game end conditions from chess.js
  let result: GameResult | null = null;
  if (chess.isCheckmate()) {
    const winner = state.sideToMove; // The player who just moved wins
    result = { winner, reason: 'checkmate' };
  } else if (chess.isStalemate()) {
    result = { winner: 'draw', reason: 'stalemate' };
  } else if (chess.isDraw()) {
    if (chess.isInsufficientMaterial()) {
      result = { winner: 'draw', reason: 'insufficient-material' };
    } else if (chess.isThreefoldRepetition()) {
      result = { winner: 'draw', reason: 'threefold-repetition' };
    } else {
      result = { winner: 'draw', reason: 'fifty-move-rule' };
    }
  }

  return {
    ...state,
    fen: newFen,
    moveHistory: [...state.moveHistory, move],
    sideToMove: chess.turn(),
    pendingViolation: newViolation,
    result,
  };
}

/**
 * Can the given side report a missed forced-check violation?
 */
export function canReport(state: GameState, reportingSide: Color): boolean {
  if (state.result) return false;
  if (!state.pendingViolation) return false;
  if (!state.pendingViolation.reportable) return false;
  // The reporter must be the opponent of the violator
  if (state.pendingViolation.violatingSide === reportingSide) return false;
  // The reporter must be the current side to move (hasn't moved yet)
  if (state.sideToMove !== reportingSide) return false;
  return true;
}

/**
 * Report a violation. Returns updated game state.
 */
export function reportViolation(state: GameState, reportingSide: Color): GameState {
  if (canReport(state, reportingSide)) {
    // Valid report - the violating player loses
    const violation = state.pendingViolation!;
    return {
      ...state,
      result: {
        winner: reportingSide,
        reason: 'valid-report',
        detail: `${violation.violatingSide === 'w' ? 'White' : 'Black'} missed a forced check. Available checking move(s): ${violation.checkingMoves.map((m) => m.san).join(', ')}`,
      },
      pendingViolation: { ...violation, reportable: false },
    };
  }

  // Invalid report - increment counter
  return incrementInvalidReport(state, reportingSide);
}

/**
 * Increment invalid report counter for a player.
 */
export function incrementInvalidReport(state: GameState, side: Color): GameState {
  const newCounts: InvalidReportCounts = {
    ...state.invalidReports,
    [side]: state.invalidReports[side] + 1,
  };

  const shouldLose = shouldLoseFromInvalidReports(newCounts, side, state.config);

  if (shouldLose) {
    const opponent: Color = side === 'w' ? 'b' : 'w';
    return {
      ...state,
      invalidReports: newCounts,
      result: {
        winner: opponent,
        reason: 'invalid-report-threshold',
        detail: `${side === 'w' ? 'White' : 'Black'} made ${newCounts[side]} invalid report(s), reaching the threshold of ${state.config.invalidReportLossThreshold}.`,
      },
    };
  }

  return {
    ...state,
    invalidReports: newCounts,
  };
}

/**
 * Check if a player should lose due to exceeding invalid report threshold.
 */
export function shouldLoseFromInvalidReports(
  counts: InvalidReportCounts,
  side: Color,
  config: BlunzigerConfig,
): boolean {
  return counts[side] >= config.invalidReportLossThreshold;
}

/**
 * Get the opponent color.
 */
export function opponent(side: Color): Color {
  return side === 'w' ? 'b' : 'w';
}
