import { Chess } from 'chess.js';
import type {
  Move,
  Color,
  GameState,
  GameResult,
  ViolationRecord,
  MatchConfig,
  InvalidReportCounts,
  GameMode,
  BotLevel,
  Square,
  VariantMode,
  PendingPieceRemoval,
} from './types';
import {
  DEFAULT_CONFIG,
  INITIAL_FEN,
  isClassicForcedCheck,
  isKingHuntVariant,
} from './types';

/** The four center squares for King of the Hill. */
const HILL_SQUARES: readonly Square[] = ['d4', 'e4', 'd5', 'e5'];

// ── Pure helpers ─────────────────────────────────────────────────────

/**
 * Check whether King of the Hill mode is enabled in the config.
 */
export function isKingOfTheHillEnabled(config: MatchConfig): boolean {
  return config.overlays.enableKingOfTheHill;
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
 * Get all legal moves that do NOT give check.
 */
export function getNonCheckingMoves(fen: string): Move[] {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  return moves.filter((move) => {
    const testChess = new Chess(fen);
    testChess.move(move.san);
    return !testChess.inCheck();
  });
}

/**
 * Get squares containing pieces of the given side that can be removed (excludes king).
 */
export function getRemovablePieces(fen: string, side: Color): Square[] {
  const chess = new Chess(fen);
  const board = chess.board();
  const squares: Square[] = [];
  for (const row of board) {
    for (const cell of row) {
      if (cell && cell.color === side && cell.type !== 'k') {
        squares.push(cell.square as Square);
      }
    }
  }
  return squares;
}

/** Piece values for removal heuristic (prefer removing highest-value pieces). */
const REMOVAL_PIECE_VALUES: Record<string, number> = {
  q: 9, r: 5, b: 3, n: 3, p: 1,
};

/**
 * Select the best piece to remove from the target side (bot heuristic).
 * Prefers highest-value piece. Deterministic tie-breaking by square name.
 */
export function selectBestPieceForRemoval(fen: string, targetSide: Color): Square | null {
  const removable = getRemovablePieces(fen, targetSide);
  if (removable.length === 0) return null;
  const chess = new Chess(fen);
  let bestSquare = removable[0];
  let bestValue = 0;
  for (const sq of removable) {
    const piece = chess.get(sq);
    if (piece) {
      const val = REMOVAL_PIECE_VALUES[piece.type] ?? 0;
      if (val > bestValue || (val === bestValue && sq < bestSquare)) {
        bestValue = val;
        bestSquare = sq;
      }
    }
  }
  return bestSquare;
}

/**
 * Remove a piece from the board at the given square.
 * Returns a new game state with the piece removed.
 * If more removals remain, keeps the pending piece removal state.
 * If the removal leaves the game in a terminal state, that is evaluated.
 *
 * Clock behavior: piece removal does not modify clocks. The clock tick
 * in useGame.ts continues to run for the chooser side (= sideToMove)
 * during the pending-selection phase. This is intentional — the chooser
 * is the player who must take the next required action.
 */
export function applyPieceRemoval(state: GameState, square: Square): GameState {
  if (!state.pendingPieceRemoval) return state;
  const { targetSide, chooserSide, removableSquares, remainingRemovals } = state.pendingPieceRemoval;

  // Validate the square is in the removable list
  if (!removableSquares.includes(square)) return state;

  const chess = new Chess(state.fen);
  const piece = chess.get(square);
  if (!piece || piece.color !== targetSide || piece.type === 'k') return state;

  chess.remove(square);
  const newFen = chess.fen();

  let result: GameResult | null = state.result;
  let newPendingPieceRemoval: PendingPieceRemoval | null = null;

  // Check if the removal creates a terminal condition
  if (!result) {
    const postChess = new Chess(newFen);
    if (postChess.isCheckmate()) {
      result = { winner: opponent(targetSide), reason: 'checkmate' };
    } else if (postChess.isStalemate()) {
      result = { winner: 'draw', reason: 'stalemate' };
    } else if (postChess.isDraw()) {
      if (postChess.isInsufficientMaterial()) {
        result = { winner: 'draw', reason: 'insufficient-material' };
      }
    }
  }

  // If more removals needed and game not over
  if (!result && remainingRemovals > 1) {
    const updatedRemovable = getRemovablePieces(newFen, targetSide);
    if (updatedRemovable.length === 0) {
      const sideLabel = targetSide === 'w' ? 'White' : 'Black';
      result = {
        winner: chooserSide,
        reason: 'piece_removal_no_piece_loss',
        detail: `${sideLabel} has no more removable pieces (only the king remains). Immediate loss.`,
      };
    } else {
      newPendingPieceRemoval = {
        targetSide,
        chooserSide,
        removableSquares: updatedRemovable,
        remainingRemovals: remainingRemovals - 1,
      };
    }
  }

  return {
    ...state,
    fen: newFen,
    pendingPieceRemoval: newPendingPieceRemoval,
    result,
    positionHistory: [...state.positionHistory, { fen: newFen, scores: state.scores, moveNotation: null }],
  };
}

/**
 * Is this a forced-check turn? (Does the current side have any checking moves?)
 */
export function isForcedCheckTurn(fen: string): boolean {
  return getCheckingMoves(fen).length > 0;
}

/**
 * Is this a reverse-forced state? (checking moves exist, so the player must AVOID check)
 */
export function isReverseForcedState(fen: string): boolean {
  return getCheckingMoves(fen).length > 0;
}

/**
 * Did a move result in check?
 */
function didMoveGiveCheck(fenBefore: string, move: Move): boolean {
  const chess = new Chess(fenBefore);
  chess.move(move.san);
  return chess.inCheck();
}

/**
 * Swap the active color in a FEN string (w↔b).
 * Used for extra-turn handling where the same side moves twice consecutively.
 */
function swapFenTurn(fen: string): string {
  const parts = fen.split(' ');
  parts[1] = parts[1] === 'w' ? 'b' : 'w';
  return parts.join(' ');
}

// ── Violation detection ──────────────────────────────────────────────

/**
 * Detect whether a move constitutes a violation under the selected variant mode.
 *
 * Classic / King Hunt variants:
 *   Violation = checking moves exist but player did not play one.
 *
 * Reverse Blunzinger:
 *   Violation = checking moves exist, non-checking alternatives exist,
 *   and the player gave check.
 */
export function detectViolation(
  fenBeforeMove: string,
  move: Move,
  moveIndex: number,
  variantMode: VariantMode,
  dcpEnabled: boolean,
): ViolationRecord | null {
  const checkingMoves = getCheckingMoves(fenBeforeMove);

  if (isClassicForcedCheck(variantMode)) {
    // Classic / King Hunt: must play checking move if available
    if (checkingMoves.length === 0) return null;

    const isCheckingMove = checkingMoves.some(
      (cm) => cm.from === move.from && cm.to === move.to && cm.promotion === move.promotion,
    );
    if (isCheckingMove) return null;

    const chess = new Chess(fenBeforeMove);
    const violatingSide = chess.turn();

    return {
      violatingSide,
      moveIndex,
      fenBeforeMove,
      checkingMoves,
      requiredMoves: checkingMoves,
      actualMove: move,
      reportable: true,
      violationType: 'missed_check',
      severe: dcpEnabled && checkingMoves.length >= 2,
    };
  } else {
    // Reverse Blunzinger: must avoid giving check if non-checking moves exist
    if (checkingMoves.length === 0) return null;

    const nonCheckingMoves = getNonCheckingMoves(fenBeforeMove);
    // If ALL legal moves give check, any move is allowed
    if (nonCheckingMoves.length === 0) return null;

    // Check if the player gave check (violation)
    if (!didMoveGiveCheck(fenBeforeMove, move)) return null;

    const chess = new Chess(fenBeforeMove);
    const violatingSide = chess.turn();

    return {
      violatingSide,
      moveIndex,
      fenBeforeMove,
      checkingMoves,
      requiredMoves: nonCheckingMoves,
      actualMove: move,
      reportable: true,
      violationType: 'gave_forbidden_check',
      severe: dcpEnabled && nonCheckingMoves.length >= 2,
    };
  }
}

// ── State creation ───────────────────────────────────────────────────

/**
 * Create the initial game state.
 */
export function createInitialState(
  mode: GameMode = 'hvh',
  config: MatchConfig = DEFAULT_CONFIG,
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
    scores: { w: 0, b: 0 },
    clocks: config.overlays.enableClock
      ? { whiteMs: config.overlays.initialTimeMs, blackMs: config.overlays.initialTimeMs, lastTimestamp: null }
      : null,
    extraTurns: { pendingExtraMovesWhite: 0, pendingExtraMovesBlack: 0 },
    pendingPieceRemoval: null,
    plyCount: 0,
    positionHistory: [{ fen: INITIAL_FEN, scores: { w: 0, b: 0 }, moveNotation: null }],
    violationReports: [],
    missedChecks: [],
  };
}

