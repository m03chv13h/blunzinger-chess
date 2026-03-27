/**
 * Blunznforön bot — variant-aware position evaluation.
 *
 * Evaluates positions from the perspective of the side to move.
 * Combines:
 * - Board material balance
 * - Mobility (legal move count)
 * - King safety
 * - Check pressure (variant-specific)
 * - Drop pressure (Crazyhouse)
 * - Forced-rule pressure
 * - Penalty risk
 * - King Hunt progress
 * - Hill pressure
 * - Clock pressure
 * - Reserve material (Crazyhouse)
 */

import { Chess } from 'chess.js';
import type { Color } from '../../blunziger/types';
import {
  isClassicForcedCheck,
  isReverseForcedCheckMode,
  isKingHuntVariant,
} from '../../blunziger/types';
import {
  getCheckingMoves,
  getNonCheckingMoves,
  getLegalMoves,
  isHillSquare,
} from '../../blunziger/engine';
import { evaluateReserves, evaluateKingVulnerabilityToDrops } from './crazyhouse';
import { evaluateKingHuntMoveLimit, evaluateKingHuntGivenCheckLimit } from './kingHunt';
import { evaluateClockPressure } from './clock';
import type { SearchContext } from './types';

// ── Piece values ─────────────────────────────────────────────────────

const PIECE_CP: Record<string, number> = {
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 0,
};

// ── Piece-square tables (simplified, from White's perspective) ────────
// Encourage good piece placement: knights in center, bishops on diagonals, etc.

const PAWN_TABLE = [
   0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0,
];

const KNIGHT_TABLE = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50,
];

const BISHOP_TABLE = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20,
];

const PST: Record<string, number[]> = {
  p: PAWN_TABLE,
  n: KNIGHT_TABLE,
  b: BISHOP_TABLE,
};

/**
 * Get piece-square table bonus for a piece at a given position.
 */
function pstBonus(pieceType: string, file: number, rank: number, color: Color): number {
  const table = PST[pieceType];
  if (!table) return 0;
  // Tables are from White's perspective; flip for Black
  const r = color === 'w' ? 7 - rank : rank;
  return table[r * 8 + file] * 0.5; // Scale down to not dominate
}

// ── Main evaluation ──────────────────────────────────────────────────

/**
 * Evaluate a position from the perspective of the given side.
 *
 * Positive = good for `perspective`, negative = bad.
 * This is a leaf-node evaluation used by the search.
 */
export function evaluatePosition(
  fen: string,
  perspective: Color,
  ctx: SearchContext,
  whiteMs: number = 0,
  blackMs: number = 0,
): number {
  const chess = new Chess(fen);

  // Terminal states
  if (chess.isCheckmate()) {
    // The side to move is checkmated
    const matedSide = chess.turn() as Color;
    return matedSide === perspective ? -100000 : 100000;
  }
  if (chess.isStalemate() || chess.isDraw()) {
    return 0;
  }

  let score = 0;
  const board = chess.board();
  const turn = chess.turn() as Color;

  // ── 1. Material + Piece-Square Tables ──────────────────────────────
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const cell = board[7 - rank][file];
      if (cell) {
        const materialValue = PIECE_CP[cell.type] ?? 0;
        const pst = pstBonus(cell.type, file, rank, cell.color);
        const pieceScore = materialValue + pst;
        score += cell.color === perspective ? pieceScore : -pieceScore;
      }
    }
  }

  // ── 2. Mobility (use current side's move count only — skip opponent for speed)
  const currentMoves = chess.moves().length;
  const mobilityBonus = turn === perspective ? currentMoves * 3 : -currentMoves * 3;
  score += mobilityBonus;

  // ── 3. King Safety (basic pawn shield) ─────────────────────────────
  score += evaluateKingSafety(board, perspective);
  score -= evaluateKingSafety(board, perspective === 'w' ? 'b' : 'w');

  // ── 4. Check bonus (detect from current position — cheap since we have moves)
  if (chess.inCheck()) {
    // The side to move is in check — bad for them
    score += turn === perspective ? -15 : 15;
  }

  // ── 5. King of the Hill ────────────────────────────────────────────
  if (ctx.kothEnabled) {
    score += evaluateHillPressure(board, fen, turn, perspective);
  }

  // ── 6. Crazyhouse reserves ─────────────────────────────────────────
  if (ctx.crazyhouse && ctx.config.overlays.enableCrazyhouse) {
    score += evaluateReserves(ctx.crazyhouse, perspective);
  }

  // ── 7. Clock Pressure (only at root-level evaluation) ──────────────
  if (ctx.config.overlays.enableClock && (whiteMs > 0 || blackMs > 0)) {
    score += evaluateClockPressure(whiteMs, blackMs, perspective);
  }

  return score;
}

