import { useState, useCallback, useRef, useEffect } from 'react';
import type { Square } from '../core/blunzinger/types';

/** A queued premove: from-square, to-square, optional promotion piece. */
export interface PreMove {
  from: Square;
  to: Square;
  promotion?: string;
}

export interface UsePreMovesReturn {
  /** The current queue of premoves. */
  preMoves: PreMove[];
  /** All squares involved in the premove queue (for highlighting). */
  premoveSquares: Square[];
  /** Add a premove to the end of the queue. */
  addPreMove: (from: Square, to: Square, promotion?: string) => void;
  /** Clear all queued premoves. */
  clearPreMoves: () => void;
}

/**
 * Hook to manage a queue of premoves.
 *
 * Premoves are moves queued by a player while it is not their turn.
 * They are highlighted on the board and auto-executed when the player's
 * turn arrives.
 *
 * @param isPlayerTurn  Whether it is currently the player's turn.
 * @param makeMove      The move-making function (returns true on success).
 * @param gameOver      Whether the game is over (clears premoves).
 */
export function usePreMoves(
  isPlayerTurn: boolean,
  makeMove: (from: Square, to: Square, promotion?: string) => boolean,
  gameOver: boolean,
): UsePreMovesReturn {
  const [preMoves, setPreMoves] = useState<PreMove[]>([]);
  const preMovesRef = useRef(preMoves);
  preMovesRef.current = preMoves;

  // Clear premoves when the game ends
  useEffect(() => {
    if (gameOver) {
      setPreMoves([]);
    }
  }, [gameOver]);

  // Auto-execute premoves when it becomes the player's turn
  useEffect(() => {
    if (!isPlayerTurn) return;
    if (preMovesRef.current.length === 0) return;

    // Execute the first premove; remaining ones stay queued for next turn cycle
    const [first, ...rest] = preMovesRef.current;
    makeMove(first.from, first.to, first.promotion);
    setPreMoves(rest);
  }, [isPlayerTurn, makeMove]);

  const addPreMove = useCallback(
    (from: Square, to: Square, promotion?: string) => {
      setPreMoves((prev) => [...prev, { from, to, promotion }]);
    },
    [],
  );

  const clearPreMoves = useCallback(() => {
    setPreMoves([]);
  }, []);

  // Compute all highlighted squares from the premove queue
  const premoveSquares: Square[] = (() => {
    const seen = new Set<Square>();
    for (const pm of preMoves) {
      seen.add(pm.from);
      seen.add(pm.to);
    }
    return Array.from(seen);
  })();

  return { preMoves, premoveSquares, addPreMove, clearPreMoves };
}
