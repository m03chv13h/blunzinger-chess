import { useState, useMemo, useCallback } from 'react';
import type { GameState, ScoreState, PositionHistoryEntry, CrazyhouseState, Chess960State } from '../core/blunziger/types';

export interface ReviewStep {
  index: number;
  fen: string;
  scores: ScoreState;
  sideToMove: 'w' | 'b';
  moveNotation: string | null;
  /** Index into moveHistory, or -1 for non-move events (initial position, piece removal). */
  moveIndex: number;
  crazyhouse?: CrazyhouseState;
  chess960?: Chess960State;
  clockWhiteMs?: number;
  clockBlackMs?: number;
}

export interface UseReviewReturn {
  /** Whether the user is currently reviewing (game is over and review mode is active). */
  isReviewing: boolean;
  /** Current review step index (0-based). Null when not reviewing. */
  reviewIndex: number | null;
  /** Total number of review steps. */
  totalSteps: number;
  /** All review steps derived from the game's position history. */
  steps: ReviewStep[];
  /** FEN for the currently reviewed position, or null when not reviewing. */
  reviewedFen: string | null;
  /** Scores for the currently reviewed position, or null when not reviewing. */
  reviewedScores: ScoreState | null;
  /** A synthetic GameState for the currently reviewed position (for evaluation). */
  reviewedGameState: GameState | null;
  /** Current move index in moveHistory that is highlighted, or -1 if none. */
  highlightedMoveIndex: number;
  /** White's clock time (ms) at the reviewed position, or undefined when not available. */
  reviewedClockWhiteMs: number | undefined;
  /** Black's clock time (ms) at the reviewed position, or undefined when not available. */
  reviewedClockBlackMs: number | undefined;
  /** Start reviewing at the final position. */
  enterReview: () => void;
  /** Navigation controls. */
  goToFirst: () => void;
  goToPrev: () => void;
  goToNext: () => void;
  goToLast: () => void;
  goToStep: (index: number) => void;
}

function fenSideToMove(fen: string): 'w' | 'b' {
  const parts = fen.split(' ');
  return parts[1] === 'b' ? 'b' : 'w';
}

function buildReviewSteps(positionHistory: PositionHistoryEntry[]): ReviewStep[] {
  let moveCounter = -1;
  return positionHistory.map((entry, index) => {
    if (entry.moveNotation !== null) {
      moveCounter++;
    }
    return {
      index,
      fen: entry.fen,
      scores: entry.scores,
      sideToMove: fenSideToMove(entry.fen),
      moveNotation: entry.moveNotation,
      moveIndex: entry.moveNotation !== null ? moveCounter : -1,
      crazyhouse: entry.crazyhouse,
      chess960: entry.chess960,
      clockWhiteMs: entry.clockWhiteMs,
      clockBlackMs: entry.clockBlackMs,
    };
  });
}

export function useReview(state: GameState): UseReviewReturn {
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);

  const isGameOver = state.result !== null;

  const steps = useMemo(
    () => buildReviewSteps(state.positionHistory),
    [state.positionHistory],
  );

  const totalSteps = steps.length;
  const lastIndex = totalSteps - 1;

  const isReviewing = isGameOver && reviewIndex !== null;

  const currentStep = isReviewing && reviewIndex !== null && reviewIndex < totalSteps
    ? steps[reviewIndex]
    : null;

  const reviewedFen = currentStep?.fen ?? null;
  const reviewedScores = currentStep?.scores ?? null;
  const reviewedClockWhiteMs = currentStep?.clockWhiteMs;
  const reviewedClockBlackMs = currentStep?.clockBlackMs;

  const highlightedMoveIndex = currentStep?.moveIndex ?? -1;

  // Build a synthetic GameState for the reviewed position (for evaluation).
  const reviewedGameState = useMemo(() => {
    if (!isReviewing || !currentStep) return null;

    // Count ply up to this step
    const plyCount = steps.slice(0, currentStep.index + 1)
      .filter(s => s.moveNotation !== null).length;

    return {
      ...state,
      fen: currentStep.fen,
      scores: currentStep.scores,
      sideToMove: currentStep.sideToMove,
      plyCount,
      crazyhouse: currentStep.crazyhouse ?? null,
      chess960: currentStep.chess960 ?? null,
      // Clear transient state for evaluation of historical position
      result: null,
      pendingViolation: null,
      pendingPieceRemoval: null,
      lastReportFeedback: null,
    };
  }, [isReviewing, currentStep, steps, state]);

  const enterReview = useCallback(() => {
    if (isGameOver) {
      setReviewIndex(lastIndex);
    }
  }, [isGameOver, lastIndex]);

  const goToFirst = useCallback(() => {
    setReviewIndex(0);
  }, []);

  const goToPrev = useCallback(() => {
    setReviewIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
  }, []);

  const goToNext = useCallback(() => {
    setReviewIndex((prev) => (prev !== null && prev < lastIndex ? prev + 1 : prev));
  }, [lastIndex]);

  const goToLast = useCallback(() => {
    setReviewIndex(lastIndex);
  }, [lastIndex]);

  const goToStep = useCallback((index: number) => {
    if (index >= 0 && index < totalSteps) {
      setReviewIndex(index);
    }
  }, [totalSteps]);

  return {
    isReviewing,
    reviewIndex,
    totalSteps,
    steps,
    reviewedFen,
    reviewedScores,
    reviewedGameState,
    highlightedMoveIndex,
    reviewedClockWhiteMs,
    reviewedClockBlackMs,
    enterReview,
    goToFirst,
    goToPrev,
    goToNext,
    goToLast,
    goToStep,
  };
}
