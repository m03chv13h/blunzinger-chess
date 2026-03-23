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
import { findBestMoveUci, heuristicAnalysis } from './shared';

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
      return heuristicAnalysis(options.fen);
    },

    async getBestMove(options: AnalyzePositionOptions): Promise<string | null> {
      return findBestMoveUci(options.fen);
    },

    dispose(): void {
      // No-op.
    },
  };
}
