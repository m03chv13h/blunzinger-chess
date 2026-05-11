import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Chessboard } from '../../components/Chessboard';
import type { MoveAnimationInfo } from '../../components/Chessboard';
import type { Square } from '../../core/blunziger/types';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const noopMove = () => false;
const noMoves = () => [] as Square[];

describe('Chessboard move animations', () => {
  describe('slide animation', () => {
    it('applies piece-slide class to the destination square piece', () => {
      const moveAnim: MoveAnimationInfo = { from: 'e2' as Square, to: 'e4' as Square };
      const { container } = render(
        <Chessboard
          fen={START_FEN}
          onMove={noopMove}
          legalMovesFrom={noMoves}
          interactive={false}
          moveAnimation={moveAnim}
        />,
      );
      const e4Square = container.querySelector('[data-square="e4"]');
      expect(e4Square).toBeTruthy();
      const piece = e4Square!.querySelector('.piece');
      expect(piece).toBeTruthy();
      expect(piece!.classList.contains('piece-slide')).toBe(true);
    });

    it('does NOT apply piece-slide class to other squares', () => {
      const moveAnim: MoveAnimationInfo = { from: 'e2' as Square, to: 'e4' as Square };
      const { container } = render(
        <Chessboard
          fen={START_FEN}
          onMove={noopMove}
          legalMovesFrom={noMoves}
          interactive={false}
          moveAnimation={moveAnim}
        />,
      );
      const d7Square = container.querySelector('[data-square="d7"]');
      expect(d7Square).toBeTruthy();
      const piece = d7Square!.querySelector('.piece');
      expect(piece).toBeTruthy();
      expect(piece!.classList.contains('piece-slide')).toBe(false);
    });

    it('sets CSS custom properties for slide direction', () => {
      const moveAnim: MoveAnimationInfo = { from: 'e2' as Square, to: 'e4' as Square };
      const { container } = render(
        <Chessboard
          fen={START_FEN}
          onMove={noopMove}
          legalMovesFrom={noMoves}
          interactive={false}
          moveAnimation={moveAnim}
        />,
      );
      const e4Square = container.querySelector('[data-square="e4"]');
      const piece = e4Square!.querySelector('.piece') as HTMLElement;
      // e2 to e4: same file (delta=0), rank goes from 2 to 4 → rankDelta = 4-2 = 2
      expect(piece.style.getPropertyValue('--slide-x')).toBe('0%');
      expect(piece.style.getPropertyValue('--slide-y')).toBe('200%');
    });

    it('computes correct slide offset for diagonal move', () => {
      // FEN with a bishop on c4 (after e.g. Bc4)
      const fen = 'rnbqkbnr/pppppppp/8/8/2B5/8/PPPPPPPP/RNBQK1NR b KQkq - 0 1';
      const moveAnim: MoveAnimationInfo = { from: 'f1' as Square, to: 'c4' as Square };
      const { container } = render(
        <Chessboard
          fen={fen}
          onMove={noopMove}
          legalMovesFrom={noMoves}
          interactive={false}
          moveAnimation={moveAnim}
        />,
      );
      const c4Square = container.querySelector('[data-square="c4"]');
      const piece = c4Square!.querySelector('.piece') as HTMLElement;
      // f1 to c4: file delta = f(5) - c(2) = 3, rank delta = 4 - 1 = 3
      expect(piece.style.getPropertyValue('--slide-x')).toBe('300%');
      expect(piece.style.getPropertyValue('--slide-y')).toBe('300%');
    });

    it('flips slide direction when board is flipped', () => {
      const moveAnim: MoveAnimationInfo = { from: 'e2' as Square, to: 'e4' as Square };
      const { container } = render(
        <Chessboard
          fen={START_FEN}
          onMove={noopMove}
          legalMovesFrom={noMoves}
          interactive={false}
          moveAnimation={moveAnim}
          flipped={true}
        />,
      );
      const e4Square = container.querySelector('[data-square="e4"]');
      const piece = e4Square!.querySelector('.piece') as HTMLElement;
      // Flipped: direction should be negated (e2→e4 same file, so x=0 either way)
      expect(piece.style.getPropertyValue('--slide-x')).toBe('0%');
      expect(piece.style.getPropertyValue('--slide-y')).toBe('-200%');
    });

    it('does not add slide animation when moveAnimation is null', () => {
      const { container } = render(
        <Chessboard
          fen={START_FEN}
          onMove={noopMove}
          legalMovesFrom={noMoves}
          interactive={false}
          moveAnimation={null}
        />,
      );
      const pieces = container.querySelectorAll('.piece-slide');
      expect(pieces.length).toBe(0);
    });
  });

  describe('drop animation (Crazyhouse)', () => {
    it('applies piece-drop class to the drop target square', () => {
      // FEN with a knight on d4 (as if just dropped)
      const fen = '4k3/8/8/8/3N4/8/8/4K3 b - - 0 1';
      const { container } = render(
        <Chessboard
          fen={fen}
          onMove={noopMove}
          legalMovesFrom={noMoves}
          interactive={false}
          dropAnimation={'d4' as Square}
        />,
      );
      const d4Square = container.querySelector('[data-square="d4"]');
      const piece = d4Square!.querySelector('.piece');
      expect(piece).toBeTruthy();
      expect(piece!.classList.contains('piece-drop')).toBe(true);
    });

    it('does NOT apply piece-drop to non-target squares', () => {
      const fen = '4k3/8/8/8/3N4/8/8/4K3 b - - 0 1';
      const { container } = render(
        <Chessboard
          fen={fen}
          onMove={noopMove}
          legalMovesFrom={noMoves}
          interactive={false}
          dropAnimation={'d4' as Square}
        />,
      );
      const e1Square = container.querySelector('[data-square="e1"]');
      const piece = e1Square!.querySelector('.piece');
      expect(piece!.classList.contains('piece-drop')).toBe(false);
    });

    it('does not apply piece-drop when dropAnimation is null', () => {
      const fen = '4k3/8/8/8/3N4/8/8/4K3 b - - 0 1';
      const { container } = render(
        <Chessboard
          fen={fen}
          onMove={noopMove}
          legalMovesFrom={noMoves}
          interactive={false}
          dropAnimation={null}
        />,
      );
      const pieces = container.querySelectorAll('.piece-drop');
      expect(pieces.length).toBe(0);
    });
  });

  describe('explosion animation (Atomic)', () => {
    it('applies explosion class to explosion squares', () => {
      const fen = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';
      const explosionSquares = ['d5', 'c4', 'c5', 'c6', 'd4', 'd6', 'e4', 'e5', 'e6'] as Square[];
      const { container } = render(
        <Chessboard
          fen={fen}
          onMove={noopMove}
          legalMovesFrom={noMoves}
          interactive={false}
          explosionSquares={explosionSquares}
        />,
      );
      const d5Square = container.querySelector('[data-square="d5"]');
      expect(d5Square!.classList.contains('explosion')).toBe(true);
      const c4Square = container.querySelector('[data-square="c4"]');
      expect(c4Square!.classList.contains('explosion')).toBe(true);
    });

    it('does NOT apply explosion to non-affected squares', () => {
      const fen = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';
      const explosionSquares = ['d5'] as Square[];
      const { container } = render(
        <Chessboard
          fen={fen}
          onMove={noopMove}
          legalMovesFrom={noMoves}
          interactive={false}
          explosionSquares={explosionSquares}
        />,
      );
      const a1Square = container.querySelector('[data-square="a1"]');
      expect(a1Square!.classList.contains('explosion')).toBe(false);
    });

    it('does not apply explosion when explosionSquares is empty', () => {
      const fen = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';
      const { container } = render(
        <Chessboard
          fen={fen}
          onMove={noopMove}
          legalMovesFrom={noMoves}
          interactive={false}
          explosionSquares={[]}
        />,
      );
      const explosions = container.querySelectorAll('.explosion');
      expect(explosions.length).toBe(0);
    });
  });
});
