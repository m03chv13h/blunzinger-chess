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

/** The four center squares for King of the Hill. */
const HILL_SQUARES: readonly Square[] = ['d4', 'e4', 'd5', 'e5'];

/**
 * Check whether King of the Hill mode is enabled in the config.
 */
export function isKingOfTheHillEnabled(config: BlunzigerConfig): boolean {
  return config.enableKingOfTheHill;
}

/**
 * Check whether a square is one of the four hill center squares (d4, e4, d5, e5).
 */
export function isHillSquare(square: Square): boolean {
  return (HILL_SQUARES as readonly string[]).includes(square);
}

/**
 * Check whether a side's king currently occupies a hill square.
 */
export function didKingReachHill(fen: string, side: Color): boolean {
  const chess = new Chess(fen);
  const board = chess.board();
  for (const row of board) {
    for (const cell of row) {
      if (cell && cell.type === 'k' && cell.color === side) {
        if (isHillSquare(cell.square as Square)) {
          return true;
        }
      }
    }
  }
  return false;
}

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
    lastReportFeedback: null,
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
 *
 * Rule resolution order:
 * 1. Validate move under standard chess legality
 * 2. Detect whether a forced-check opportunity existed before the move
 * 3. If a non-checking move was played when checking was available, record violation
 * 4. Apply the move
 * 5. Evaluate victory conditions in deterministic order:
 *    a. Checkmate
 *    b. Stalemate / draw conditions
 *    c. King of the Hill center-square victory (if enabled)
 *
 * Important: King of the Hill immediate win takes priority after the move is applied.
 * If the moving player reaches the hill, they win immediately — even if they
 * missed a forced check on that move. No later report can overturn the result.
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
  const movingSide = state.sideToMove;

  // Detect if the previous pending violation becomes non-reportable
  // (opponent just made a move instead of reporting)
  let updatedPendingViolation = state.pendingViolation;
  if (updatedPendingViolation && updatedPendingViolation.reportable) {
    // The opponent is now making their move, so the previous violation is no longer reportable
    updatedPendingViolation = { ...updatedPendingViolation, reportable: false };
  }

  // Detect violation for the current move
  const newViolation = detectViolation(fenBeforeMove, move, moveIndex);

  // Check for game end conditions in deterministic order
  let result: GameResult | null = null;
  if (chess.isCheckmate()) {
    result = { winner: movingSide, reason: 'checkmate' };
  }

  // King of the Hill: immediate win if king reaches center (before draw checks,
  // since KOTH is an active victory condition that overrides draws like
  // insufficient material in a KvK endgame)
  if (!result && isKingOfTheHillEnabled(state.config)) {
    if (didKingReachHill(newFen, movingSide)) {
      result = {
        winner: movingSide,
        reason: 'king_of_the_hill',
        detail: `${movingSide === 'w' ? 'White' : 'Black'}'s king reached a center square!`,
      };
    }
  }

  // Draw conditions (only if no victory has occurred)
  if (!result) {
    if (chess.isStalemate()) {
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
  }

  // If the game ends immediately (including KOTH win), no pending violation matters
  const effectiveViolation = result ? null : newViolation;

  return {
    ...state,
    fen: newFen,
    moveHistory: [...state.moveHistory, move],
    sideToMove: chess.turn(),
    pendingViolation: effectiveViolation,
    lastReportFeedback: null,
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
      lastReportFeedback: {
        valid: true,
        message: 'Correct! The opponent missed a forced check.',
      },
    };
  }

  // Invalid report - increment counter
  const newCounts: InvalidReportCounts = {
    ...state.invalidReports,
    [reportingSide]: state.invalidReports[reportingSide] + 1,
  };

  const shouldLose = shouldLoseFromInvalidReports(newCounts, reportingSide, state.config);
  const sideLabel = reportingSide === 'w' ? 'White' : 'Black';

  if (shouldLose) {
    const opponentSide: Color = reportingSide === 'w' ? 'b' : 'w';
    return {
      ...state,
      invalidReports: newCounts,
      result: {
        winner: opponentSide,
        reason: 'invalid-report-threshold',
        detail: `${sideLabel} made ${newCounts[reportingSide]} invalid report(s), reaching the threshold of ${state.config.invalidReportLossThreshold}.`,
      },
      lastReportFeedback: {
        valid: false,
        message: `Wrong! There was no missed check to report. ${sideLabel} loses due to reaching the invalid report threshold.`,
      },
    };
  }

  return {
    ...state,
    invalidReports: newCounts,
    lastReportFeedback: {
      valid: false,
      message: `Wrong! There was no missed check to report. (${sideLabel}: ${newCounts[reportingSide]}/${state.config.invalidReportLossThreshold} invalid reports)`,
    },
  };
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
