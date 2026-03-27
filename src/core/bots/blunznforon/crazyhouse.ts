/**
 * Blunznforön bot — Crazyhouse-specific evaluation and drop scoring.
 *
 * Crazyhouse adds captured pieces to a reserve that can be dropped
 * onto the board. This module evaluates:
 * - Reserve material advantage
 * - Drop-check threats and mating nets
 * - King vulnerability to drops
 * - Defensive drop potential
 */

import { Chess } from 'chess.js';
import type { Color, CrazyhouseState, CrazyhousePieceType, DropMove, MatchConfig } from '../../blunziger/types';
import { isKingHuntVariant } from '../../blunziger/types';
import {
  doesDropGiveCheck,
  applyDropToFen,
} from '../../blunziger/engine';

/** Piece values in centipawns for reserve evaluation. */
const RESERVE_CP: Record<CrazyhousePieceType, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
};

/** Side sign helper. */
function sideSign(side: Color): number {
  return side === 'w' ? 1 : -1;
}

/**
 * Evaluate reserve material advantage.
 * Pieces in reserve are worth slightly less than on-board pieces
 * because they need a tempo to deploy.
 */
export function evaluateReserves(ch: CrazyhouseState, perspective: Color): number {
  let score = 0;
  const pieces: CrazyhousePieceType[] = ['p', 'n', 'b', 'r', 'q'];

  for (const piece of pieces) {
    const whiteCount = ch.whiteReserve[piece];
    const blackCount = ch.blackReserve[piece];
    const value = RESERVE_CP[piece] * 0.8; // Reserve pieces worth ~80% of on-board
    score += (whiteCount - blackCount) * value;
  }

  return perspective === 'w' ? score : -score;
}

/**
 * Evaluate a drop move's quality for the search.
 * Higher = better drop.
 */
export function evaluateDropMove(
  fen: string,
  drop: DropMove,
  config: MatchConfig,
): number {
  let score = 0;
  const side = drop.color;

  // Base value: piece being deployed
  score += RESERVE_CP[drop.piece] * 0.3;

  // Checking drops are very strong
  if (doesDropGiveCheck(fen, side, drop.piece, drop.to)) {
    score += isKingHuntVariant(config.variantMode) ? 80 : 40;

    // Check if the checking drop leads to checkmate
    try {
      const resultFen = applyDropToFen(fen, side, drop.piece, drop.to);
      const chess = new Chess(resultFen);
      if (chess.isCheckmate()) {
        return 100000; // Checkmate via drop
      }
      // If opponent has very few responses, it's near-mate
      const responses = chess.moves().length;
      if (responses <= 2) {
        score += 200;
      }
    } catch {
      // ignore
    }
  }

  // Central drops
  const centralSquares = ['d4', 'd5', 'e4', 'e5'];
  if (centralSquares.includes(drop.to)) {
    score += 15;
  }

  // Drops near opponent's king (attacking)
  try {
    const chess = new Chess(fen);
    const board = chess.board();
    const oppKingSq = findKingSquare(board, side === 'w' ? 'b' : 'w');
    if (oppKingSq) {
      const dist = chebyshevDistance(drop.to, oppKingSq);
      if (dist <= 2) {
        score += (3 - dist) * 20; // Closer to king = better
      }
    }
  } catch {
    // ignore
  }

  return score;
}

/**
 * Find king square for a given side.
 */
function findKingSquare(board: ReturnType<Chess['board']>, side: Color): string | null {
  for (const row of board) {
    for (const cell of row) {
      if (cell && cell.type === 'k' && cell.color === side) {
        return cell.square;
      }
    }
  }
  return null;
}

/**
 * Chebyshev distance between two algebraic squares.
 */
function chebyshevDistance(sq1: string, sq2: string): number {
  const f1 = sq1.charCodeAt(0) - 'a'.charCodeAt(0);
  const r1 = parseInt(sq1[1]) - 1;
  const f2 = sq2.charCodeAt(0) - 'a'.charCodeAt(0);
  const r2 = parseInt(sq2[1]) - 1;
  return Math.max(Math.abs(f1 - f2), Math.abs(r1 - r2));
}

/**
 * Evaluate king vulnerability to drops.
 * A king surrounded by empty squares near it is more vulnerable to drops.
 */
export function evaluateKingVulnerabilityToDrops(
  fen: string,
  ch: CrazyhouseState,
  perspective: Color,
): number {
  const chess = new Chess(fen);
  const board = chess.board();
  let score = 0;

  // Check both sides' king vulnerability
  for (const side of ['w', 'b'] as Color[]) {
    const oppSide = side === 'w' ? 'b' : 'w';
    const oppReserve = oppSide === 'w' ? ch.whiteReserve : ch.blackReserve;
    const hasReservePieces = oppReserve.q > 0 || oppReserve.r > 0 || oppReserve.n > 0 || oppReserve.b > 0;

    if (!hasReservePieces) continue;

    const kingSq = findKingSquare(board, side);
    if (!kingSq) continue;

    // Count empty squares adjacent to king (drop landing spots)
    const kf = kingSq.charCodeAt(0) - 'a'.charCodeAt(0);
    const kr = parseInt(kingSq[1]) - 1;
    let emptyAdjacent = 0;

    for (let df = -1; df <= 1; df++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (df === 0 && dr === 0) continue;
        const f = kf + df;
        const r = kr + dr;
        if (f < 0 || f > 7 || r < 0 || r > 7) continue;
        const cell = board[7 - r][f];
        if (!cell) emptyAdjacent++;
      }
    }

    // More empty squares = more vulnerable
    const vulnerability = emptyAdjacent * 8;
    // Amplify if opponent has queens in reserve
    const queenThreat = oppReserve.q > 0 ? 1.5 : 1.0;
    const adj = vulnerability * queenThreat;

    // Vulnerability is bad for the side, good for opponent
    score += sideSign(side) * -adj;
  }

  return perspective === 'w' ? score : -score;
}
