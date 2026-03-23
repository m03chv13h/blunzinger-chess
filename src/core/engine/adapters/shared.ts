/**
 * Shared utility functions used by multiple engine adapters.
 */

import { Chess } from 'chess.js';
import { evaluateBasePosition } from '../../evaluation/evaluatePosition';
import type { EngineLine } from '../types';

/** Threshold in centipawns below which the position is considered equal. */
const EQUAL_THRESHOLD_CP = 25;

/**
 * Simple 1-ply best-move search returning a UCI move string (e.g. "e2e4").
 * Shared between the Heuristic and Blunznforön (fallback) adapters.
 */
export function findBestMoveUci(fen: string): string | null {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;
  if (moves.length === 1) return `${moves[0].from}${moves[0].to}${moves[0].promotion ?? ''}`;

  const isWhite = fen.split(' ')[1] === 'w';
  let bestMove = moves[0];
  let bestScore = isWhite ? -Infinity : Infinity;

  for (const move of moves) {
    chess.move(move.san);
    if (chess.isCheckmate()) {
      return `${move.from}${move.to}${move.promotion ?? ''}`;
    }
    const score = evaluateBasePosition(chess.fen()).scoreCp;
    if (isWhite ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMove = move;
    }
    chess.undo();
  }

  return `${bestMove.from}${bestMove.to}${bestMove.promotion ?? ''}`;
}

/**
 * Heuristic position analysis shared between adapters.
 * Returns a single EngineLine based on material + mobility evaluation.
 */
export function heuristicAnalysis(fen: string): EngineLine[] {
  const base = evaluateBasePosition(fen);
  const bestMoveUci = findBestMoveUci(fen);

  return [
    {
      bestMove: bestMoveUci,
      pv: bestMoveUci ? [bestMoveUci] : [],
      score: {
        scoreCp: base.scoreCp,
        mateIn: base.mateIn,
        favoredSide:
          base.scoreCp > EQUAL_THRESHOLD_CP
            ? 'white'
            : base.scoreCp < -EQUAL_THRESHOLD_CP
              ? 'black'
              : 'equal',
      },
    },
  ];
}