// ── Core move application ────────────────────────────────────────────

/**
 * Apply a move with variant-aware rules. Returns a new game state.
 *
 * Rule resolution order (authoritative precedence):
 * 1. Validate move under standard chess legality
 * 2. Detect violation based on variant mode
 * 3. Update scores (King Hunt)
 * 4. Evaluate immediate terminal conditions:
 *    - checkmate
 *    - King of the Hill (if enabled)
 *    - stalemate / draw
 *    - King Hunt given-check-limit immediate win (if applicable)
 *    - King Hunt ply-limit outcome (if applicable)
 * 5. If game over: stop — do not apply report or penalties
 * 6. If violation and game type is Report Incorrectness:
 *    - DCP overlay + severe → immediate loss
 *    - else → create reportable miss state
 * 7. If violation and game type is Penalty on Miss:
 *    - apply penalties in deterministic order:
 *      a. Additional move (opponent gets extra consecutive turns)
 *      b. Piece removal (pending selection by opponent)
 *      c. Time reduction (violator's clock reduced; if ≤0 → immediate loss)
 * 8. If penalty effects create terminal condition: resolve and end
 * 9. Handle extra-turn state (only when no pending piece removal)
 *
 * Clock interaction:
 * - This pure function does NOT manage wall-clock time; it only applies
 *   the time-reduction penalty to the clocks in state.
 * - The caller (useGame.ts) is responsible for committing elapsed time
 *   before calling this function and resetting lastTimestamp afterward.
 * - When pending piece removal is set, extra-turn consumption is deferred
 *   until after piece removal completes. The chooser (opponent) becomes
 *   sideToMove, and their clock should run during the selection phase.
 */
