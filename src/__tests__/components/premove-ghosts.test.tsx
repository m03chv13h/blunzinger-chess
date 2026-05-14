import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Chessboard } from '../../components/Chessboard';
import type { Square } from '../../core/blunzinger/types';
import type { PreMove } from '../../hooks/usePreMoves';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const noopMove = () => false;
const noMoves = () => [] as Square[];

describe('Chessboard premove ghost pieces', () => {
  it('shows a ghost piece at the premove destination', () => {
    const preMoves: PreMove[] = [{ from: 'e2' as Square, to: 'e4' as Square }];
    const { container } = render(
      <Chessboard
        fen={START_FEN}
        onMove={noopMove}
        legalMovesFrom={noMoves}
        interactive={false}
        premoveSquares={['e2', 'e4'] as Square[]}
        preMoves={preMoves}
      />,
    );

    const e4Square = container.querySelector('[data-square="e4"]');
    expect(e4Square).toBeTruthy();
    const ghost = e4Square!.querySelector('.piece-premove-ghost');
    expect(ghost).toBeTruthy();
    expect(ghost!.textContent).toBe('♙'); // white pawn
  });

  it('dims the piece at the premove source', () => {
    const preMoves: PreMove[] = [{ from: 'e2' as Square, to: 'e4' as Square }];
    const { container } = render(
      <Chessboard
        fen={START_FEN}
        onMove={noopMove}
        legalMovesFrom={noMoves}
        interactive={false}
        premoveSquares={['e2', 'e4'] as Square[]}
        preMoves={preMoves}
      />,
    );

    const e2Square = container.querySelector('[data-square="e2"]');
    expect(e2Square).toBeTruthy();
    const piece = e2Square!.querySelector('.piece');
    expect(piece).toBeTruthy();
    expect(piece!.classList.contains('piece-premove-dimmed')).toBe(true);
  });

  it('handles chained premoves correctly', () => {
    // e2→e4, then e4→e5: piece from e2 should appear as ghost at e5
    const preMoves: PreMove[] = [
      { from: 'e2' as Square, to: 'e4' as Square },
      { from: 'e4' as Square, to: 'e5' as Square },
    ];
    const { container } = render(
      <Chessboard
        fen={START_FEN}
        onMove={noopMove}
        legalMovesFrom={noMoves}
        interactive={false}
        premoveSquares={['e2', 'e4', 'e5'] as Square[]}
        preMoves={preMoves}
      />,
    );

    // Ghost should be at e5 (final destination)
    const e5Square = container.querySelector('[data-square="e5"]');
    expect(e5Square).toBeTruthy();
    const ghost = e5Square!.querySelector('.piece-premove-ghost');
    expect(ghost).toBeTruthy();
    expect(ghost!.textContent).toBe('♙');

    // No ghost at e4 (intermediate, piece moved away)
    const e4Square = container.querySelector('[data-square="e4"]');
    expect(e4Square!.querySelector('.piece-premove-ghost')).toBeNull();
  });

  it('handles promotion premove', () => {
    const fen = 'rnbqkbnr/PPPPpppp/8/8/8/8/ppppPPPP/RNBQKBNR w KQkq - 0 1';
    const preMoves: PreMove[] = [{ from: 'a7' as Square, to: 'a8' as Square, promotion: 'q' }];
    const { container } = render(
      <Chessboard
        fen={fen}
        onMove={noopMove}
        legalMovesFrom={noMoves}
        interactive={false}
        premoveSquares={['a7', 'a8'] as Square[]}
        preMoves={preMoves}
      />,
    );

    const a8Square = container.querySelector('[data-square="a8"]');
    expect(a8Square).toBeTruthy();
    const ghost = a8Square!.querySelector('.piece-premove-ghost');
    expect(ghost).toBeTruthy();
    expect(ghost!.textContent).toBe('♕'); // white queen
  });

  it('does not show ghosts when preMoves is empty', () => {
    const { container } = render(
      <Chessboard
        fen={START_FEN}
        onMove={noopMove}
        legalMovesFrom={noMoves}
        interactive={false}
        preMoves={[]}
      />,
    );

    const ghosts = container.querySelectorAll('.piece-premove-ghost');
    expect(ghosts.length).toBe(0);
  });
});
