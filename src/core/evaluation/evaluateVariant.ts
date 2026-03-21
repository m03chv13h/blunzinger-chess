/**
 * Variant-aware evaluation adjustments.
 *
 * Each function returns a centipawn-like adjustment and explanation lines.
 * Adjustments are additive to the base position evaluation.
 *
 * Sign convention: positive = White better, negative = Black better.
 *
 * HONESTY NOTE:
 * These are heuristic estimates, not theoretically perfect computations.
 * They use the actual game state (scores, clocks, pending violations, etc.)
 * but rely on practical approximations for strategic value.
 */

import { Chess } from 'chess.js';
import type { GameState, Color } from '../blunziger/types';
import {
  isClassicForcedCheck,
  isReverseForcedCheckMode,
  isKingHuntVariant,
} from '../blunziger/types';
import {
  getCheckingMoves,
  getNonCheckingMoves,
  getLegalMoves,
  isKingOfTheHillEnabled,
  isHillSquare,
} from '../blunziger/engine';
import type { Square } from 'chess.js';

interface Adjustment {
  scoreCp: number;
  explanation: string[];
}

const NO_ADJUSTMENT: Adjustment = { scoreCp: 0, explanation: [] };

// ── Helpers ──────────────────────────────────────────────────────────

/** Return +1 for white, -1 for black. */
function sideSign(side: Color): number {
  return side === 'w' ? 1 : -1;
}

/** Chebyshev distance from a square to the nearest hill center. */
function hillDistance(sq: Square): number {
  const file = (sq as string).charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = parseInt((sq as string)[1]) - 1;
  const hillCoords = [[3, 3], [3, 4], [4, 3], [4, 4]]; // d4,d5,e4,e5
  let minDist = Infinity;
  for (const [hf, hr] of hillCoords) {
    minDist = Math.min(minDist, Math.max(Math.abs(file - hf), Math.abs(rank - hr)));
  }
  return minDist;
}

// ── 1. Classic Blunzinger ────────────────────────────────────────────

/**
 * Evaluate forced-check pressure for Classic Blunzinger / King Hunt modes.
 *
 * Having more checking moves available is an advantage — the side to move
 * has more forcing options and is less likely to be forced into a violation.
 */
export function evaluateClassicBlunzinger(state: GameState): Adjustment {
  const { fen, sideToMove } = state;
  const checkingMoves = getCheckingMoves(fen);

  if (checkingMoves.length === 0) {
    // No checking moves — the side to move will violate if it's their turn.
    // This is a disadvantage for the side to move.
    return {
      scoreCp: sideSign(sideToMove) * -30,
      explanation: [`Classic Blunzinger: ${sideToMove === 'w' ? 'White' : 'Black'} has no checking moves (forced violation risk)`],
    };
  }

  // Having many checking moves is a slight advantage (more options, less error-prone).
  const pressureBonus = Math.min(checkingMoves.length * 10, 40);
  return {
    scoreCp: sideSign(sideToMove) * pressureBonus,
    explanation: [`Classic Blunzinger: ${checkingMoves.length} checking move(s) available → +${pressureBonus} cp for ${sideToMove === 'w' ? 'White' : 'Black'}`],
  };
}

// ── 2. Reverse Blunzinger ────────────────────────────────────────────

/**
 * Evaluate checking-avoidance pressure for Reverse Blunzinger.
 *
 * Having checking moves available is a liability when non-checking moves exist,
 * because the player must avoid them. Having ONLY checking moves is fine
 * (any move is allowed). Having few non-checking options is risky.
 */
export function evaluateReverseBlunzinger(state: GameState): Adjustment {
  const { fen, sideToMove } = state;
  const checkingMoves = getCheckingMoves(fen);
  const nonCheckingMoves = getNonCheckingMoves(fen);
  const legalMoves = getLegalMoves(fen);

  if (legalMoves.length === 0) return NO_ADJUSTMENT;

  if (checkingMoves.length > 0 && nonCheckingMoves.length === 0) {
    // All moves give check — any move is allowed; no penalty risk.
    return {
      scoreCp: sideSign(sideToMove) * 15,
      explanation: ['Reverse Blunzinger: all moves give check — free choice (slight advantage)'],
    };
  }

  if (checkingMoves.length > 0 && nonCheckingMoves.length > 0) {
    // Must pick non-checking; fewer non-checking options = more constrained.
    const constraintPenalty = Math.max(0, 30 - nonCheckingMoves.length * 5);
    return {
      scoreCp: sideSign(sideToMove) * -constraintPenalty,
      explanation: [
        `Reverse Blunzinger: ${nonCheckingMoves.length} non-checking move(s) among ${legalMoves.length} legal — ` +
        `constraint penalty −${constraintPenalty} cp for ${sideToMove === 'w' ? 'White' : 'Black'}`,
      ],
    };
  }

  // No checking moves at all — no violation risk.
  return NO_ADJUSTMENT;
}

