/**
 * Blunznforön bot — variant mode filtering (Blunziger rules).
 *
 * Filters candidate moves according to the active variant mode:
 * - Classic Blunzinger: must play checking moves when available
 * - Reverse Blunzinger: must avoid checking moves when non-checking exist
 * - King Hunt: same as classic but with scoring awareness
 *
 * This module ensures Blunznforön never bypasses authoritative rules.
 */

import type { Move, MatchConfig, DropMove, CrazyhouseState, Color, Chess960State } from '../../blunziger/types';
import { isReverseForcedCheckMode } from '../../blunziger/types';
import {
  getLegalMoves,
  getCheckingMoves,
  getNonCheckingMoves,
  getCrazyhouseDropMoves,
  getCheckingDropMoves,
  getNonCheckingDropMoves,
} from '../../blunziger/engine';

export interface FilteredMoves {
  regularMoves: Move[];
  dropMoves: DropMove[];
  /**
   * True when checking drops are the only way to fulfill the forced-check
   * obligation (classic / King Hunt modes).  When set, the bot must prefer
   * a drop over any regular move to avoid missing a check.
   */
  dropRequired: boolean;
}

/**
 * Get all candidate moves filtered by variant rules.
 *
 * This is the authoritative move pipeline for Blunznforön:
 * 1. Generate legal moves
 * 2. Generate Crazyhouse drop moves (if enabled)
 * 3. Filter by variant mode constraints
 * 4. Return combined candidate set
 */
export function getFilteredCandidates(
  fen: string,
  config: MatchConfig,
  crazyhouse: CrazyhouseState | null,
  side: Color,
  chess960?: Chess960State | null,
): FilteredMoves {
  const isReverse = isReverseForcedCheckMode(config.variantMode);

  // Get regular moves
  let regularMoves: Move[];
  let hasCheckingRegularMoves = false;
  if (isReverse) {
    const checking = getCheckingMoves(fen, chess960);
    hasCheckingRegularMoves = checking.length > 0;
    if (checking.length > 0) {
      const nonChecking = getNonCheckingMoves(fen, chess960);
      regularMoves = nonChecking.length > 0 ? nonChecking : getLegalMoves(fen, chess960);
    } else {
      regularMoves = getLegalMoves(fen, chess960);
    }
  } else {
    // Classic / King Hunt: prefer checking moves
    const checking = getCheckingMoves(fen, chess960);
    hasCheckingRegularMoves = checking.length > 0;
    regularMoves = checking.length > 0 ? checking : getLegalMoves(fen, chess960);
  }

  // Get drop moves (Crazyhouse)
  let dropMoves: DropMove[] = [];
  let dropRequired = false;
  if (crazyhouse && config.overlays.enableCrazyhouse) {
    const allDrops = getCrazyhouseDropMoves(fen, crazyhouse, side);
    if (allDrops.length > 0) {
      if (isReverse) {
        const checkingDrops = getCheckingDropMoves(fen, crazyhouse, side);
        if (checkingDrops.length > 0) {
          const nonCheckingDrops = getNonCheckingDropMoves(fen, crazyhouse, side);
          const regularNonChecking = getNonCheckingMoves(fen, chess960);
          const totalNonChecking = nonCheckingDrops.length + regularNonChecking.length;
          dropMoves = totalNonChecking > 0 ? nonCheckingDrops : allDrops;
        } else {
          dropMoves = allDrops;
        }
      } else {
        // Classic / King Hunt: prefer checking drops
        const checkingDrops = getCheckingDropMoves(fen, crazyhouse, side);
        if (checkingDrops.length > 0) {
          dropMoves = checkingDrops;
          // Drops are the only way to give check — bot must drop
          if (!hasCheckingRegularMoves) {
            dropRequired = true;
          }
        } else {
          // If regular checking moves exist, don't offer non-checking drops
          if (hasCheckingRegularMoves) {
            dropMoves = [];
          } else {
            dropMoves = allDrops;
          }
        }
      }
    }
  }

  return { regularMoves, dropMoves, dropRequired };
}

/**
 * Get violation moves (moves that break variant rules) for easy-bot simulation.
 * Returns checking moves in reverse mode or non-checking in classic mode.
 */
export function getViolationMoves(
  fen: string,
  config: MatchConfig,
  chess960?: Chess960State | null,
): Move[] {
  const isReverse = isReverseForcedCheckMode(config.variantMode);

  if (isReverse) {
    // In reverse mode: violation = giving check when non-checking moves exist
    const checking = getCheckingMoves(fen, chess960);
    const nonChecking = getNonCheckingMoves(fen, chess960);
    if (checking.length > 0 && nonChecking.length > 0) {
      return checking; // These would be violations
    }
    return [];
  } else {
    // Classic mode: violation = not giving check when checking moves exist
    const checking = getCheckingMoves(fen, chess960);
    if (checking.length > 0) {
      const nonChecking = getNonCheckingMoves(fen, chess960);
      return nonChecking; // These would be violations
    }
    return [];
  }
}
