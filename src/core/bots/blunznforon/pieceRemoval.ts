/**
 * Blunznforön bot — piece removal decision logic.
 *
 * When the bot must choose a piece for removal (penalty system),
 * it evaluates the tactical impact of each possible removal.
 */

import { Chess } from 'chess.js';
import type { Color, MatchConfig } from '../../blunziger/types';
import { isReverseForcedCheckMode } from '../../blunziger/types';
import {
  getRemovablePieces,
  getCheckCreatingRemovals,
} from '../../blunziger/engine';
import type { PieceRemovalDecision } from './types';

/** Piece values for removal scoring. */
const REMOVAL_VALUES: Record<string, number> = {
  p: 100, n: 320, b: 330, r: 500, q: 900,
};

/**
 * Select the best piece for removal from the target side.
 *
 * Strategy:
 * 1. Prefer removals that create discovered checks (variant-aware)
 * 2. Among non-check-creating removals, prefer highest material value
 * 3. Consider king safety impact
 *
 * @param fen Current position
 * @param targetSide Side whose piece will be removed
 * @param config Match configuration for variant awareness
 * @returns Best removal decision, or null if no pieces can be removed
 */
export function selectPieceForRemoval(
  fen: string,
  targetSide: Color,
  config: MatchConfig,
): PieceRemovalDecision | null {
  const removable = getRemovablePieces(fen, targetSide);
  if (removable.length === 0) return null;
  if (removable.length === 1) {
    return { square: removable[0], score: 0 };
  }

  const chess = new Chess(fen);
  const board = chess.board();
  const isReverse = isReverseForcedCheckMode(config.variantMode);

  // Find removals that create discovered checks
  const checkCreating = getCheckCreatingRemovals(fen, targetSide, removable);

  const scored: PieceRemovalDecision[] = removable.map((square) => {
    let score = 0;

    // Find piece type at this square
    const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = parseInt(square[1]) - 1;
    const cell = board[7 - rank][file];
    const pieceType = cell?.type ?? 'p';

    // Material value (higher = better to remove)
    score += REMOVAL_VALUES[pieceType] ?? 0;

    // Discovered check bonus (very strong in classic mode, penalty in reverse)
    if (checkCreating.includes(square)) {
      if (isReverse) {
        score -= 200; // In reverse mode, creating checks is bad
      } else {
        score += 300; // In classic mode, discovered checks are excellent
      }
    }

    // King safety: removing pieces near the opponent's king is more disruptive
    const oppKingSide = targetSide;
    for (const row of board) {
      for (const c of row) {
        if (c && c.type === 'k' && c.color === oppKingSide) {
          const kf = c.square.charCodeAt(0) - 'a'.charCodeAt(0);
          const kr = parseInt(c.square[1]) - 1;
          const dist = Math.max(Math.abs(file - kf), Math.abs(rank - kr));
          if (dist <= 2) {
            // Removing a defender near the king is extra valuable
            score += (3 - dist) * 30;
          }
        }
      }
    }

    return { square, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}