export function applyMoveWithRules(
  state: GameState,
  moveInput: string | { from: Square; to: Square; promotion?: string },
): GameState {
  if (state.result) {
    return state;
  }

  const chess = new Chess(state.fen);
  let move: Move;
  try {
    const result = chess.move(moveInput);
    if (!result) {
      return state;
    }
    move = result;
  } catch {
    return state;
  }

  const fenBeforeMove = state.fen;
  const newFen = chess.fen();
  const moveIndex = state.moveHistory.length;
  const movingSide = state.sideToMove;
  const opponentSide: Color = movingSide === 'w' ? 'b' : 'w';
  const cfg = state.config;

  // ── Expire previous pending violation ──
  let updatedPendingViolation = state.pendingViolation;
  if (updatedPendingViolation && updatedPendingViolation.reportable) {
    updatedPendingViolation = { ...updatedPendingViolation, reportable: false };
  }

  // ── Detect violation ──
  const newViolation = detectViolation(
    fenBeforeMove,
    move,
    moveIndex,
    cfg.variantMode,
    cfg.overlays.enableDoubleCheckPressure,
  );

  // ── Score update (King Hunt) ──
  const newScores = { ...state.scores };
  if (isKingHuntVariant(cfg.variantMode) && didMoveGiveCheck(fenBeforeMove, move)) {
    newScores[movingSide] = (newScores[movingSide] || 0) + 1;
  }

  const newPlyCount = state.plyCount + 1;
  const sideLabel = (s: Color) => (s === 'w' ? 'White' : 'Black');

  // ── Termination conditions ──
  let result: GameResult | null = null;

  if (chess.isCheckmate()) {
    result = { winner: movingSide, reason: 'checkmate' };
  }

  if (!result && isKingOfTheHillEnabled(cfg)) {
    if (didKingReachHill(newFen, movingSide)) {
      result = {
        winner: movingSide,
        reason: 'king_of_the_hill',
        detail: `${sideLabel(movingSide)}'s king reached a center square!`,
      };
    }
  }

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

  // ── King Hunt Given Check Limit ──
  if (!result && cfg.variantMode === 'classic_king_hunt_given_check_limit') {
    const target = cfg.variantSpecific.kingHuntGivenCheckTarget;
    if (newScores[movingSide] >= target) {
      result = {
        winner: movingSide,
        reason: 'king_hunt_given_check_limit',
        detail: `${sideLabel(movingSide)} reached ${target} given check(s)! Score: White ${newScores.w} – Black ${newScores.b}.`,
      };
    }
  }

  // ── King Hunt Ply Limit ──
  if (!result && cfg.variantMode === 'classic_king_hunt_move_limit') {
    if (newPlyCount >= cfg.variantSpecific.kingHuntPlyLimit) {
      if (newScores.w > newScores.b) {
        result = {
          winner: 'w',
          reason: 'king_hunt_ply_limit',
          detail: `Ply limit reached. White wins ${newScores.w}–${newScores.b}.`,
        };
      } else if (newScores.b > newScores.w) {
        result = {
          winner: 'b',
          reason: 'king_hunt_ply_limit',
          detail: `Ply limit reached. Black wins ${newScores.b}–${newScores.w}.`,
        };
      } else {
        result = {
          winner: 'draw',
          reason: 'king_hunt_ply_limit_draw',
          detail: `Ply limit reached. Tied ${newScores.w}–${newScores.b}.`,
        };
      }
    }
  }

  // ── If game is over, stop — do not apply violations or penalties ──
  let violationForState: ViolationRecord | null = result ? null : newViolation;

  // ── Composable penalty / report handling ──
  let newExtraTurns = { ...state.extraTurns };
  let newClocks = state.clocks;
  let pendingPieceRemoval: PendingPieceRemoval | null = null;

  if (!result && newViolation) {
    if (cfg.gameType === 'report_incorrectness') {
      // DCP overlay: severe miss → immediate loss
      if (newViolation.severe) {
        result = {
          winner: opponentSide,
          reason: 'double_check_pressure_violation',
          detail: `${sideLabel(movingSide)} missed ${newViolation.requiredMoves.length} required moves (${newViolation.requiredMoves.map((m) => m.san).join(', ')}). Immediate loss under Double Check Pressure!`,
        };
        violationForState = null;
      } else {
        // Normal reportable violation
        violationForState = { ...newViolation, reportable: true };
      }
    } else {
      // Penalty on Miss
      violationForState = { ...newViolation, reportable: false };

      // 1. Additional move penalty
      if (cfg.penaltyConfig.enableAdditionalMovePenalty) {
        const count = cfg.penaltyConfig.additionalMoveCount;
        const oppKey = opponentSide === 'w' ? 'pendingExtraMovesWhite' : 'pendingExtraMovesBlack';
        newExtraTurns = { ...newExtraTurns, [oppKey]: newExtraTurns[oppKey] + count };
      }

      // 2. Piece removal penalty
      if (!result && cfg.penaltyConfig.enablePieceRemovalPenalty) {
        const count = cfg.penaltyConfig.pieceRemovalCount;
        const removableSquares = getRemovablePieces(newFen, movingSide);
        if (removableSquares.length === 0) {
          // No removable pieces → violator loses immediately
          result = {
            winner: opponentSide,
            reason: 'piece_removal_no_piece_loss',
            detail: `${sideLabel(movingSide)} missed a required move but has no removable pieces (only the king remains). Immediate loss.`,
          };
        } else {
          pendingPieceRemoval = {
            targetSide: movingSide,
            chooserSide: opponentSide,
            removableSquares,
            remainingRemovals: count,
          };
        }
      }

      // 3. Time reduction penalty
      if (!result && cfg.penaltyConfig.enableTimeReductionPenalty && cfg.overlays.enableClock && cfg.penaltyConfig.timeReductionSeconds > 0 && newClocks) {
        const penaltyMs = cfg.penaltyConfig.timeReductionSeconds * 1000;
        const clockKey = movingSide === 'w' ? 'whiteMs' : 'blackMs';
        const remaining = Math.max(0, newClocks[clockKey] - penaltyMs);
        newClocks = { ...newClocks, [clockKey]: remaining };

        if (remaining <= 0) {
          result = {
            winner: opponentSide,
            reason: 'timeout_penalty',
            detail: `${sideLabel(movingSide)} missed a required move and lost ${cfg.penaltyConfig.timeReductionSeconds}s. Clock reached 0.`,
          };
          pendingPieceRemoval = null;
        }
      }
    }
  }

  // Determine effective side to move (may stay same for extra turns)
  let effectiveSideToMove = chess.turn();
  let effectiveFen = newFen;
  if (!result && !pendingPieceRemoval) {
    // If the side that just moved has pending extra moves, they keep moving
    // and we consume one extra move in the process
    const movingSideKey = movingSide === 'w' ? 'pendingExtraMovesWhite' : 'pendingExtraMovesBlack';
    if (newExtraTurns[movingSideKey] > 0) {
      newExtraTurns = { ...newExtraTurns, [movingSideKey]: newExtraTurns[movingSideKey] - 1 };
      effectiveSideToMove = movingSide;
      // Swap the active color in the FEN so chess.js accepts the extra move
      effectiveFen = swapFenTurn(newFen);
    }
  }

  return {
    ...state,
    fen: effectiveFen,
    moveHistory: [...state.moveHistory, move],
    sideToMove: effectiveSideToMove,
    pendingViolation: result ? null : violationForState,
    lastReportFeedback: null,
    result,
    scores: newScores,
    plyCount: newPlyCount,
    extraTurns: newExtraTurns,
    clocks: newClocks,
    pendingPieceRemoval,
    positionHistory: [...state.positionHistory, { fen: effectiveFen, scores: newScores, moveNotation: move.san }],
    missedChecks: newViolation
      ? [...state.missedChecks, { moveIndex, violationType: newViolation.violationType }]
      : state.missedChecks,
  };
}