// ── 3. King Hunt – Move Limit ────────────────────────────────────────

/**
 * Evaluate King Hunt with a ply limit.
 *
 * The current score difference matters, especially as the ply limit approaches.
 * If one side leads, the advantage grows as fewer moves remain.
 */
export function evaluateKingHuntMoveLimit(state: GameState): Adjustment {
  const { scores, plyCount, config } = state;
  const plyLimit = config.variantSpecific.kingHuntPlyLimit;
  const scoreDiff = scores.w - scores.b; // positive = White leads
  const plysRemaining = Math.max(1, plyLimit - plyCount);
  const progressFraction = plyCount / plyLimit;

  // Base value of the score difference: 50 cp per check-point.
  let adj = scoreDiff * 50;

  // Near the end, the current score matters much more (multiply by up to 3×).
  const lateGameMultiplier = 1 + progressFraction * 2;
  adj = Math.round(adj * lateGameMultiplier);

  // Bonus for having checking moves available (ability to extend lead).
  const checkingMoves = getCheckingMoves(state.fen);
  const checkBonus = Math.min(checkingMoves.length * 8, 32) * sideSign(state.sideToMove);
  adj += checkBonus;

  const explanation: string[] = [
    `King Hunt Move Limit: score W${scores.w}–B${scores.b}, ply ${plyCount}/${plyLimit} (${plysRemaining} remaining)`,
  ];
  if (adj !== 0) {
    explanation.push(`King Hunt adjustment: ${adj >= 0 ? '+' : ''}${adj} cp`);
  }
  return { scoreCp: adj, explanation };
}

// ── 4. King Hunt – Given Check Limit ─────────────────────────────────

/**
 * Evaluate King Hunt with a given-check target.
 *
 * Proximity to the target is critical — a side close to winning
 * should dominate the evaluation.
 */
export function evaluateKingHuntGivenCheckLimit(state: GameState): Adjustment {
  const { scores, config, sideToMove } = state;
  const target = config.variantSpecific.kingHuntGivenCheckTarget;

  const wDist = target - scores.w;
  const bDist = target - scores.b;

  // If either side is at 0 distance, they've already won (should be terminal).
  // Score proximity: each step closer is increasingly valuable.
  const wProximity = Math.max(0, target - wDist); // = scores.w
  const bProximity = Math.max(0, target - bDist); // = scores.b

  // Base: 80 cp per check toward target.
  let adj = (wProximity - bProximity) * 80;

  // Strongly amplify if one side is 1 check away.
  if (wDist === 1) adj += 300;
  if (bDist === 1) adj -= 300;

  // Checking move availability bonus for the side to move.
  const checkingMoves = getCheckingMoves(state.fen);
  if (checkingMoves.length > 0) {
    adj += sideSign(sideToMove) * 50;
  }

  const explanation = [
    `King Hunt Check Limit: W ${scores.w}/${target}, B ${scores.b}/${target}`,
    `Proximity adjustment: ${adj >= 0 ? '+' : ''}${adj} cp`,
  ];
  return { scoreCp: adj, explanation };
}

// ── 5. Report Incorrectness ──────────────────────────────────────────

/**
 * If there is a pending reportable violation, the reporting side has a
 * dominant advantage (the opponent missed a required move and can be reported).
 */
export function evaluateReportIncorrectness(state: GameState): Adjustment {
  const { pendingViolation } = state;
  if (!pendingViolation || !pendingViolation.reportable) return NO_ADJUSTMENT;

  // A valid pending report is nearly decisive.
  const violatorSide = pendingViolation.violatingSide;
  const adj = sideSign(violatorSide) * -500;
  return {
    scoreCp: adj,
    explanation: [
      `Report Incorrectness: pending valid report against ${violatorSide === 'w' ? 'White' : 'Black'} → strong advantage for opponent`,
    ],
  };
}

// ── 6. Penalty on Miss ───────────────────────────────────────────────

/**
 * Evaluate the impact of penalty configuration.
 *
 * Stronger penalties make miss opportunities more dangerous, amplifying
 * the value of forced-check pressure or avoidance pressure.
 */
