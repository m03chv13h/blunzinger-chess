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
  CrazyhouseState,
  CrazyhousePieceType,
  PlayerReserve,
  DropMove,
} from './types';
import type { EngineId } from '../engine/types';
import {
  DEFAULT_CONFIG,
  INITIAL_FEN,
  EMPTY_RESERVE,
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

/** Format a drop move as SAN notation (e.g. "N@d4"). */
export function dropMoveToSan(drop: DropMove): string {
  return `${drop.piece.toUpperCase()}@${drop.to}`;
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
 * Determine which piece removals from the given squares would put the
 * target side's king in check (discovered check via removal).
 */
export function getCheckCreatingRemovals(fen: string, targetSide: Color, removableSquares: Square[]): Square[] {
  const chooserSide: Color = targetSide === 'w' ? 'b' : 'w';
  const result: Square[] = [];
  for (const sq of removableSquares) {
    const chess = new Chess(fen);
    chess.remove(sq);
    // Find target king square and check if it's attacked by the chooser's pieces
    const board = chess.board();
    let kingSquare: Square | null = null;
    for (const row of board) {
      for (const cell of row) {
        if (cell && cell.color === targetSide && cell.type === 'k') {
          kingSquare = cell.square as Square;
        }
      }
    }
    if (kingSquare && chess.isAttacked(kingSquare, chooserSide)) {
      result.push(sq);
    }
  }
  return result;
}

/**
 * Select the best piece to remove from the target side (bot heuristic).
 * Respects variant rules: in classic mode, prefers check-creating removals;
 * in reverse mode, avoids them. Within rule-compliant candidates, prefers
 * highest-value piece. Deterministic tie-breaking by square name.
 */
export function selectBestPieceForRemoval(fen: string, targetSide: Color, variantMode?: VariantMode): Square | null {
  const removable = getRemovablePieces(fen, targetSide);
  if (removable.length === 0) return null;

  let candidates = removable;
  if (variantMode) {
    const checkCreating = getCheckCreatingRemovals(fen, targetSide, removable);
    if (isClassicForcedCheck(variantMode)) {
      // Classic: must choose a check-creating removal if one exists
      if (checkCreating.length > 0) candidates = checkCreating;
    } else {
      // Reverse: must avoid check-creating removals if alternatives exist
      const nonCheckCreating = removable.filter((sq) => !checkCreating.includes(sq));
      if (nonCheckCreating.length > 0 && checkCreating.length > 0) candidates = nonCheckCreating;
    }
  }

  const chess = new Chess(fen);
  let bestSquare = candidates[0];
  let bestValue = 0;
  for (const sq of candidates) {
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
 * Variant check rules apply to piece removal: in classic mode the chooser
 * must pick a removal that creates check if one exists; in reverse mode the
 * chooser must avoid creating check if alternatives exist.
 *
 * In penalty_on_miss mode, violations are auto-penalised (additional moves,
 * piece removal, time reduction) exactly like normal-move violations. In
 * report_incorrectness mode, violations are made reportable so the target
 * side can report them.
 *
 * Clock behavior: piece removal does not modify clocks. The clock tick
 * in useGame.ts continues to run for the chooser side (= sideToMove)
 * during the pending-selection phase. This is intentional — the chooser
 * is the player who must take the next required action.
 */
export function applyPieceRemoval(state: GameState, square: Square): GameState {
  if (!state.pendingPieceRemoval) return state;
  const { targetSide, chooserSide, removableSquares, remainingRemovals, triggerMoveIndex } = state.pendingPieceRemoval;

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
        triggerMoveIndex,
      };
    }
  }

  // ── Detect piece-removal check violation ──
  // Variant rules extend to the piece-removal phase: in classic mode the
  // chooser must create a check via removal when possible; in reverse mode
  // the chooser must avoid it.
  //
  // In penalty_on_miss mode the violation is auto-penalised (same as for
  // normal-move violations): additional moves, piece removal, and time
  // reduction penalties are applied to the violating chooser side.
  // In report_incorrectness mode the violation is made reportable so the
  // target side can report it.
  let newPendingViolation = state.pendingViolation;
  let newExtraTurns = state.extraTurns;
  let newClocks = state.clocks;
  let newTimeReductions = state.timeReductions;
  let newMissedChecks = state.missedChecks;
  if (!result) {
    const cfg = state.config;
    const variantMode = cfg.variantMode;
    const checkCreating = getCheckCreatingRemovals(state.fen, targetSide, removableSquares);

    let removalViolation: ViolationRecord | null = null;

    if (isClassicForcedCheck(variantMode)) {
      // Classic: chooser must pick a check-creating removal if one exists
      if (checkCreating.length > 0 && !checkCreating.includes(square)) {
        removalViolation = {
          violatingSide: chooserSide,
          moveIndex: triggerMoveIndex,
          fenBeforeMove: state.fen,
          checkingMoves: [],
          requiredMoves: [],
          reportable: true,
          violationType: 'missed_check_removal',
          severe: false,
          requiredRemovalSquares: checkCreating,
          chosenRemovalSquare: square,
        };
      }
    } else {
      // Reverse: chooser must avoid check-creating removal if alternatives exist
      const nonCheckCreating = removableSquares.filter((sq) => !checkCreating.includes(sq));
      if (checkCreating.includes(square) && nonCheckCreating.length > 0) {
        removalViolation = {
          violatingSide: chooserSide,
          moveIndex: triggerMoveIndex,
          fenBeforeMove: state.fen,
          checkingMoves: [],
          requiredMoves: [],
          reportable: true,
          violationType: 'gave_forbidden_check_removal',
          severe: false,
          requiredRemovalSquares: nonCheckCreating,
          chosenRemovalSquare: square,
        };
      }
    }

    if (removalViolation) {
      if (cfg.gameType === 'penalty_on_miss') {
        // Auto-apply penalties — mirrors the normal-move penalty logic in
        // applyMoveWithRules so the chooser is penalised the same way.
        removalViolation = { ...removalViolation, reportable: false };

        const violatorSide = chooserSide;
        const penaltyOpponent = targetSide;

        // 1. Additional move penalty
        if (cfg.penaltyConfig.enableAdditionalMovePenalty) {
          const count = cfg.penaltyConfig.additionalMoveCount;
          const oppKey = penaltyOpponent === 'w' ? 'pendingExtraMovesWhite' : 'pendingExtraMovesBlack';
          newExtraTurns = { ...newExtraTurns, [oppKey]: newExtraTurns[oppKey] + count };
        }

        // 2. Piece removal penalty (on the violator's own pieces)
        if (!result && cfg.penaltyConfig.enablePieceRemovalPenalty) {
          const count = cfg.penaltyConfig.pieceRemovalCount;
          const violatorRemovable = getRemovablePieces(newFen, violatorSide);
          if (violatorRemovable.length === 0) {
            const label = violatorSide === 'w' ? 'White' : 'Black';
            result = {
              winner: penaltyOpponent,
              reason: 'piece_removal_no_piece_loss',
              detail: `${label} violated during piece removal but has no removable pieces (only the king remains). Immediate loss.`,
            };
          } else {
            newPendingPieceRemoval = {
              targetSide: violatorSide,
              chooserSide: penaltyOpponent,
              removableSquares: violatorRemovable,
              remainingRemovals: count,
              triggerMoveIndex,
            };
          }
        }

        // 3. Time reduction penalty
        if (!result && cfg.penaltyConfig.enableTimeReductionPenalty && cfg.overlays.enableClock && cfg.penaltyConfig.timeReductionSeconds > 0 && newClocks) {
          const penaltyMs = cfg.penaltyConfig.timeReductionSeconds * 1000;
          const clockKey = violatorSide === 'w' ? 'whiteMs' : 'blackMs';
          const remaining = Math.max(0, newClocks[clockKey] - penaltyMs);
          newClocks = { ...newClocks, [clockKey]: remaining };
          newTimeReductions = [...newTimeReductions, { moveIndex: triggerMoveIndex, seconds: cfg.penaltyConfig.timeReductionSeconds }];

          if (remaining <= 0) {
            result = {
              winner: penaltyOpponent,
              reason: 'timeout_penalty',
              detail: `${violatorSide === 'w' ? 'White' : 'Black'} violated during piece removal and lost ${cfg.penaltyConfig.timeReductionSeconds}s. Clock reached 0.`,
            };
            newPendingPieceRemoval = null;
          }
        }
      }
      // else: report_incorrectness → keep reportable: true (default)

      newPendingViolation = removalViolation;
      newMissedChecks = [...state.missedChecks, { moveIndex: triggerMoveIndex, violationType: removalViolation.violationType, availableMoves: removalViolation.requiredRemovalSquares ?? [] }];
    }
  }

  return {
    ...state,
    fen: newFen,
    pendingPieceRemoval: newPendingPieceRemoval,
    pendingViolation: result ? null : newPendingViolation,
    result,
    extraTurns: newExtraTurns,
    clocks: newClocks,
    positionHistory: [...state.positionHistory, { fen: newFen, scores: state.scores, moveNotation: null, ...(newClocks ? { clockWhiteMs: newClocks.whiteMs, clockBlackMs: newClocks.blackMs } : {}) }],
    pieceRemovals: [...state.pieceRemovals, { moveIndex: triggerMoveIndex, pieceType: piece.type, pieceColor: piece.color }],
    missedChecks: newMissedChecks,
    timeReductions: newTimeReductions,
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

// ── Crazyhouse helpers ───────────────────────────────────────────────

/** All valid squares on the board. */
const ALL_SQUARES: Square[] = (() => {
  const sqs: Square[] = [];
  for (const file of 'abcdefgh') {
    for (let rank = 1; rank <= 8; rank++) {
      sqs.push(`${file}${rank}` as Square);
    }
  }
  return sqs;
})();

/**
 * Check whether Crazyhouse overlay is enabled in the config.
 */
export function isCrazyhouseEnabled(config: MatchConfig): boolean {
  return config.overlays.enableCrazyhouse;
}

/**
 * Create the initial crazyhouse state (empty reserves).
 */
export function createCrazyhouseState(): CrazyhouseState {
  return {
    whiteReserve: { ...EMPTY_RESERVE },
    blackReserve: { ...EMPTY_RESERVE },
  };
}

/**
 * Update the crazyhouse reserve after a capture:
 * the captured piece is added to the capturer's reserve.
 */
export function updateReserveAfterCapture(
  ch: CrazyhouseState,
  capturerSide: Color,
  capturedPieceType: string,
): CrazyhouseState {
  if (capturedPieceType === 'k') return ch; // Kings can never be captured in reserve
  const pieceType = capturedPieceType as CrazyhousePieceType;
  const reserveKey = capturerSide === 'w' ? 'whiteReserve' : 'blackReserve';
  return {
    ...ch,
    [reserveKey]: {
      ...ch[reserveKey],
      [pieceType]: ch[reserveKey][pieceType] + 1,
    },
  };
}

/**
 * Update the crazyhouse reserve after a drop:
 * remove one piece of the given type from the dropper's reserve.
 */
export function updateReserveAfterDrop(
  ch: CrazyhouseState,
  dropperSide: Color,
  pieceType: CrazyhousePieceType,
): CrazyhouseState {
  const reserveKey = dropperSide === 'w' ? 'whiteReserve' : 'blackReserve';
  const current = ch[reserveKey][pieceType];
  if (current <= 0) return ch;
  return {
    ...ch,
    [reserveKey]: {
      ...ch[reserveKey],
      [pieceType]: current - 1,
    },
  };
}

/**
 * Get the reserve for a given side.
 */
export function getReserve(ch: CrazyhouseState, side: Color): PlayerReserve {
  return side === 'w' ? ch.whiteReserve : ch.blackReserve;
}

/**
 * Get all empty squares on the board.
 */
function getEmptySquares(fen: string): Square[] {
  const chess = new Chess(fen);
  return ALL_SQUARES.filter((sq) => !chess.get(sq));
}

/**
 * Generate all legal drop moves for the given side from its reserve.
 *
 * Rules:
 * - Cannot drop on occupied square
 * - Pawns cannot be dropped on first or last rank
 * - Drop must not leave own king in check
 */
export function getCrazyhouseDropMoves(
  fen: string,
  ch: CrazyhouseState,
  side: Color,
): DropMove[] {
  const reserve = getReserve(ch, side);
  const emptySquares = getEmptySquares(fen);
  const drops: DropMove[] = [];

  const pieceTypes: CrazyhousePieceType[] = ['p', 'n', 'b', 'r', 'q'];

  for (const pt of pieceTypes) {
    if (reserve[pt] <= 0) continue;

    for (const sq of emptySquares) {
      // Pawn restrictions: cannot drop on first or last rank
      if (pt === 'p') {
        const rank = sq[1];
        if (rank === '1' || rank === '8') continue;
      }

      // Legality: drop must not leave own king in check
      if (doesDropLeaveKingInCheck(fen, side, pt, sq)) continue;

      drops.push({ type: 'drop', piece: pt, to: sq, color: side });
    }
  }

  return drops;
}

/**
 * Get drop squares that are legal for a specific piece type.
 */
export function getLegalDropSquares(
  fen: string,
  ch: CrazyhouseState,
  side: Color,
  pieceType: CrazyhousePieceType,
): Square[] {
  const reserve = getReserve(ch, side);
  if (reserve[pieceType] <= 0) return [];

  const emptySquares = getEmptySquares(fen);
  const squares: Square[] = [];

  for (const sq of emptySquares) {
    if (pieceType === 'p') {
      const rank = sq[1];
      if (rank === '1' || rank === '8') continue;
    }
    if (doesDropLeaveKingInCheck(fen, side, pieceType, sq)) continue;
    squares.push(sq);
  }

  return squares;
}

/**
 * Check whether dropping a piece on a square leaves the dropping side's king in check.
 */
function doesDropLeaveKingInCheck(
  fen: string,
  side: Color,
  pieceType: CrazyhousePieceType,
  square: Square,
): boolean {
  const chess = new Chess(fen);
  // Place the piece
  chess.put({ type: pieceType, color: side }, square);
  // Ensure the turn is set to the opponent (to check if our king is attacked)
  const parts = chess.fen().split(' ');
  const opponentSide: Color = side === 'w' ? 'b' : 'w';
  parts[1] = opponentSide;
  try {
    const testChess = new Chess(parts.join(' '));
    // Find our king
    const board = testChess.board();
    for (const row of board) {
      for (const cell of row) {
        if (cell && cell.type === 'k' && cell.color === side) {
          return testChess.isAttacked(cell.square as Square, opponentSide);
        }
      }
    }
  } catch {
    // Invalid FEN after drop — treat as illegal
    return true;
  }
  return false;
}

/**
 * Check whether a drop move gives check to the opponent.
 */
export function doesDropGiveCheck(
  fen: string,
  side: Color,
  pieceType: CrazyhousePieceType,
  square: Square,
): boolean {
  const chess = new Chess(fen);
  chess.put({ type: pieceType, color: side }, square);
  const opponentSide: Color = side === 'w' ? 'b' : 'w';
  // Set the turn to the opponent to test if they are in check
  const parts = chess.fen().split(' ');
  parts[1] = opponentSide;
  try {
    const testChess = new Chess(parts.join(' '));
    return testChess.inCheck();
  } catch {
    return false;
  }
}

/**
 * Get all drop moves that give check.
 */
export function getCheckingDropMoves(
  fen: string,
  ch: CrazyhouseState,
  side: Color,
): DropMove[] {
  return getCrazyhouseDropMoves(fen, ch, side).filter(
    (drop) => doesDropGiveCheck(fen, side, drop.piece, drop.to),
  );
}

/**
 * Get all drop moves that do NOT give check.
 */
export function getNonCheckingDropMoves(
  fen: string,
  ch: CrazyhouseState,
  side: Color,
): DropMove[] {
  return getCrazyhouseDropMoves(fen, ch, side).filter(
    (drop) => !doesDropGiveCheck(fen, side, drop.piece, drop.to),
  );
}

/**
 * Apply a drop move to the board, returning the new FEN.
 * The turn is swapped to the opponent after the drop.
 */
export function applyDropToFen(
  fen: string,
  side: Color,
  pieceType: CrazyhousePieceType,
  square: Square,
): string {
  const chess = new Chess(fen);
  chess.put({ type: pieceType, color: side }, square);
  // Swap active side, clear en passant, increment halfmove/fullmove
  const parts = chess.fen().split(' ');
  parts[1] = side === 'w' ? 'b' : 'w';
  parts[3] = '-'; // No en passant after drop
  parts[4] = String(parseInt(parts[4]) + 1); // Increment halfmove
  if (side === 'b') {
    parts[5] = String(parseInt(parts[5]) + 1); // Increment fullmove
  }
  return parts.join(' ');
}

/**
 * Apply a crazyhouse drop move with full variant rules.
 * Returns updated GameState, or unchanged state if the drop is illegal.
 */
export function applyDropMoveWithRules(state: GameState, drop: DropMove): GameState {
  if (state.result) return state;
  if (!state.crazyhouse) return state;

  const { fen, sideToMove, crazyhouse: ch } = state;
  if (drop.color !== sideToMove) return state;

  // Validate the piece is in reserve
  const reserve = getReserve(ch, sideToMove);
  if (reserve[drop.piece] <= 0) return state;

  // Validate the target square is empty
  const chess = new Chess(fen);
  if (chess.get(drop.to)) return state;

  // Pawn rank restrictions
  if (drop.piece === 'p') {
    const rank = drop.to[1];
    if (rank === '1' || rank === '8') return state;
  }

  // Validate legality (does not leave king in check)
  if (doesDropLeaveKingInCheck(fen, sideToMove, drop.piece, drop.to)) return state;

  const cfg = state.config;
  const opponentSide: Color = sideToMove === 'w' ? 'b' : 'w';
  const moveIndex = state.moveHistory.length;
  const fenBeforeMove = fen;

  // Apply the drop
  const newFen = applyDropToFen(fen, sideToMove, drop.piece, drop.to);
  const newCh = updateReserveAfterDrop(ch, sideToMove, drop.piece);
  const gaveCheck = doesDropGiveCheck(fen, sideToMove, drop.piece, drop.to);

  // ── Expire previous pending violation ──
  let updatedPendingViolation = state.pendingViolation;
  if (updatedPendingViolation && updatedPendingViolation.reportable) {
    updatedPendingViolation = { ...updatedPendingViolation, reportable: false };
  }

  // ── Detect violation for drop move ──
  const newViolation = detectDropViolation(
    fenBeforeMove,
    drop,
    gaveCheck,
    moveIndex,
    cfg.variantMode,
    cfg.overlays.enableDoubleCheckPressure,
    ch,
    sideToMove,
  );

  // ── Score update (King Hunt) ──
  const newScores = { ...state.scores };
  if (isKingHuntVariant(cfg.variantMode) && gaveCheck) {
    newScores[sideToMove] = (newScores[sideToMove] || 0) + 1;
  }

  const newPlyCount = state.plyCount + 1;
  const sideLabel = (s: Color) => (s === 'w' ? 'White' : 'Black');

  // ── Termination conditions ──
  let result: GameResult | null = null;

  // Check for checkmate/stalemate after drop
  const postChess = new Chess(newFen);
  if (postChess.isCheckmate()) {
    result = { winner: sideToMove, reason: 'checkmate' };
  }

  if (!result && isKingOfTheHillEnabled(cfg)) {
    // Drops can't move kings, but check both sides for completeness
    if (didKingReachHill(newFen, sideToMove)) {
      result = {
        winner: sideToMove,
        reason: 'king_of_the_hill',
        detail: `${sideLabel(sideToMove)}'s king reached a center square!`,
      };
    }
  }

  if (!result) {
    if (postChess.isStalemate()) {
      result = { winner: 'draw', reason: 'stalemate' };
    } else if (postChess.isDraw()) {
      if (postChess.isInsufficientMaterial()) {
        result = { winner: 'draw', reason: 'insufficient-material' };
      } else if (postChess.isThreefoldRepetition()) {
        result = { winner: 'draw', reason: 'threefold-repetition' };
      } else {
        result = { winner: 'draw', reason: 'fifty-move-rule' };
      }
    }
  }

  // King Hunt Given Check Limit
  if (!result && cfg.variantMode === 'classic_king_hunt_given_check_limit') {
    const target = cfg.variantSpecific.kingHuntGivenCheckTarget;
    if (newScores[sideToMove] >= target) {
      result = {
        winner: sideToMove,
        reason: 'king_hunt_given_check_limit',
        detail: `${sideLabel(sideToMove)} reached ${target} given check(s)! Score: White ${newScores.w} – Black ${newScores.b}.`,
      };
    }
  }

  // King Hunt Ply Limit
  if (!result && cfg.variantMode === 'classic_king_hunt_move_limit') {
    if (newPlyCount >= cfg.variantSpecific.kingHuntPlyLimit) {
      if (newScores.w > newScores.b) {
        result = { winner: 'w', reason: 'king_hunt_ply_limit', detail: `Ply limit reached. White wins ${newScores.w}–${newScores.b}.` };
      } else if (newScores.b > newScores.w) {
        result = { winner: 'b', reason: 'king_hunt_ply_limit', detail: `Ply limit reached. Black wins ${newScores.b}–${newScores.w}.` };
      } else {
        result = { winner: 'draw', reason: 'king_hunt_ply_limit_draw', detail: `Ply limit reached. Tied ${newScores.w}–${newScores.b}.` };
      }
    }
  }

  // ── If game is over, stop — do not apply violations or penalties ──
  let violationForState: ViolationRecord | null = result ? null : newViolation;

  // ── Composable penalty / report handling ──
  let newExtraTurns = { ...state.extraTurns };
  let newClocks = state.clocks;
  let pendingPieceRemoval: PendingPieceRemoval | null = null;
  let newTimeReductions = state.timeReductions;

  if (!result && newViolation) {
    if (cfg.gameType === 'report_incorrectness') {
      if (newViolation.severe) {
        result = {
          winner: opponentSide,
          reason: 'double_check_pressure_violation',
          detail: `${sideLabel(sideToMove)} missed ${newViolation.requiredMoves.length + (newViolation.requiredDropMoves?.length ?? 0)} required moves. Immediate loss under Double Check Pressure!`,
        };
        violationForState = null;
      } else {
        violationForState = { ...newViolation, reportable: true };
      }
    } else {
      violationForState = { ...newViolation, reportable: false };

      if (cfg.penaltyConfig.enableAdditionalMovePenalty) {
        const count = cfg.penaltyConfig.additionalMoveCount;
        const oppKey = opponentSide === 'w' ? 'pendingExtraMovesWhite' : 'pendingExtraMovesBlack';
        newExtraTurns = { ...newExtraTurns, [oppKey]: newExtraTurns[oppKey] + count };
      }

      if (!result && cfg.penaltyConfig.enablePieceRemovalPenalty) {
        const count = cfg.penaltyConfig.pieceRemovalCount;
        const removableSquares = getRemovablePieces(newFen, sideToMove);
        if (removableSquares.length === 0) {
          result = {
            winner: opponentSide,
            reason: 'piece_removal_no_piece_loss',
            detail: `${sideLabel(sideToMove)} missed a required move but has no removable pieces. Immediate loss.`,
          };
        } else {
          pendingPieceRemoval = {
            targetSide: sideToMove,
            chooserSide: opponentSide,
            removableSquares,
            remainingRemovals: count,
            triggerMoveIndex: moveIndex,
          };
        }
      }

      if (!result && cfg.penaltyConfig.enableTimeReductionPenalty && cfg.overlays.enableClock && cfg.penaltyConfig.timeReductionSeconds > 0 && newClocks) {
        const penaltyMs = cfg.penaltyConfig.timeReductionSeconds * 1000;
        const clockKey = sideToMove === 'w' ? 'whiteMs' : 'blackMs';
        const remaining = Math.max(0, newClocks[clockKey] - penaltyMs);
        newClocks = { ...newClocks, [clockKey]: remaining };
        newTimeReductions = [...newTimeReductions, { moveIndex, seconds: cfg.penaltyConfig.timeReductionSeconds }];

        if (remaining <= 0) {
          result = {
            winner: opponentSide,
            reason: 'timeout_penalty',
            detail: `${sideLabel(sideToMove)} missed a required move and lost ${cfg.penaltyConfig.timeReductionSeconds}s. Clock reached 0.`,
          };
          pendingPieceRemoval = null;
        }
      }
    }
  }

  // Create a synthetic Move object for the drop to store in move history
  const dropSanNotation = `${drop.piece.toUpperCase()}@${drop.to}`;
  const syntheticMove: Move = {
    color: sideToMove,
    from: drop.to, // drops have no source square; use target
    to: drop.to,
    piece: drop.piece,
    san: dropSanNotation,
    lan: dropSanNotation,
    before: fenBeforeMove,
    after: newFen,
    flags: '',
  };

  // Determine effective side to move (may stay same for extra turns)
  let effectiveSideToMove: Color = opponentSide;
  let effectiveFen = newFen;
  let nextInExtraTurn = false;
  if (!result && !pendingPieceRemoval) {
    const movingSideKey = sideToMove === 'w' ? 'pendingExtraMovesWhite' : 'pendingExtraMovesBlack';
    if (newExtraTurns[movingSideKey] > 0) {
      newExtraTurns = { ...newExtraTurns, [movingSideKey]: newExtraTurns[movingSideKey] - 1 };
      effectiveSideToMove = sideToMove;
      effectiveFen = swapFenTurn(newFen);
      nextInExtraTurn = true;
    }
  }

  return {
    ...state,
    fen: effectiveFen,
    moveHistory: [...state.moveHistory, syntheticMove],
    sideToMove: effectiveSideToMove,
    pendingViolation: result ? null : violationForState,
    lastReportFeedback: null,
    result,
    scores: newScores,
    plyCount: newPlyCount,
    extraTurns: newExtraTurns,
    clocks: newClocks,
    pendingPieceRemoval,
    positionHistory: [...state.positionHistory, { fen: effectiveFen, scores: newScores, moveNotation: dropSanNotation, crazyhouse: newCh, ...(newClocks ? { clockWhiteMs: newClocks.whiteMs, clockBlackMs: newClocks.blackMs } : {}) }],
    missedChecks: newViolation
      ? [...state.missedChecks, { moveIndex, violationType: newViolation.violationType, availableMoves: [...newViolation.requiredMoves.map((m) => m.san), ...(newViolation.requiredDropMoves ?? []).map(dropMoveToSan)] }]
      : state.missedChecks,
    timeReductions: newTimeReductions,
    inExtraTurn: nextInExtraTurn,
    crazyhouse: newCh,
  };
}

/**
 * Detect whether a drop move constitutes a violation under the selected variant mode.
 *
 * This considers BOTH regular moves and drop moves available at the position.
 *
 * Classic / King Hunt variants:
 *   Violation = checking moves exist (regular or drop) but player played a non-checking drop.
 *
 * Reverse Blunzinger:
 *   Violation = checking moves exist, non-checking alternatives exist,
 *   and the player played a checking drop.
 */
function detectDropViolation(
  fenBeforeMove: string,
  _drop: DropMove,
  gaveCheck: boolean,
  moveIndex: number,
  variantMode: VariantMode,
  dcpEnabled: boolean,
  ch: CrazyhouseState,
  side: Color,
): ViolationRecord | null {
  // Get ALL checking moves (regular + drop)
  const regularCheckingMoves = getCheckingMoves(fenBeforeMove);
  const checkingDrops = getCheckingDropMoves(fenBeforeMove, ch, side);
  const totalCheckingCount = regularCheckingMoves.length + checkingDrops.length;

  if (isClassicForcedCheck(variantMode)) {
    if (totalCheckingCount === 0) return null;
    if (gaveCheck) return null;

    // Build required moves list from regular checking moves
    const requiredMoves = regularCheckingMoves;

    return {
      violatingSide: side,
      moveIndex,
      fenBeforeMove,
      checkingMoves: regularCheckingMoves,
      checkingDropMoves: checkingDrops,
      requiredMoves,
      requiredDropMoves: checkingDrops,
      reportable: true,
      violationType: 'missed_check',
      severe: dcpEnabled && totalCheckingCount >= 2,
    };
  } else {
    // Reverse Blunzinger
    if (totalCheckingCount === 0) return null;

    const regularNonCheckingMoves = getNonCheckingMoves(fenBeforeMove);
    const nonCheckingDrops = getNonCheckingDropMoves(fenBeforeMove, ch, side);
    const totalNonCheckingCount = regularNonCheckingMoves.length + nonCheckingDrops.length;

    if (totalNonCheckingCount === 0) return null;
    if (!gaveCheck) return null;

    return {
      violatingSide: side,
      moveIndex,
      fenBeforeMove,
      checkingMoves: regularCheckingMoves,
      checkingDropMoves: checkingDrops,
      requiredMoves: regularNonCheckingMoves,
      requiredDropMoves: nonCheckingDrops,
      reportable: true,
      violationType: 'gave_forbidden_check',
      severe: dcpEnabled && totalNonCheckingCount >= 2,
    };
  }
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
  // En-passant is only valid for the opponent of the side that double-pushed.
  // After swapping the active color for extra turns, the en-passant target
  // is for the wrong side, so clear it.
  parts[3] = '-';
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

/**
 * Detect violation considering BOTH regular moves and drop moves (Crazyhouse).
 *
 * The key difference from detectViolation: checking/non-checking counts include drops.
 * For example, if a drop move can give check, the player has a checking option.
 */
function detectViolationWithDrops(
  fenBeforeMove: string,
  move: Move,
  moveIndex: number,
  variantMode: VariantMode,
  dcpEnabled: boolean,
  ch: CrazyhouseState,
  side: Color,
): ViolationRecord | null {
  const regularCheckingMoves = getCheckingMoves(fenBeforeMove);
  const checkingDrops = getCheckingDropMoves(fenBeforeMove, ch, side);
  const totalCheckingCount = regularCheckingMoves.length + checkingDrops.length;

  if (isClassicForcedCheck(variantMode)) {
    if (totalCheckingCount === 0) return null;

    const isCheckingMove = regularCheckingMoves.some(
      (cm) => cm.from === move.from && cm.to === move.to && cm.promotion === move.promotion,
    );
    if (isCheckingMove) return null;

    return {
      violatingSide: side,
      moveIndex,
      fenBeforeMove,
      checkingMoves: regularCheckingMoves,
      checkingDropMoves: checkingDrops,
      requiredMoves: regularCheckingMoves,
      requiredDropMoves: checkingDrops,
      actualMove: move,
      reportable: true,
      violationType: 'missed_check',
      severe: dcpEnabled && totalCheckingCount >= 2,
    };
  } else {
    // Reverse Blunzinger
    if (totalCheckingCount === 0) return null;

    const regularNonCheckingMoves = getNonCheckingMoves(fenBeforeMove);
    const nonCheckingDrops = getNonCheckingDropMoves(fenBeforeMove, ch, side);
    const totalNonCheckingCount = regularNonCheckingMoves.length + nonCheckingDrops.length;

    if (totalNonCheckingCount === 0) return null;

    const chess = new Chess(fenBeforeMove);
    chess.move(move.san);
    if (!chess.inCheck()) return null;

    return {
      violatingSide: side,
      moveIndex,
      fenBeforeMove,
      checkingMoves: regularCheckingMoves,
      checkingDropMoves: checkingDrops,
      requiredMoves: regularNonCheckingMoves,
      requiredDropMoves: nonCheckingDrops,
      actualMove: move,
      reportable: true,
      violationType: 'gave_forbidden_check',
      severe: dcpEnabled && totalNonCheckingCount >= 2,
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
  engineIdWhite: EngineId = 'heuristic',
  engineIdBlack: EngineId = 'heuristic',
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
    engineIdWhite,
    engineIdBlack,
    scores: { w: 0, b: 0 },
    clocks: config.overlays.enableClock
      ? { whiteMs: config.overlays.initialTimeMs, blackMs: config.overlays.initialTimeMs, lastTimestamp: null }
      : null,
    extraTurns: { pendingExtraMovesWhite: 0, pendingExtraMovesBlack: 0 },
    pendingPieceRemoval: null,
    plyCount: 0,
    positionHistory: [{
      fen: INITIAL_FEN,
      scores: { w: 0, b: 0 },
      moveNotation: null,
      ...(config.overlays.enableClock ? { clockWhiteMs: config.overlays.initialTimeMs, clockBlackMs: config.overlays.initialTimeMs } : {}),
    }],
    violationReports: [],
    missedChecks: [],
    pieceRemovals: [],
    timeReductions: [],
    inExtraTurn: false,
    crazyhouse: config.overlays.enableCrazyhouse ? createCrazyhouseState() : null,
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
 *    - Apply penalties in deterministic order (including during extra turns):
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
  // When Crazyhouse is enabled, drop moves contribute to checking/non-checking
  // move detection for violation purposes.
  const newViolation = state.crazyhouse
    ? detectViolationWithDrops(
        fenBeforeMove,
        move,
        moveIndex,
        cfg.variantMode,
        cfg.overlays.enableDoubleCheckPressure,
        state.crazyhouse,
        movingSide,
      )
    : detectViolation(
        fenBeforeMove,
        move,
        moveIndex,
        cfg.variantMode,
        cfg.overlays.enableDoubleCheckPressure,
      );

  // ── Crazyhouse reserve update ──
  let newCrazyhouse = state.crazyhouse;
  if (newCrazyhouse && move.captured) {
    newCrazyhouse = updateReserveAfterCapture(newCrazyhouse, movingSide, move.captured);
  }

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
  let newTimeReductions = state.timeReductions;

  if (!result && newViolation) {
    if (cfg.gameType === 'report_incorrectness') {
      // DCP overlay: severe miss → immediate loss
      if (newViolation.severe) {
        result = {
          winner: opponentSide,
          reason: 'double_check_pressure_violation',
          detail: `${sideLabel(movingSide)} missed ${newViolation.requiredMoves.length + (newViolation.requiredDropMoves?.length ?? 0)} required moves (${[...newViolation.requiredMoves.map((m) => m.san), ...(newViolation.requiredDropMoves ?? []).map(dropMoveToSan)].join(', ')}). Immediate loss under Double Check Pressure!`,
        };
        violationForState = null;
      } else {
        // Normal reportable violation
        violationForState = { ...newViolation, reportable: true };
      }
    } else {
      // Penalty on Miss — applies to both normal moves and extra turns.
      // Variant rules must be followed during extra turns as well;
      // violations are auto-penalised identically to normal moves.
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
            triggerMoveIndex: moveIndex,
          };
        }
      }

      // 3. Time reduction penalty
      if (!result && cfg.penaltyConfig.enableTimeReductionPenalty && cfg.overlays.enableClock && cfg.penaltyConfig.timeReductionSeconds > 0 && newClocks) {
        const penaltyMs = cfg.penaltyConfig.timeReductionSeconds * 1000;
        const clockKey = movingSide === 'w' ? 'whiteMs' : 'blackMs';
        const remaining = Math.max(0, newClocks[clockKey] - penaltyMs);
        newClocks = { ...newClocks, [clockKey]: remaining };
        newTimeReductions = [...newTimeReductions, { moveIndex, seconds: cfg.penaltyConfig.timeReductionSeconds }];

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
  let nextInExtraTurn = false;
  if (!result && !pendingPieceRemoval) {
    // If the side that just moved has pending extra moves, they keep moving
    // and we consume one extra move in the process
    const movingSideKey = movingSide === 'w' ? 'pendingExtraMovesWhite' : 'pendingExtraMovesBlack';
    if (newExtraTurns[movingSideKey] > 0) {
      newExtraTurns = { ...newExtraTurns, [movingSideKey]: newExtraTurns[movingSideKey] - 1 };
      effectiveSideToMove = movingSide;
      // Swap the active color in the FEN so chess.js accepts the extra move
      effectiveFen = swapFenTurn(newFen);
      nextInExtraTurn = true;
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
    positionHistory: [...state.positionHistory, { fen: effectiveFen, scores: newScores, moveNotation: move.san, crazyhouse: newCrazyhouse ?? undefined, ...(newClocks ? { clockWhiteMs: newClocks.whiteMs, clockBlackMs: newClocks.blackMs } : {}) }],
    missedChecks: newViolation
      ? [...state.missedChecks, { moveIndex, violationType: newViolation.violationType, availableMoves: [...newViolation.requiredMoves.map((m) => m.san), ...(newViolation.requiredDropMoves ?? []).map(dropMoveToSan)] }]
      : state.missedChecks,
    timeReductions: newTimeReductions,
    inExtraTurn: nextInExtraTurn,
    crazyhouse: newCrazyhouse,
  };
}

// ── Reporting ────────────────────────────────────────────────────────

/**
 * Can the given side report a missed violation?
 * Available when a reportable violation exists and the reporting side is
 * the opponent whose turn it is. In Report Incorrectness mode, violations
 * on normal moves are reportable. In Penalty on Miss mode, violations are
 * auto-penalised (including during extra turns), so reporting is not used.
 */
export function canReport(state: GameState, reportingSide: Color): boolean {
  if (state.result) return false;
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
    const isReverse = violation.violationType === 'gave_forbidden_check' || violation.violationType === 'gave_forbidden_check_removal';
    const isRemoval = violation.violationType === 'missed_check_removal' || violation.violationType === 'gave_forbidden_check_removal';

    let detailMsg: string;
    let feedbackMsg: string;
    if (isRemoval) {
      const requiredSquares = violation.requiredRemovalSquares ?? [];
      detailMsg = isReverse
        ? `${violatorLabel} removed a piece that created check when non-check-creating removals were available. Required removal square(s): ${requiredSquares.join(', ')}`
        : `${violatorLabel} missed a removal that would create check. Available check-creating removal square(s): ${requiredSquares.join(', ')}`;
      feedbackMsg = isReverse
        ? 'Correct! The opponent removed a piece that created check when they should have avoided it.'
        : 'Correct! The opponent missed a piece removal that would create check.';
    } else {
      const dropSans = (violation.requiredDropMoves ?? []).map(dropMoveToSan);
      const allRequiredSans = [...violation.requiredMoves.map((m) => m.san), ...dropSans];
      detailMsg = isReverse
        ? `${violatorLabel} gave check when non-checking moves were available. Required non-checking move(s): ${allRequiredSans.join(', ')}`
        : `${violatorLabel} missed a forced check. Available checking move(s): ${allRequiredSans.join(', ')}`;
      feedbackMsg = isReverse
        ? 'Correct! The opponent gave check when they should have avoided it.'
        : 'Correct! The opponent missed a forced check.';
    }

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
