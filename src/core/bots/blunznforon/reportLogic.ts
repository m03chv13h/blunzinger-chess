/**
 * Blunznforön bot — report action decision logic.
 *
 * Determines whether the bot should report an opponent's violation.
 * Higher difficulty levels always report valid violations.
 * Easy level uses probabilistic reporting.
 */

import type { BotLevel, ViolationRecord } from '../../blunziger/types';

/** Baseline probability that easy bot reports a missed-check violation. */
const EASY_BASE_REPORT_PROBABILITY = 0.15;
/** Extra report probability per available checking move. */
const EASY_PROBABILITY_PER_CHECK = 0.25;
/** Upper cap on the easy bot's report probability. */
const EASY_MAX_REPORT_PROBABILITY = 0.9;

/**
 * Determine whether the bot should report an opponent's violation.
 *
 * Expert, hard, and medium bots always report valid violations.
 * Easy bot uses probabilistic reporting based on how obvious the violation is.
 */
export function shouldReport(level: BotLevel, violation: ViolationRecord): boolean {
  if (level !== 'easy') return true;

  // Gave-forbidden-check violations are always obvious
  if (
    violation.violationType === 'gave_forbidden_check' ||
    violation.violationType === 'gave_forbidden_check_removal'
  ) {
    return true;
  }

  // For missed checks: more available checking moves → easier to notice
  const checkCount = violation.violationType === 'missed_check_removal'
    ? (violation.requiredRemovalSquares?.length ?? 0)
    : violation.checkingMoves.length + (violation.checkingDropMoves?.length ?? 0);

  const probability = Math.min(
    EASY_MAX_REPORT_PROBABILITY,
    EASY_BASE_REPORT_PROBABILITY + checkCount * EASY_PROBABILITY_PER_CHECK,
  );

  return Math.random() < probability;
}