export function evaluatePenaltyOnMiss(state: GameState): Adjustment {
  const { config, sideToMove, fen } = state;
  const pc = config.penaltyConfig;

  let penaltyWeight = 0;
  const parts: string[] = [];

  if (pc.enableAdditionalMovePenalty) {
    penaltyWeight += pc.additionalMoveCount * 30;
    parts.push(`extra moves ×${pc.additionalMoveCount}`);
  }
  if (pc.enablePieceRemovalPenalty) {
    penaltyWeight += pc.pieceRemovalCount * 60;
    parts.push(`piece removal ×${pc.pieceRemovalCount}`);
  }
  if (pc.enableTimeReductionPenalty && config.overlays.enableClock) {
    penaltyWeight += Math.min(pc.timeReductionSeconds, 120) * 0.5;
    parts.push(`time −${pc.timeReductionSeconds}s`);
  }

  if (penaltyWeight === 0) return NO_ADJUSTMENT;

  // Check whether the side to move is at risk of being penalized.
  // If they have no checking moves (classic) or only checking moves (reverse),
  // they are about to commit a violation → penalty advantage for opponent.
  const isClassic = isClassicForcedCheck(config.variantMode);
  const isReverse = isReverseForcedCheckMode(config.variantMode);
  const checkingMoves = getCheckingMoves(fen);
  const legalMoves = getLegalMoves(fen);

  let atRisk = false;
  if (isClassic && checkingMoves.length === 0 && legalMoves.length > 0) {
    atRisk = true;
  }
  if (isReverse && checkingMoves.length > 0 && getNonCheckingMoves(fen).length > 0) {
    // In reverse mode, having checking moves means they must be avoided;
    // but this isn't a violation risk per se (they just need to pick non-checking).
    // The risk is when they have very few non-checking options.
    const nonChecking = getNonCheckingMoves(fen);
    if (nonChecking.length <= 2) atRisk = true;
  }

  if (atRisk) {
    const adj = sideSign(sideToMove) * -Math.round(penaltyWeight * 0.6);
    return {
      scoreCp: adj,
      explanation: [
        `Penalty on Miss: ${sideToMove === 'w' ? 'White' : 'Black'} at violation risk (penalties: ${parts.join(', ')}) → ${adj} cp`,
      ],
    };
  }

  return NO_ADJUSTMENT;
}

// ── 7. King of the Hill ──────────────────────────────────────────────

/**
 * King proximity to hill squares affects evaluation.
 * Immediate or near-immediate hill wins dominate the score.
 */
export function evaluateKingOfTheHill(state: GameState): Adjustment {
  const { fen, sideToMove } = state;
  const chess = new Chess(fen);
  const board = chess.board();

  let wKingSq: Square | null = null;
  let bKingSq: Square | null = null;

  for (const row of board) {
    for (const cell of row) {
      if (cell && cell.type === 'k') {
        if (cell.color === 'w') wKingSq = cell.square as Square;
        else bKingSq = cell.square as Square;
      }
    }
  }

  if (!wKingSq || !bKingSq) return NO_ADJUSTMENT;

  // Check if king is already on hill (immediate win).
  if (isHillSquare(wKingSq)) {
    return { scoreCp: 5000, explanation: ['King of the Hill: White king on hill — winning'] };
  }
  if (isHillSquare(bKingSq)) {
    return { scoreCp: -5000, explanation: ['King of the Hill: Black king on hill — winning'] };
  }

  // Check if the side to move can reach the hill in one move.
  const legalMoves = getLegalMoves(fen);
  const kingHillMoves = legalMoves.filter(
    (m) => m.piece === 'k' && isHillSquare(m.to),
  );
  if (kingHillMoves.length > 0) {
    const adj = sideSign(sideToMove) * 800;
    return {
      scoreCp: adj,
      explanation: [`King of the Hill: ${sideToMove === 'w' ? 'White' : 'Black'} can reach hill next move → +800 cp`],
    };
  }

  // Proximity bonus: closer king = better.
  const wDist = hillDistance(wKingSq);
  const bDist = hillDistance(bKingSq);
  const proximityAdj = (bDist - wDist) * 40; // White closer → positive
  if (proximityAdj === 0) return NO_ADJUSTMENT;

  return {
    scoreCp: proximityAdj,
    explanation: [`King of the Hill proximity: W dist=${wDist}, B dist=${bDist} → ${proximityAdj >= 0 ? '+' : ''}${proximityAdj} cp`],
  };
}

// ── 8. Clock ─────────────────────────────────────────────────────────

/**
 * Time remaining affects evaluation.
 * Major time disadvantage shifts the score.
 */
