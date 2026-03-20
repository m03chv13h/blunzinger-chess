import { Chess } from 'chess.js';
import type {
  Move,
  Color,
  GameState,
  GameResult,
  ViolationRecord,
  VariantConfig,
  InvalidReportCounts,
  GameMode,
  BotLevel,
  Square,
  VariantModeId,
} from './types';
import { DEFAULT_CONFIG, INITIAL_FEN } from './types';

/** The four center squares for King of the Hill. */
const HILL_SQUARES: readonly Square[] = ['d4', 'e4', 'd5', 'e5'];

// ── Pure helpers ─────────────────────────────────────────────────────

/**
 * Check whether King of the Hill mode is enabled in the config.
 */
export function isKingOfTheHillEnabled(config: VariantConfig): boolean {
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
 * Detect whether a move constitutes a violation (non-checking move when checking was available).
 * Standard Blunziger logic.
 */
export function detectViolation(
  fenBeforeMove: string,
  move: Move,
  moveIndex: number,
): ViolationRecord | null {
  const checkingMoves = getCheckingMoves(fenBeforeMove);
  if (checkingMoves.length === 0) {
    return null;
  }

  const isCheckingMove = checkingMoves.some(
    (cm) => cm.from === move.from && cm.to === move.to && cm.promotion === move.promotion,
  );

  if (isCheckingMove) {
    return null;
  }

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

// ── State creation ───────────────────────────────────────────────────

/**
 * Create the initial game state.
 */
export function createInitialState(
  mode: GameMode = 'hvh',
  config: VariantConfig = DEFAULT_CONFIG,
  botLevel: BotLevel = 'easy',
  botColor: Color = 'b',
  variantModeId: VariantModeId = 'classic_blunziger',
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
    variantModeId,
    scores: { w: 0, b: 0 },
    clocks: config.enableClock
      ? { whiteMs: config.initialTimeMs, blackMs: config.initialTimeMs, lastTimestamp: null }
      : null,
    extraTurns: { pendingExtraMovesWhite: 0, pendingExtraMovesBlack: 0 },
    plyCount: 0,
  };
}

// ── Core move application ────────────────────────────────────────────

/**
 * Apply a move with variant-aware rules. Returns a new game state.
 *
 * Rule resolution order:
 * 1. Validate move under standard chess legality
 * 2. Handle Reverse Blunziger violation (immediate loss if checking when forbidden)
 * 3. Handle Double Check Pressure (immediate loss if ≥2 checks available and missed)
 * 4. Handle standard Blunziger violation / Penalty extra-turn
 * 5. Update scores (King Hunter)
 * 6. Evaluate termination: checkmate, KOTH, stalemate/draw, move-limit
 * 7. Handle extra-turn state
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

  // ── Reverse Blunziger check ──
  if (cfg.reverseForcedCheck) {
    const checkingMoves = getCheckingMoves(fenBeforeMove);
    if (checkingMoves.length > 0) {
      const nonCheckingMoves = getNonCheckingMoves(fenBeforeMove);
      // If non-checking alternatives exist and the player gave check → violation
      if (nonCheckingMoves.length > 0 && didMoveGiveCheck(fenBeforeMove, move)) {
        return {
          ...state,
          fen: newFen,
          moveHistory: [...state.moveHistory, move],
          sideToMove: chess.turn(),
          plyCount: state.plyCount + 1,
          pendingViolation: null,
          lastReportFeedback: null,
          result: {
            winner: opponentSide,
            reason: 'reverse_blunziger_violation',
            detail: `${movingSide === 'w' ? 'White' : 'Black'} gave check when non-checking moves were available. Reverse Blunziger violation!`,
          },
        };
      }
    }
  }

  // ── Standard Blunziger / Double Check Pressure ──
  // Expire previous pending violation
  let updatedPendingViolation = state.pendingViolation;
  if (updatedPendingViolation && updatedPendingViolation.reportable) {
    updatedPendingViolation = { ...updatedPendingViolation, reportable: false };
  }

  let newViolation: ViolationRecord | null = null;
  let immediateResult: GameResult | null = null;

  if (cfg.enableBlunziger && !cfg.reverseForcedCheck) {
    newViolation = detectViolation(fenBeforeMove, move, moveIndex);

    if (newViolation) {
      // Double Check Pressure: ≥2 checking moves missed → immediate loss
      if (cfg.doubleCheckPressureImmediateLoss && newViolation.checkingMoves.length >= 2) {
        immediateResult = {
          winner: opponentSide,
          reason: 'double_check_pressure_violation',
          detail: `${movingSide === 'w' ? 'White' : 'Black'} missed ${newViolation.checkingMoves.length} checking moves (${newViolation.checkingMoves.map((m) => m.san).join(', ')}). Immediate loss under Double Check Pressure!`,
        };
      }

      // Penalty mode: grant opponent extra turn instead of reportable violation
      if (!immediateResult && cfg.missedCheckPenalty === 'extra_move') {
        newViolation = { ...newViolation, reportable: false };
      }
    }
  }

  // ── Score update (King Hunter) ──
  const newScores = { ...state.scores };
  if (cfg.scoringMode === 'checks_count' && didMoveGiveCheck(fenBeforeMove, move)) {
    newScores[movingSide] = (newScores[movingSide] || 0) + 1;
  }

  const newPlyCount = state.plyCount + 1;

  // ── Termination conditions ──
  let result: GameResult | null = immediateResult;

  if (!result && chess.isCheckmate()) {
    result = { winner: movingSide, reason: 'checkmate' };
  }

  if (!result && isKingOfTheHillEnabled(cfg)) {
    if (didKingReachHill(newFen, movingSide)) {
      result = {
        winner: movingSide,
        reason: 'king_of_the_hill',
        detail: `${movingSide === 'w' ? 'White' : 'Black'}'s king reached a center square!`,
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

  // ── Move-limit check (King Hunter) ──
  if (!result && cfg.moveLimit > 0 && newPlyCount >= cfg.moveLimit * 2) {
    if (newScores.w > newScores.b) {
      result = {
        winner: 'w',
        reason: 'score_limit',
        detail: `Move limit reached. White wins ${newScores.w}–${newScores.b}.`,
      };
    } else if (newScores.b > newScores.w) {
      result = {
        winner: 'b',
        reason: 'score_limit',
        detail: `Move limit reached. Black wins ${newScores.b}–${newScores.w}.`,
      };
    } else {
      result = {
        winner: 'draw',
        reason: 'score_limit_draw',
        detail: `Move limit reached. Tied ${newScores.w}–${newScores.b}.`,
      };
    }
  }

  const effectiveViolation = result ? null : newViolation;

  // ── Extra-turn state (Penalty mode) ──
  let newExtraTurns = { ...state.extraTurns };
  let newClocks = state.clocks;

  // If a violation occurred in penalty mode (and game didn't end), grant opponent extra turn
  if (!result && newViolation && cfg.missedCheckPenalty === 'extra_move') {
    const oppKey = opponentSide === 'w' ? 'pendingExtraMovesWhite' : 'pendingExtraMovesBlack';
    newExtraTurns = { ...newExtraTurns, [oppKey]: newExtraTurns[oppKey] + 1 };

    // ── Clock penalty for missed check (penalty + clock mode) ──
    if (cfg.enableClock && cfg.missedCheckTimePenaltySeconds > 0 && newClocks) {
      const penaltyMs = cfg.missedCheckTimePenaltySeconds * 1000;
      const clockKey = movingSide === 'w' ? 'whiteMs' : 'blackMs';
      const remaining = Math.max(0, newClocks[clockKey] - penaltyMs);
      newClocks = { ...newClocks, [clockKey]: remaining };

      if (remaining <= 0) {
        const sideLabel = movingSide === 'w' ? 'White' : 'Black';
        result = {
          winner: opponentSide,
          reason: 'timeout_penalty',
          detail: `${sideLabel} missed a forced check and lost ${cfg.missedCheckTimePenaltySeconds}s. Clock reached 0.`,
        };
      }
    }
  }

  // Determine effective side to move (may stay same for extra turns)
  let effectiveSideToMove = chess.turn();
  let effectiveFen = newFen;
  if (!result) {
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
    pendingViolation: effectiveViolation,
    lastReportFeedback: null,
    result,
    scores: newScores,
    plyCount: newPlyCount,
    extraTurns: newExtraTurns,
    clocks: newClocks,
  };
}

// ── Reporting ────────────────────────────────────────────────────────

/**
 * Can the given side report a missed forced-check violation?
 * Disabled in penalty mode and reverse mode.
 */
export function canReport(state: GameState, reportingSide: Color): boolean {
  if (state.result) return false;
  if (state.config.missedCheckPenalty === 'extra_move') return false;
  if (state.config.reverseForcedCheck) return false;
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
    const opp: Color = side === 'w' ? 'b' : 'w';
    return {
      ...state,
      invalidReports: newCounts,
      result: {
        winner: opp,
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
  config: VariantConfig,
): boolean {
  return counts[side] >= config.invalidReportLossThreshold;
}

/**
 * Apply timeout result.
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
  };
}

/**
 * Get the opponent color.
 */
export function opponent(side: Color): Color {
  return side === 'w' ? 'b' : 'w';
}
