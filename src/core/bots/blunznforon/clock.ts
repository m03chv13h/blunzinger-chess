/**
 * Blunznforön bot — clock-aware search budget.
 *
 * Adjusts evaluation based on time remaining and provides
 * guidance on when to prefer forcing/practical moves.
 */

import type { Color } from '../../blunziger/types';

/**
 * Evaluate clock-based adjustments from a given perspective.
 *
 * @param whiteMs White's remaining time in milliseconds
 * @param blackMs Black's remaining time in milliseconds
 * @param perspective Evaluation perspective
 * @returns Centipawn adjustment
 */
export function evaluateClockPressure(
  whiteMs: number,
  blackMs: number,
  perspective: Color,
): number {
  if (whiteMs <= 0 && blackMs <= 0) return 0;

  const CRITICAL_MS = 3_000;
  const LOW_MS = 10_000;

  let adj = 0;

  if (whiteMs < CRITICAL_MS && blackMs >= LOW_MS) {
    adj = -350;
  } else if (blackMs < CRITICAL_MS && whiteMs >= LOW_MS) {
    adj = 350;
  } else if (whiteMs < LOW_MS && blackMs >= LOW_MS) {
    adj = -150;
  } else if (blackMs < LOW_MS && whiteMs >= LOW_MS) {
    adj = 150;
  } else {
    const total = whiteMs + blackMs;
    if (total > 0) {
      const ratio = (whiteMs - blackMs) / total;
      adj = Math.round(ratio * 60);
    }
  }

  return perspective === 'w' ? adj : -adj;
}

/**
 * Whether a side is in time trouble (should prefer practical/forcing moves).
 */
export function isInTimeTrouble(timeMs: number): boolean {
  return timeMs > 0 && timeMs < 10_000;
}
