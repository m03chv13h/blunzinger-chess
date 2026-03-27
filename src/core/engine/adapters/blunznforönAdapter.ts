/**
 * Blunznforön engine adapter — the app's strong custom tactical bot.
 *
 * Blunznforön is a variant-aware search bot that uses negamax with
 * alpha-beta pruning, quiescence search, and tactical extensions.
 * It is especially strong in Crazyhouse + Blunziger combinations.
 *
 * The engine adapter provides advisory evaluation and best-move hints
 * for the evaluation bar. Bot-play is handled by the bot module at
 * `core/bots/blunznforon/`.
 *
 * IMPORTANT: This engine is **advisory only**.  The app's authoritative rules
 * (violations, penalties, overlays) remain in `core/blunziger/`.
 */

import type {
  VariantEngineAdapter,
  EngineInfo,
  AnalyzePositionOptions,
  EngineLine,
} from '../types';
import { heuristicAnalysis } from './shared';

const INFO: EngineInfo = {
  id: 'blunznforön',
  name: 'Blunznforön',
  description:
    'Native custom tactical bot with negamax search, variant-aware evaluation, and Crazyhouse specialization. Especially strong in Blunziger + Crazyhouse combinations.',
  availability: 'available',
  supportsEvaluation: true,
  supportsBotPlay: true,
  supportsVariantAwareness: true,
};

export function createBlunznforönAdapter(): VariantEngineAdapter {
  let disposed = false;

  return {
    info: INFO,

    async initialize(): Promise<void> {
      // Blunznforön is fully in-app — no external resources to load.
    },

    async analyzePosition(options: AnalyzePositionOptions): Promise<EngineLine[]> {
      if (disposed) return [];
      // Advisory evaluation using heuristic analysis for the evaluation bar.
      // Actual bot-play uses the search engine in core/bots/blunznforon/.
      return heuristicAnalysis(options.fen);
    },

    async getBestMove(options: AnalyzePositionOptions): Promise<string | null> {
      if (disposed) return null;
      const lines = await this.analyzePosition(options);
      return lines[0]?.bestMove ?? null;
    },

    dispose(): void {
      disposed = true;
    },
  };
}
