import { useRef, useMemo } from 'react';
import type { Square, Move, GameState } from '../core/blunzinger/types';
import type { MoveAnimationInfo } from '../components/Chessboard';
import { getExplosionSquares } from '../core/blunzinger/atomic';

/**
 * Derive animation props for the Chessboard from the current game state.
 *
 * Returns:
 * - `moveAnimation`: slide animation info for regular moves (from/to differ)
 * - `dropAnimation`: drop-in animation target for crazyhouse drops (from === to)
 * - `explosionSquares`: squares affected by an atomic explosion
 *
 * Animation identity is based on moveHistory length + the last move itself,
 * so animations only trigger when a new move is added (not on re-renders).
 */
export function useMoveAnimation(state: GameState, atomicEnabled: boolean) {
  const prevLenRef = useRef(0);
  const prevAnimRef = useRef<{
    moveAnimation: MoveAnimationInfo | null;
    dropAnimation: Square | null;
    explosionSquares: Square[];
  }>({ moveAnimation: null, dropAnimation: null, explosionSquares: [] });

  return useMemo(() => {
    const len = state.moveHistory.length;

    // Only compute new animation when a move is added
    if (len === prevLenRef.current || len === 0) {
      if (len === 0) {
        // Reset on new game
        prevAnimRef.current = { moveAnimation: null, dropAnimation: null, explosionSquares: [] };
      }
      prevLenRef.current = len;
      return prevAnimRef.current;
    }

    prevLenRef.current = len;

    const lastMove: Move = state.moveHistory[len - 1];

    let moveAnimation: MoveAnimationInfo | null = null;
    let dropAnimation: Square | null = null;
    let explosionSquares: Square[] = [];

    const isDrop = lastMove.from === lastMove.to && lastMove.san.includes('@');

    if (isDrop) {
      dropAnimation = lastMove.to as Square;
    } else {
      moveAnimation = { from: lastMove.from as Square, to: lastMove.to as Square };
    }

    // Atomic explosion: if atomic is enabled and the move captured a piece
    if (atomicEnabled && lastMove.captured && !isDrop) {
      const captureSquare = lastMove.to as Square;
      explosionSquares = [captureSquare, ...getExplosionSquares(captureSquare)];
    }

    prevAnimRef.current = { moveAnimation, dropAnimation, explosionSquares };
    return prevAnimRef.current;
  }, [state.moveHistory, atomicEnabled]);
}
