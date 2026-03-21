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

import { Chess } from 'chess.js';
import type { EvaluationResult } from './types';
import type { GameState, Move } from '../blunziger/types';
import { isReverseForcedCheckMode } from '../blunziger/types';
import { evaluateBasePosition } from './evaluatePosition';
import { evaluateVariantAdjustments } from './evaluateVariant';
import {
  canReport,
  getLegalMoves,
  getCheckingMoves,
  getNonCheckingMoves,
  isKingOfTheHillEnabled,
  isHillSquare,
} from '../blunziger/engine';

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
        bestMove: null,
        explanation: ['Game over — draw'],
      };
    }
    const sign = state.result.winner === 'w' ? 1 : -1;
    return {
      scoreCp: sign * 10000,
      mateIn: null,
      favoredSide: state.result.winner === 'w' ? 'white' : 'black',
      normalizedScore: sign,
      bestMove: null,
      explanation: [`Game over — ${state.result.winner === 'w' ? 'White' : 'Black'} wins (${state.result.reason})`],
    };
  }

  // If the side to move can report the opponent's violation for an immediate win,
  // this is the best action and the evaluation is decisive.
  if (canReport(state, state.sideToMove)) {
    const sign = state.sideToMove === 'w' ? 1 : -1;
    return {
      scoreCp: sign * 10000,
      mateIn: null,
      favoredSide: state.sideToMove === 'w' ? 'white' : 'black',
      normalizedScore: sign,
      bestMove: 'Report',
      explanation: [`${state.sideToMove === 'w' ? 'White' : 'Black'} can report opponent's violation for an immediate win`],
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
      bestMove: null,
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

  // 4. Find best theoretical next move.
  const bestMove = findBestMove(state);

  return {
    scoreCp: totalCp,
    mateIn: null,
    favoredSide,
    normalizedScore,
    bestMove,
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

/**
 * Find the best theoretical next move using a 1-ply heuristic search.
 *
 * Candidate moves are filtered by variant rules (classic forced-check or
 * reverse forced-avoidance). Each candidate is evaluated using the base
 * position evaluator on the resulting position. Immediate wins
 * (checkmate, King of the Hill) are detected and returned early.
 *
 * Returns null when the game is over, during piece-removal selection,
 * or when no legal moves exist.
 */
function findBestMove(state: GameState): string | null {
  if (state.result) return null;
  if (state.pendingPieceRemoval) return null;

  const { fen, sideToMove } = state;
  const { variantMode } = state.config;
  const isReverse = isReverseForcedCheckMode(variantMode);

  // Determine candidate moves respecting variant rules.
  let candidates: Move[];
  if (isReverse) {
    const checking = getCheckingMoves(fen);
    if (checking.length > 0) {
      const nonChecking = getNonCheckingMoves(fen);
      candidates = nonChecking.length > 0 ? nonChecking : getLegalMoves(fen);
    } else {
      candidates = getLegalMoves(fen);
    }
  } else {
    // Classic / King Hunt: must play checking moves when available.
    const checking = getCheckingMoves(fen);
    candidates = checking.length > 0 ? checking : getLegalMoves(fen);
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].san;

  const kothEnabled = isKingOfTheHillEnabled(state.config);
  let bestMoveRef: Move = candidates[0];
  let bestScore = sideToMove === 'w' ? -Infinity : Infinity;

  const chess = new Chess(fen);
  for (const move of candidates) {
    chess.move(move.san);

    // Immediate checkmate — always best.
    if (chess.isCheckmate()) return move.san;

    // King of the Hill immediate win.
    if (kothEnabled && move.piece === 'k' && isHillSquare(move.to)) {
      return move.san;
    }

    const score = evaluateBasePosition(chess.fen()).scoreCp;

    if (sideToMove === 'w' ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMoveRef = move;
    }

    chess.undo();
  }

  return bestMoveRef.san;
}
