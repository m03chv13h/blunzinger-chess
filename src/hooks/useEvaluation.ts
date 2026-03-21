import { useMemo } from 'react';
import type { GameState } from '../core/blunziger/types';
import type { EvaluationResult } from '../core/evaluation/types';
import { evaluateGameState } from '../core/evaluation/evaluate';

/**
 * React hook for variant-aware position evaluation.
 *
 * Memoizes the evaluation result so it only recomputes when relevant
 * game state changes (FEN, result, scores, clocks, pending violation, etc.).
 *
 * @param state    - Current game state
 * @param enabled  - Whether evaluation is enabled (skip computation if false)
 * @param whiteMs  - Live white clock in ms
 * @param blackMs  - Live black clock in ms
 */
export function useEvaluation(
  state: GameState,
  enabled: boolean,
  whiteMs: number = 0,
  blackMs: number = 0,
): EvaluationResult | null {
  // Extract values so dependency array is statically checkable.
  const violatingSide = state.pendingViolation?.violatingSide ?? null;
  const removalTargetSide = state.pendingPieceRemoval?.targetSide ?? null;
  const whiteSeconds = Math.floor(whiteMs / 1000);
  const blackSeconds = Math.floor(blackMs / 1000);

  return useMemo(() => {
    if (!enabled) return null;
    return evaluateGameState(state, whiteMs, blackMs);
    // Re-evaluate when any of these change.
    // Clock values are rounded to seconds to avoid re-evaluation every 100ms tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    state.fen,
    state.result,
    state.scores.w,
    state.scores.b,
    state.plyCount,
    violatingSide,
    removalTargetSide,
    state.sideToMove,
    whiteSeconds,
    blackSeconds,
  ]);
}
