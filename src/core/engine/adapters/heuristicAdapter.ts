/**
 * Heuristic engine adapter — wraps the existing in-app heuristic evaluation.
 *
 * This adapter delegates to `evaluateGameState` and `findBestMoveForAdapter`
 * so existing heuristic logic is reused unchanged.
 */

import type {
  VariantEngineAdapter,
  EngineInfo,
  AnalyzePositionOptions,
  EngineLine,
} from '../types';
import { evaluateBasePosition } from '../../evaluation/evaluatePosition';
import { Chess } from 'chess.js';

const INFO: EngineInfo = {
  id: 'heuristic',
  name: 'Heuristic',
  description: 'Built-in heuristic evaluator (material + mobility)',
  availability: 'available',
  supportsEvaluation: true,
  supportsBotPlay: true,
  supportsVariantAwareness: false,
};

export function createHeuristicAdapter(): VariantEngineAdapter {
  return {
    info: INFO,

    async initialize(): Promise<void> {
      // No-op — heuristic evaluation is synchronous.
    },

    async analyzePosition(options: AnalyzePositionOptions): Promise<EngineLine[]> {
      const base = evaluateBasePosition(options.fen);
      const bestMoveUci = findBestMoveUci(options.fen);
      return [
        {
          bestMove: bestMoveUci,
          pv: bestMoveUci ? [bestMoveUci] : [],
          score: {
            scoreCp: base.scoreCp,
            mateIn: base.mateIn,
            favoredSide: base.scoreCp > 25
              ? 'white'
              : base.scoreCp < -25
                ? 'black'
                : 'equal',
          },
        },
      ];
    },

    async getBestMove(options: AnalyzePositionOptions): Promise<string | null> {
      return findBestMoveUci(options.fen);
    },

    dispose(): void {
      // No-op.
    },
  };
}

/**
 * Simple 1-ply best-move search (UCI format) using base position evaluation.
 * This mirrors the logic already in `evaluate.ts > findBestMove` but returns UCI notation.
 */
function findBestMoveUci(fen: string): string | null {
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
