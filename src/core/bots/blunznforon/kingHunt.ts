/**
 * Blunznforön bot — King Hunt evaluation.
 *
 * Evaluates positions in King Hunt variant modes:
 * - Move Limit: score differential with ply count context
 * - Given Check Limit: proximity to target check count
 */

import type { Color } from '../../blunziger/types';
import { getCheckingMoves } from '../../blunziger/engine';

/** Side sign helper. */
function sideSign(side: Color): number {
  return side === 'w' ? 1 : -1;
}

/**
 * Evaluate King Hunt - Move Limit position.
 *
 * @param scores Current check scores { w, b }
 * @param plyCount Current ply count
 * @param plyLimit Configured ply limit
 * @param sideToMove Current side to move
 * @param fen Current board position
 * @param perspective Evaluation perspective
 */
export function evaluateKingHuntMoveLimit(
  scores: { w: number; b: number },
  plyCount: number,
  plyLimit: number,
  sideToMove: Color,
  fen: string,
  perspective: Color,
): number {
  const scoreDiff = scores.w - scores.b; // positive = White leads
  const progressFraction = plyCount / plyLimit;

  // Base value of score difference: 60 cp per check-point
  let adj = scoreDiff * 60;

  // Near the end, the current score matters much more
  const lateGameMultiplier = 1 + progressFraction * 2;
  adj = Math.round(adj * lateGameMultiplier);

  // Bonus for having checking moves available (ability to extend lead)
  const checkingMoves = getCheckingMoves(fen);
  const checkBonus = Math.min(checkingMoves.length * 10, 40) * sideSign(sideToMove);
  adj += checkBonus;

  return perspective === 'w' ? adj : -adj;
}

/**
 * Evaluate King Hunt - Given Check Limit position.
 *
 * @param scores Current check scores { w, b }
 * @param target Target check count to win
 * @param sideToMove Current side to move
 * @param fen Current board position
 * @param perspective Evaluation perspective
 */
export function evaluateKingHuntGivenCheckLimit(
  scores: { w: number; b: number },
  target: number,
  sideToMove: Color,
  fen: string,
  perspective: Color,
): number {
  const wDist = target - scores.w;
  const bDist = target - scores.b;

  // Base: 80 cp per check toward target
  let adj = (scores.w - scores.b) * 80;

  // Strongly amplify if one side is 1 check away
  if (wDist === 1) adj += 400;
  if (bDist === 1) adj -= 400;

  // Checking move availability bonus
  const checkingMoves = getCheckingMoves(fen);
  if (checkingMoves.length > 0) {
    adj += sideSign(sideToMove) * 60;
  }

  return perspective === 'w' ? adj : -adj;
}
