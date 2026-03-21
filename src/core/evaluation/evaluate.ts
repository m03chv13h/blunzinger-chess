/**
 * Main evaluation orchestrator.
 *
 * Combines base chess position evaluation with variant-aware adjustments
 * to produce a final EvaluationResult.
 *
 * HONESTY NOTE:
 * This is a heuristic evaluation system. The base position score uses
 * material counting and mobility — NOT engine-strength analysis.
 * Variant adjustments use the actual game state (scores, clocks, pending
 * violations) but approximate strategic value through practical heuristics.
 */

import type { EvaluationResult } from './types';
import type { GameState } from '../blunziger/types';
import { evaluateBasePosition } from './evaluatePosition';
import { evaluateVariantAdjustments } from './evaluateVariant';

/**
 * Evaluate the full game state including variant-aware adjustments.
 *
 * @param state  - Current game state
 * @param whiteMs - Live white clock (milliseconds), 0 if clock disabled
 * @param blackMs - Live black clock (milliseconds), 0 if clock disabled
 * @returns EvaluationResult with score, normalized bar value, and explanation
 */
export function evaluateGameState(
  state: GameState,
  whiteMs: number = 0,
  blackMs: number = 0,
): EvaluationResult {
  const explanation: string[] = [];

  // If game is over, return a definitive result.
  if (state.result) {
    if (state.result.winner === 'draw') {
      return {
        scoreCp: 0,
        mateIn: null,
        favoredSide: 'equal',
        normalizedScore: 0,
        explanation: ['Game over — draw'],
      };
    }
    const sign = state.result.winner === 'w' ? 1 : -1;
    return {
      scoreCp: sign * 10000,
      mateIn: null,
      favoredSide: state.result.winner === 'w' ? 'white' : 'black',
      normalizedScore: sign,
      explanation: [`Game over — ${state.result.winner === 'w' ? 'White' : 'Black'} wins (${state.result.reason})`],
    };
  }

  // 1. Base chess position evaluation.
  const base = evaluateBasePosition(state.fen);
  explanation.push(...base.explanation);

  // If checkmate is detected, return immediately.
  if (base.mateIn !== null) {
    const sign = base.scoreCp > 0 ? 1 : -1;
    return {
      scoreCp: base.scoreCp,
      mateIn: base.mateIn,
      favoredSide: sign > 0 ? 'white' : 'black',
      normalizedScore: sign,
      explanation,
    };
  }

  // 2. Variant-aware adjustments.
  const variant = evaluateVariantAdjustments(state, whiteMs, blackMs);
  if (variant.explanation.length > 0) {
    explanation.push('── Variant adjustments ──');
    explanation.push(...variant.explanation);
  }

  // 3. Combine scores.
  const totalCp = base.scoreCp + variant.scoreCp;

  // Determine favored side.
  let favoredSide: 'white' | 'black' | 'equal';
  if (Math.abs(totalCp) < 25) {
    favoredSide = 'equal';
  } else {
    favoredSide = totalCp > 0 ? 'white' : 'black';
  }

  // Normalize to [-1, 1] using a sigmoid-like mapping.
  // 400 cp maps to ~0.7, 1000 cp maps to ~0.93.
  const normalizedScore = clampedSigmoid(totalCp);

  return {
    scoreCp: totalCp,
    mateIn: null,
    favoredSide,
    normalizedScore,
    explanation,
  };
}

/**
 * Map a centipawn score to [-1, 1] using a sigmoid curve.
 * This provides smooth bar movement with diminishing returns for large advantages.
 */
function clampedSigmoid(cp: number): number {
  // tanh(cp / 600) gives a nice mapping:
  // ±300 cp → ±0.46, ±600 cp → ±0.76, ±1000 cp → ±0.92
  return Math.tanh(cp / 600);
}
