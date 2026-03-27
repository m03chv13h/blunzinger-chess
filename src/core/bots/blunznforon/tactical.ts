/**
 * Blunznforön bot — tactical pattern detectors.
 *
 * Detects immediate tactical opportunities and threats:
 * - Immediate win (checkmate, KOTH)
 * - Immediate loss prevention
 * - Mate threats
 * - Checking drops
 * - Forced-check / forced-non-check opportunities
 * - King Hunt scoring opportunities
 */

import { Chess } from 'chess.js';
import type { Move, MatchConfig, DropMove, CrazyhouseState, Color } from '../../blunziger/types';
import { isKingHuntVariant } from '../../blunziger/types';
import {
  isKingOfTheHillEnabled,
  isHillSquare,
  getCheckingMoves,
  getCheckingDropMoves,
  doesDropGiveCheck,
} from '../../blunziger/engine';

/** Large bonus for immediate wins. */
export const MATE_SCORE = 100000;
/** Score for King of the Hill win. */
export const KOTH_WIN_SCORE = 90000;
/** Bonus for a move that prevents opponent's mate threat. */
export const MATE_PREVENTION_BONUS = 5000;

/**
 * Check if a regular move results in immediate checkmate.
 */
export function isCheckmateMoveRegular(fen: string, move: Move): boolean {
  try {
    const chess = new Chess(fen);
    chess.move(move.san);
    return chess.isCheckmate();
  } catch {
    return false;
  }
}

/**
 * Check if a move reaches a King of the Hill winning square.
 */
export function isKothWinMove(move: Move, config: MatchConfig): boolean {
  return isKingOfTheHillEnabled(config) && move.piece === 'k' && isHillSquare(move.to);
}

/**
 * Check if the opponent has a mate threat (can checkmate on their next move).
 * Returns true if after our move, the opponent has at least one mating reply.
 */
export function opponentHasMateThreat(fen: string): boolean {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  for (const move of moves) {
    chess.move(move.san);
    if (chess.isCheckmate()) {
      chess.undo();
      return true;
    }
    chess.undo();
  }
  return false;
}

/**
 * Score tactical bonuses for a regular move.
 * Returns a bonus value to add to the evaluation.
 */
export function tacticalBonusRegular(
  fen: string,
  move: Move,
  config: MatchConfig,
): number {
  let bonus = 0;

  // Checkmate
  if (isCheckmateMoveRegular(fen, move)) {
    return MATE_SCORE;
  }

  // KOTH win
  if (isKothWinMove(move, config)) {
    return KOTH_WIN_SCORE;
  }

  // King Hunt: checks are very valuable for scoring
  if (isKingHuntVariant(config.variantMode)) {
    try {
      const chess = new Chess(fen);
      chess.move(move.san);
      if (chess.inCheck()) {
        bonus += 50; // Significant bonus for scoring a check in King Hunt
      }
    } catch {
      // ignore
    }
  }

  return bonus;
}

/**
 * Score tactical bonuses for a drop move.
 */
export function tacticalBonusDrop(
  fen: string,
  drop: DropMove,
  config: MatchConfig,
): number {
  let bonus = 0;

  // Checking drops are strong
  if (doesDropGiveCheck(fen, drop.color, drop.piece, drop.to)) {
    bonus += isKingHuntVariant(config.variantMode) ? 50 : 25;
  }

  return bonus;
}

/**
 * Count checking moves available for a side (used for forced-check pressure).
 */
export function countCheckingMoves(fen: string): number {
  return getCheckingMoves(fen).length;
}

/**
 * Detect if a position has strong drop-check threats.
 * Returns the count of checking drop moves available.
 */
export function countCheckingDrops(
  fen: string,
  crazyhouse: CrazyhouseState,
  side: Color,
): number {
  const checkingDrops = getCheckingDropMoves(fen, crazyhouse, side);
  return checkingDrops.length;
}