// ── Reporting ────────────────────────────────────────────────────────

/**
 * Can the given side report a missed violation?
 * Only available when game type is Report Incorrectness and a reportable violation exists.
 */
export function canReport(state: GameState, reportingSide: Color): boolean {
  if (state.result) return false;
  if (state.config.gameType !== 'report_incorrectness') return false;
  if (!state.pendingViolation) return false;
  if (!state.pendingViolation.reportable) return false;
  if (state.pendingViolation.violatingSide === reportingSide) return false;
  if (state.sideToMove !== reportingSide) return false;
  return true;
}

/**
 * Report a violation. Returns updated game state.
 */
export function reportViolation(state: GameState, reportingSide: Color): GameState {
  if (canReport(state, reportingSide)) {
    const violation = state.pendingViolation!;
    const violatorLabel = violation.violatingSide === 'w' ? 'White' : 'Black';
    const isReverse = violation.violationType === 'gave_forbidden_check';

    const detailMsg = isReverse
      ? `${violatorLabel} gave check when non-checking moves were available. Required non-checking move(s): ${violation.requiredMoves.map((m) => m.san).join(', ')}`
      : `${violatorLabel} missed a forced check. Available checking move(s): ${violation.requiredMoves.map((m) => m.san).join(', ')}`;

    const feedbackMsg = isReverse
      ? 'Correct! The opponent gave check when they should have avoided it.'
      : 'Correct! The opponent missed a forced check.';

    const reportEntry = { moveIndex: violation.moveIndex, reportingSide, valid: true };

    return {
      ...state,
      result: {
        winner: reportingSide,
        reason: 'valid-report',
        detail: detailMsg,
      },
      pendingViolation: { ...violation, reportable: false },
      lastReportFeedback: {
        valid: true,
        message: feedbackMsg,
      },
      violationReports: [...state.violationReports, reportEntry],
    };
  }

  const newCounts: InvalidReportCounts = {
    ...state.invalidReports,
    [reportingSide]: state.invalidReports[reportingSide] + 1,
  };

  const shouldLose = shouldLoseFromInvalidReports(newCounts, reportingSide, state.config);
  const sideLabel = reportingSide === 'w' ? 'White' : 'Black';

  const reportEntry = {
    moveIndex: state.moveHistory.length - 1,
    reportingSide,
    valid: false,
  };

  if (shouldLose) {
    const opponentSide: Color = reportingSide === 'w' ? 'b' : 'w';
    return {
      ...state,
      invalidReports: newCounts,
      result: {
        winner: opponentSide,
        reason: 'invalid-report-threshold',
        detail: `${sideLabel} made ${newCounts[reportingSide]} invalid report(s), reaching the threshold of ${state.config.reportConfig.invalidReportLossThreshold}.`,
      },
      lastReportFeedback: {
        valid: false,
        message: `Wrong! There was no violation to report. ${sideLabel} loses due to reaching the invalid report threshold.`,
      },
      violationReports: [...state.violationReports, reportEntry],
    };
  }

  return {
    ...state,
    invalidReports: newCounts,
    lastReportFeedback: {
      valid: false,
      message: `Wrong! There was no violation to report. (${sideLabel}: ${newCounts[reportingSide]}/${state.config.reportConfig.invalidReportLossThreshold} invalid reports)`,
    },
    violationReports: [...state.violationReports, reportEntry],
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
    const opp: Color = side === 'w' ? 'b' : 'w';
    return {
      ...state,
      invalidReports: newCounts,
      result: {
        winner: opp,
        reason: 'invalid-report-threshold',
        detail: `${side === 'w' ? 'White' : 'Black'} made ${newCounts[side]} invalid report(s), reaching the threshold of ${state.config.reportConfig.invalidReportLossThreshold}.`,
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
  config: MatchConfig,
): boolean {
  return counts[side] >= config.reportConfig.invalidReportLossThreshold;
}

/**
 * Apply timeout result.
 *
 * When the game ends via timeout, all pending actions (piece removal,
 * reportable violations) are cleared — the game is over.
 */
export function applyTimeout(state: GameState, losingSide: Color): GameState {
  if (state.result) return state;
  const winner: Color = losingSide === 'w' ? 'b' : 'w';
  return {
    ...state,
    result: {
      winner,
      reason: 'timeout',
      detail: `${losingSide === 'w' ? 'White' : 'Black'} ran out of time.`,
    },
    pendingPieceRemoval: null,
    pendingViolation: null,
  };
}

/**
 * Get the opponent color.
 */
export function opponent(side: Color): Color {
  return side === 'w' ? 'b' : 'w';
}