/**
 * Full variant-aware evaluation (used for root-level move scoring only).
 * Includes expensive variant-specific checks that are too slow for deep search.
 */
export function evaluatePositionFull(
  fen: string,
  perspective: Color,
  ctx: SearchContext,
  whiteMs: number = 0,
  blackMs: number = 0,
): number {
  let score = evaluatePosition(fen, perspective, ctx, whiteMs, blackMs);

  const chess = new Chess(fen);
  if (chess.isCheckmate() || chess.isStalemate() || chess.isDraw()) {
    return score;
  }

  const turn = chess.turn() as Color;
  const config = ctx.config;
  const mode = config.variantMode;

  // Classic Blunziger: check pressure
  if (isClassicForcedCheck(mode) && !isReverseForcedCheckMode(mode)) {
    const checkingMoves = getCheckingMoves(fen);
    if (checkingMoves.length === 0 && chess.moves().length > 0) {
      score += turn === perspective ? -40 : 40;
    } else if (checkingMoves.length > 0) {
      const checkBonus = Math.min(checkingMoves.length * 12, 48);
      score += turn === perspective ? checkBonus : -checkBonus;
    }
  }

  // Reverse Blunziger: non-checking pressure
  if (isReverseForcedCheckMode(mode)) {
    const checkingMoves = getCheckingMoves(fen);
    const nonCheckingMoves = getNonCheckingMoves(fen);
    if (checkingMoves.length > 0 && nonCheckingMoves.length > 0) {
      const constraintPenalty = Math.max(0, 30 - nonCheckingMoves.length * 5);
      score += turn === perspective ? -constraintPenalty : constraintPenalty;
    }
  }

  // King Hunt
  if (isKingHuntVariant(mode)) {
    if (mode === 'classic_king_hunt_move_limit') {
      score += evaluateKingHuntMoveLimit(
        ctx.scores,
        0,
        ctx.kingHuntPliesRemaining + 10,
        turn,
        fen,
        perspective,
      );
    } else {
      score += evaluateKingHuntGivenCheckLimit(
        ctx.scores,
        config.variantSpecific.kingHuntGivenCheckTarget,
        turn,
        fen,
        perspective,
      );
    }
  }

  // Penalty risk
  if (config.gameType === 'penalty_on_miss') {
    score += evaluatePenaltyRisk(fen, turn, perspective, config);
  }

  // Double Check Pressure
  if (config.overlays.enableDoubleCheckPressure) {
    const isClassicMode = isClassicForcedCheck(mode);
    const isReverseMode = isReverseForcedCheckMode(mode);
    let requiredCount = 0;
    if (isClassicMode && !isReverseMode) {
      requiredCount = getCheckingMoves(fen).length;
    } else if (isReverseMode) {
      const cMoves = getCheckingMoves(fen);
      requiredCount = cMoves.length > 0 ? getNonCheckingMoves(fen).length : 0;
    }
    if (requiredCount >= 2) {
      score += turn === perspective ? -30 : 30;
    }
  }

  // Crazyhouse vulnerability
  if (ctx.crazyhouse && config.overlays.enableCrazyhouse) {
    score += evaluateKingVulnerabilityToDrops(fen, ctx.crazyhouse, perspective);
  }

  return score;
}