export function evaluateClock(whiteMs: number, blackMs: number): Adjustment {
  if (whiteMs <= 0 && blackMs <= 0) return NO_ADJUSTMENT;

  const explanation: string[] = [];

  // Critical low time (< 10 seconds) is a severe disadvantage.
  const LOW_TIME_THRESHOLD_MS = 10_000;
  const CRITICAL_TIME_THRESHOLD_MS = 3_000;

  let adj = 0;

  if (whiteMs < CRITICAL_TIME_THRESHOLD_MS && blackMs >= LOW_TIME_THRESHOLD_MS) {
    adj = -300;
    explanation.push('Clock: White critically low on time');
  } else if (blackMs < CRITICAL_TIME_THRESHOLD_MS && whiteMs >= LOW_TIME_THRESHOLD_MS) {
    adj = 300;
    explanation.push('Clock: Black critically low on time');
  } else if (whiteMs < LOW_TIME_THRESHOLD_MS && blackMs >= LOW_TIME_THRESHOLD_MS) {
    adj = -120;
    explanation.push('Clock: White low on time');
  } else if (blackMs < LOW_TIME_THRESHOLD_MS && whiteMs >= LOW_TIME_THRESHOLD_MS) {
    adj = 120;
    explanation.push('Clock: Black low on time');
  } else {
    // General time ratio adjustment (small effect).
    const total = whiteMs + blackMs;
    if (total > 0) {
      const ratio = (whiteMs - blackMs) / total; // [-1, 1]
      adj = Math.round(ratio * 50);
      if (Math.abs(adj) >= 5) {
        explanation.push(`Clock ratio: ${adj >= 0 ? '+' : ''}${adj} cp`);
      }
    }
  }

  if (adj === 0) return NO_ADJUSTMENT;
  return { scoreCp: adj, explanation };
}

// ── 9. Double Check Pressure ─────────────────────────────────────────

/**
 * Under Double Check Pressure, having multiple required moves raises
 * the tactical stakes. More required moves = higher miss danger.
 */
export function evaluateDoubleCheckPressure(state: GameState): Adjustment {
  const { fen, sideToMove, config } = state;

  const isClassic = isClassicForcedCheck(config.variantMode);
  const isReverse = isReverseForcedCheckMode(config.variantMode);

  let requiredMoves: number;
  if (isClassic) {
    requiredMoves = getCheckingMoves(fen).length;
  } else if (isReverse) {
    const checkingMoves = getCheckingMoves(fen);
    if (checkingMoves.length > 0) {
      requiredMoves = getNonCheckingMoves(fen).length;
    } else {
      requiredMoves = 0; // No checking moves → no constraint.
    }
  } else {
    return NO_ADJUSTMENT;
  }

  // DCP makes positions with ≥2 required moves more dangerous (severe violation).
  if (requiredMoves >= 2) {
    // Higher pressure on the side to move — more required moves = more danger of severe miss.
    const pressureAdj = sideSign(sideToMove) * -Math.min(requiredMoves * 12, 60);
    return {
      scoreCp: pressureAdj,
      explanation: [
        `Double Check Pressure: ${requiredMoves} required moves for ${sideToMove === 'w' ? 'White' : 'Black'} — severe miss risk`,
      ],
    };
  }

  return NO_ADJUSTMENT;
}

// ── Orchestrator ─────────────────────────────────────────────────────

/**
 * Compute all variant-aware adjustments for the current game state.
 */
export function evaluateVariantAdjustments(
  state: GameState,
  whiteMs: number,
  blackMs: number,
): Adjustment {
  const { config } = state;
  let totalCp = 0;
  const explanation: string[] = [];

  const add = (adj: Adjustment) => {
    totalCp += adj.scoreCp;
    explanation.push(...adj.explanation);
  };

  // Variant mode adjustments.
  const mode = config.variantMode;
  if (isKingHuntVariant(mode)) {
    if (mode === 'classic_king_hunt_move_limit') {
      add(evaluateKingHuntMoveLimit(state));
    } else {
      add(evaluateKingHuntGivenCheckLimit(state));
    }
    // King Hunt modes also use classic forced-check rules.
    add(evaluateClassicBlunzinger(state));
  } else if (isReverseForcedCheckMode(mode)) {
    add(evaluateReverseBlunzinger(state));
  } else {
    // Classic Blunzinger.
    add(evaluateClassicBlunzinger(state));
  }

  // Game type adjustments.
  if (config.gameType === 'report_incorrectness') {
    add(evaluateReportIncorrectness(state));
  } else {
    add(evaluatePenaltyOnMiss(state));
  }

  // Overlay adjustments.
  if (isKingOfTheHillEnabled(config)) {
    add(evaluateKingOfTheHill(state));
  }
  if (config.overlays.enableClock) {
    add(evaluateClock(whiteMs, blackMs));
  }
  if (config.overlays.enableDoubleCheckPressure) {
    add(evaluateDoubleCheckPressure(state));
  }

  return { scoreCp: totalCp, explanation };
}
