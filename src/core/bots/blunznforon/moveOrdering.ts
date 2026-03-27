/**
 * Blunznforön bot — move ordering for alpha-beta search efficiency.
 *
 * Good move ordering is critical for alpha-beta pruning: examining the best
 * moves first leads to more cutoffs and faster search.
 *
 * Ordering heuristics (descending priority):
 * 1. Captures ordered by MVV-LVA (Most Valuable Victim - Least Valuable Attacker)
 * 2. Promotions
 * 3. Central moves
 * 4. Remaining moves
 *
 * NOTE: Check detection is deferred to avoid expensive Chess instance creation
 * during move ordering. The search itself handles check bonuses.
 */

import type { Move, MatchConfig } from '../../blunziger/types';
import { isKingOfTheHillEnabled, isHillSquare } from '../../blunziger/engine';

/** Piece values for MVV-LVA ordering. */
const ORDER_VALUES: Record<string, number> = {
  p: 1, n: 3, b: 3, r: 5, q: 9, k: 100,
};

/**
 * Score a move for ordering purposes (higher = search first).
 * This is a fast heuristic — no Chess instance creation.
 */
function orderScore(move: Move, config?: MatchConfig): number {
  let score = 0;

  // King of the Hill: king reaching center is instant win
  if (config && isKingOfTheHillEnabled(config) && move.piece === 'k' && isHillSquare(move.to)) {
    return 100000;
  }

  // Captures: MVV-LVA (capture high-value with low-value attacker)
  if (move.captured) {
    const victimValue = ORDER_VALUES[move.captured] ?? 0;
    const attackerValue = ORDER_VALUES[move.piece] ?? 0;
    score += 10000 + victimValue * 100 - attackerValue;
  }

  // Promotions
  if (move.promotion) {
    score += 8000 + (ORDER_VALUES[move.promotion] ?? 0) * 100;
  }

  // Central squares
  const centralSquares = ['d4', 'd5', 'e4', 'e5'];
  if (centralSquares.includes(move.to)) {
    score += 50;
  }

  // Extended center
  const extendedCenter = ['c3', 'c4', 'c5', 'c6', 'd3', 'd6', 'e3', 'e6', 'f3', 'f4', 'f5', 'f6'];
  if (extendedCenter.includes(move.to)) {
    score += 20;
  }

  return score;
}

/**
 * Order moves for optimal alpha-beta pruning.
 * Returns a new array sorted by estimated quality (best first).
 */
export function orderMoves(moves: Move[], _fen: string, config?: MatchConfig): Move[] {
  const scored = moves.map((move) => ({
    move,
    score: orderScore(move, config),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.move);
}