// ── King safety helper ───────────────────────────────────────────────

function evaluateKingSafety(board: ReturnType<Chess['board']>, side: Color): number {
  let safety = 0;

  // Find king
  let kingFile = -1;
  let kingRank = -1;
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const cell = board[7 - rank][file];
      if (cell && cell.type === 'k' && cell.color === side) {
        kingFile = file;
        kingRank = rank;
      }
    }
  }

  if (kingFile < 0) return 0;

  // Pawn shield: check for friendly pawns in front of king
  const pawnDir = side === 'w' ? 1 : -1;
  for (const df of [-1, 0, 1]) {
    const f = kingFile + df;
    const r = kingRank + pawnDir;
    if (f >= 0 && f < 8 && r >= 0 && r < 8) {
      const cell = board[7 - r][f];
      if (cell && cell.type === 'p' && cell.color === side) {
        safety += 15;
      }
    }
  }

  // Castled king bonus (on sides)
  if (kingFile <= 2 || kingFile >= 6) {
    safety += 20;
  }

  return safety;
}

// ── Hill pressure helper ─────────────────────────────────────────────

function evaluateHillPressure(
  board: ReturnType<Chess['board']>,
  fen: string,
  turn: Color,
  perspective: Color,
): number {
  let score = 0;

  // Find both kings
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const cell = board[7 - rank][file];
      if (cell && cell.type === 'k') {
        const sq = cell.square;
        if (isHillSquare(sq)) {
          // King on hill = winning
          score += cell.color === perspective ? 5000 : -5000;
        } else {
          // Proximity bonus
          const hillCoords = [[3, 3], [3, 4], [4, 3], [4, 4]];
          let minDist = Infinity;
          for (const [hf, hr] of hillCoords) {
            minDist = Math.min(minDist, Math.max(Math.abs(file - hf), Math.abs(rank - hr)));
          }
          const proximity = Math.max(0, 4 - minDist) * 25;
          score += cell.color === perspective ? proximity : -proximity;
        }
      }
    }
  }

  // Can reach hill in one move?
  const legalMoves = getLegalMoves(fen);
  const hillMoves = legalMoves.filter((m) => m.piece === 'k' && isHillSquare(m.to));
  if (hillMoves.length > 0) {
    score += turn === perspective ? 800 : -800;
  }

  return score;
}

// ── Penalty risk helper ──────────────────────────────────────────────

function evaluatePenaltyRisk(
  fen: string,
  turn: Color,
  perspective: Color,
  config: MatchConfig,
): number {
  const pc = config.penaltyConfig;
  let penaltyWeight = 0;
  if (pc.enableAdditionalMovePenalty) penaltyWeight += pc.additionalMoveCount * 30;
  if (pc.enablePieceRemovalPenalty) penaltyWeight += pc.pieceRemovalCount * 60;
  if (pc.enableTimeReductionPenalty && config.overlays.enableClock) {
    penaltyWeight += Math.min(pc.timeReductionSeconds, 120) * 0.5;
  }

  if (penaltyWeight === 0) return 0;

  // Check if the side to move is at risk of violating
  const isClassic = isClassicForcedCheck(config.variantMode);
  const isReverse = isReverseForcedCheckMode(config.variantMode);
  const checkingMoves = getCheckingMoves(fen);
  const legalMoves = getLegalMoves(fen);

  let atRisk = false;
  if (isClassic && !isReverse && checkingMoves.length === 0 && legalMoves.length > 0) {
    atRisk = true;
  }
  if (isReverse && checkingMoves.length > 0) {
    const nonChecking = getNonCheckingMoves(fen);
    if (nonChecking.length > 0 && nonChecking.length <= 2) atRisk = true;
  }

  if (atRisk) {
    const adj = Math.round(penaltyWeight * 0.7);
    return turn === perspective ? -adj : adj;
  }

  return 0;
}
