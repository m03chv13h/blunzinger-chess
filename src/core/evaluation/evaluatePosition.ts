/**
 * Base chess position evaluation (material + mobility).
 *
 * Returns a centipawn-like score from White's perspective.
 * This is a heuristic approximation — not engine-strength evaluation.
 */

import { Chess } from 'chess.js';

/** Standard piece values in centipawns. */
const PIECE_CP: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

/**
 * Evaluate a position heuristically from White's perspective.
 *
 * Components:
 *   1. Material balance
 *   2. Mobility (legal move count difference)
 *   3. Checkmate / stalemate detection
 *
 * @returns centipawn-like score and explanation lines.
 */
export function evaluateBasePosition(fen: string): { scoreCp: number; mateIn: number | null; explanation: string[] } {
  const chess = new Chess(fen);
  const explanation: string[] = [];

  // ── Terminal states ────────────────────────────────────────────────
  if (chess.isCheckmate()) {
    // The side to move is checkmated.
    const matingColor = chess.turn() === 'w' ? 'black' : 'white';
    const sign = matingColor === 'white' ? 1 : -1;
    explanation.push(`Checkmate — ${matingColor} wins`);
    return { scoreCp: sign * 10000, mateIn: 0, explanation };
  }
  if (chess.isStalemate() || chess.isDraw()) {
    explanation.push('Draw / stalemate');
    return { scoreCp: 0, mateIn: null, explanation };
  }

  // ── Material ───────────────────────────────────────────────────────
  let material = 0;
  const board = chess.board();
  for (const row of board) {
    for (const sq of row) {
      if (sq) {
        const v = PIECE_CP[sq.type] ?? 0;
        material += sq.color === 'w' ? v : -v;
      }
    }
  }
  explanation.push(`Material: ${material >= 0 ? '+' : ''}${material} cp`);

  // ── Mobility (simple proxy) ────────────────────────────────────────
  const currentSideMoves = chess.moves().length;
  // Swap turn to count opponent's moves
  const parts = fen.split(' ');
  parts[1] = parts[1] === 'w' ? 'b' : 'w';
  let opponentMoves = 0;
  try {
    const flipped = new Chess(parts.join(' '));
    opponentMoves = flipped.moves().length;
  } catch {
    // If the FEN is invalid when swapped (e.g. king in check), skip mobility.
  }
  const whiteMobility = chess.turn() === 'w' ? currentSideMoves : opponentMoves;
  const blackMobility = chess.turn() === 'w' ? opponentMoves : currentSideMoves;
  const mobilityDiff = (whiteMobility - blackMobility) * 3; // ~3 cp per move difference
  if (mobilityDiff !== 0) {
    explanation.push(`Mobility: ${mobilityDiff >= 0 ? '+' : ''}${mobilityDiff} cp`);
  }

  const scoreCp = material + mobilityDiff;
  return { scoreCp, mateIn: null, explanation };
}
