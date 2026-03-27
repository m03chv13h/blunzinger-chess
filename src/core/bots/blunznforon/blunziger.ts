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

import type { Move, MatchConfig, DropMove, CrazyhouseState, Color } from '../../blunziger/types';
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
): FilteredMoves {
  const isReverse = isReverseForcedCheckMode(config.variantMode);

  // Get regular moves
  let regularMoves: Move[];
  if (isReverse) {
    const checking = getCheckingMoves(fen);
    if (checking.length > 0) {
      const nonChecking = getNonCheckingMoves(fen);
      regularMoves = nonChecking.length > 0 ? nonChecking : getLegalMoves(fen);
    } else {
      regularMoves = getLegalMoves(fen);
    }
  } else {
    // Classic / King Hunt: prefer checking moves
    const checking = getCheckingMoves(fen);
    regularMoves = checking.length > 0 ? checking : getLegalMoves(fen);
  }

  // Get drop moves (Crazyhouse)
  let dropMoves: DropMove[] = [];
  if (crazyhouse && config.overlays.enableCrazyhouse) {
    const allDrops = getCrazyhouseDropMoves(fen, crazyhouse, side);
    if (allDrops.length > 0) {
      if (isReverse) {
        const checkingDrops = getCheckingDropMoves(fen, crazyhouse, side);
        if (checkingDrops.length > 0) {
          const nonCheckingDrops = getNonCheckingDropMoves(fen, crazyhouse, side);
          const regularNonChecking = getNonCheckingMoves(fen);
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
        } else {
          // If regular checking moves exist, don't offer non-checking drops
          const regularChecking = getCheckingMoves(fen);
          if (regularChecking.length > 0) {
            dropMoves = [];
          } else {
            dropMoves = allDrops;
          }
        }
      }
    }
  }

  return { regularMoves, dropMoves };
}

/**
 * Get violation moves (moves that break variant rules) for easy-bot simulation.
 * Returns checking moves in reverse mode or non-checking in classic mode.
 */
export function getViolationMoves(
  fen: string,
  config: MatchConfig,
): Move[] {
  const isReverse = isReverseForcedCheckMode(config.variantMode);

  if (isReverse) {
    // In reverse mode: violation = giving check when non-checking moves exist
    const checking = getCheckingMoves(fen);
    const nonChecking = getNonCheckingMoves(fen);
    if (checking.length > 0 && nonChecking.length > 0) {
      return checking; // These would be violations
    }
    return [];
  } else {
    // Classic mode: violation = not giving check when checking moves exist
    const checking = getCheckingMoves(fen);
    if (checking.length > 0) {
      const nonChecking = getNonCheckingMoves(fen);
      return nonChecking; // These would be violations
    }
    return [];
  }
}
