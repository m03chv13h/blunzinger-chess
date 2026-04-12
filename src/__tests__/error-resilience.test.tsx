import type React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Chessboard } from '../components/Chessboard';
import { ErrorBoundary } from '../components/ErrorBoundary';
import {
  getLegalMoves,
  getCheckingMoves,
  getNonCheckingMoves,
  getRemovablePieces,
  selectBestPieceForRemoval,
} from '../core/blunziger/engine';
import type { Square } from '../core/blunziger/types';

// A valid FEN where black's king has been "exploded" (Atomic chess scenario)
const MISSING_BLACK_KING_FEN = 'rnbq3r/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQ - 0 1';
// Completely invalid FEN
const GARBAGE_FEN = 'not-a-valid-fen';
// Valid FEN (starting position)
const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('Invalid FEN resilience', () => {
  describe('Chessboard component', () => {
    const noopMove = () => false;
    const noopLegalMoves = () => [] as Square[];

    it('renders without crashing for a FEN with missing king', () => {
      const { container } = render(
        <Chessboard
          fen={MISSING_BLACK_KING_FEN}
          onMove={noopMove}
          legalMovesFrom={noopLegalMoves}
          interactive={false}
        />,
      );
      expect(container.querySelector('.chessboard')).toBeTruthy();
    });

    it('renders without crashing for a garbage FEN', () => {
      const { container } = render(
        <Chessboard
          fen={GARBAGE_FEN}
          onMove={noopMove}
          legalMovesFrom={noopLegalMoves}
          interactive={false}
        />,
      );
      expect(container.querySelector('.chessboard')).toBeTruthy();
    });

    it('renders correctly for a valid FEN', () => {
      const { container } = render(
        <Chessboard
          fen={STARTING_FEN}
          onMove={noopMove}
          legalMovesFrom={noopLegalMoves}
          interactive={false}
        />,
      );
      expect(container.querySelector('.chessboard')).toBeTruthy();
      // Should show pieces
      const pieces = container.querySelectorAll('.piece');
      expect(pieces.length).toBeGreaterThan(0);
    });
  });

  describe('ErrorBoundary component', () => {
    function ThrowingChild(): React.ReactNode {
      throw new Error('Test crash');
    }

    it('catches render errors and shows recovery UI', () => {
      // Suppress React's error logging in tests
      const originalError = console.error;
      console.error = () => {};
      try {
        render(
          <ErrorBoundary>
            <ThrowingChild />
          </ErrorBoundary>,
        );
        expect(screen.getByText('Something went wrong')).toBeTruthy();
        expect(screen.getByText('Try Again')).toBeTruthy();
      } finally {
        console.error = originalError;
      }
    });

    it('recovers when Try Again is clicked', () => {
      let shouldThrow = true;
      function ConditionalThrow() {
        if (shouldThrow) throw new Error('Test crash');
        return <div>Recovered</div>;
      }

      const originalError = console.error;
      console.error = () => {};
      try {
        render(
          <ErrorBoundary>
            <ConditionalThrow />
          </ErrorBoundary>,
        );
        expect(screen.getByText('Something went wrong')).toBeTruthy();

        shouldThrow = false;
        fireEvent.click(screen.getByText('Try Again'));
        expect(screen.getByText('Recovered')).toBeTruthy();
      } finally {
        console.error = originalError;
      }
    });

    it('renders children normally when no error occurs', () => {
      render(
        <ErrorBoundary>
          <div>Normal content</div>
        </ErrorBoundary>,
      );
      expect(screen.getByText('Normal content')).toBeTruthy();
    });
  });

  describe('Core engine functions with invalid FEN', () => {
    it('getLegalMoves returns empty array for invalid FEN', () => {
      expect(getLegalMoves(MISSING_BLACK_KING_FEN)).toEqual([]);
      expect(getLegalMoves(GARBAGE_FEN)).toEqual([]);
    });

    it('getCheckingMoves returns empty array for invalid FEN', () => {
      expect(getCheckingMoves(MISSING_BLACK_KING_FEN)).toEqual([]);
      expect(getCheckingMoves(GARBAGE_FEN)).toEqual([]);
    });

    it('getNonCheckingMoves returns empty array for invalid FEN', () => {
      expect(getNonCheckingMoves(MISSING_BLACK_KING_FEN)).toEqual([]);
      expect(getNonCheckingMoves(GARBAGE_FEN)).toEqual([]);
    });

    it('getRemovablePieces returns empty array for invalid FEN', () => {
      expect(getRemovablePieces(MISSING_BLACK_KING_FEN, 'b')).toEqual([]);
      expect(getRemovablePieces(GARBAGE_FEN, 'w')).toEqual([]);
    });

    it('selectBestPieceForRemoval returns null for invalid FEN', () => {
      expect(selectBestPieceForRemoval(MISSING_BLACK_KING_FEN, 'b')).toBeNull();
      expect(selectBestPieceForRemoval(GARBAGE_FEN, 'w')).toBeNull();
    });

    it('getLegalMoves works normally for valid FEN', () => {
      const moves = getLegalMoves(STARTING_FEN);
      expect(moves.length).toBe(20); // 20 opening moves
    });
  });
});
