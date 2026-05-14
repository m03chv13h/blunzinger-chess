import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePreMoves } from '../../hooks/usePreMoves';
import type { Square } from '../../core/blunzinger/types';

describe('usePreMoves', () => {
  it('should start with an empty premove queue', () => {
    const makeMove = vi.fn(() => true);
    const { result } = renderHook(() => usePreMoves(false, makeMove, false));

    expect(result.current.preMoves).toEqual([]);
    expect(result.current.premoveSquares).toEqual([]);
  });

  it('should add premoves to the queue', () => {
    const makeMove = vi.fn(() => true);
    const { result } = renderHook(() => usePreMoves(false, makeMove, false));

    act(() => {
      result.current.addPreMove('e2' as Square, 'e4' as Square);
    });

    expect(result.current.preMoves).toEqual([{ from: 'e2', to: 'e4' }]);
    expect(result.current.premoveSquares).toContain('e2');
    expect(result.current.premoveSquares).toContain('e4');
  });

  it('should support multiple premoves in queue', () => {
    const makeMove = vi.fn(() => true);
    const { result } = renderHook(() => usePreMoves(false, makeMove, false));

    act(() => {
      result.current.addPreMove('e2' as Square, 'e4' as Square);
      result.current.addPreMove('d2' as Square, 'd4' as Square);
      result.current.addPreMove('f1' as Square, 'c4' as Square);
    });

    expect(result.current.preMoves).toHaveLength(3);
    expect(result.current.premoveSquares).toContain('e2');
    expect(result.current.premoveSquares).toContain('e4');
    expect(result.current.premoveSquares).toContain('d2');
    expect(result.current.premoveSquares).toContain('d4');
    expect(result.current.premoveSquares).toContain('f1');
    expect(result.current.premoveSquares).toContain('c4');
  });

  it('should not duplicate squares in premoveSquares', () => {
    const makeMove = vi.fn(() => true);
    const { result } = renderHook(() => usePreMoves(false, makeMove, false));

    act(() => {
      result.current.addPreMove('e2' as Square, 'e4' as Square);
      result.current.addPreMove('e4' as Square, 'e5' as Square);
    });

    // e4 appears in both premoves but should only appear once in premoveSquares
    const e4Count = result.current.premoveSquares.filter(s => s === 'e4').length;
    expect(e4Count).toBe(1);
  });

  it('should clear all premoves', () => {
    const makeMove = vi.fn(() => true);
    const { result } = renderHook(() => usePreMoves(false, makeMove, false));

    act(() => {
      result.current.addPreMove('e2' as Square, 'e4' as Square);
      result.current.addPreMove('d2' as Square, 'd4' as Square);
    });

    expect(result.current.preMoves).toHaveLength(2);

    act(() => {
      result.current.clearPreMoves();
    });

    expect(result.current.preMoves).toEqual([]);
    expect(result.current.premoveSquares).toEqual([]);
  });

  it('should clear premoves when game is over', () => {
    const makeMove = vi.fn(() => true);
    const { result, rerender } = renderHook(
      ({ gameOver }) => usePreMoves(false, makeMove, gameOver),
      { initialProps: { gameOver: false } },
    );

    act(() => {
      result.current.addPreMove('e2' as Square, 'e4' as Square);
    });

    expect(result.current.preMoves).toHaveLength(1);

    rerender({ gameOver: true });

    expect(result.current.preMoves).toEqual([]);
  });

  it('should execute premove when it becomes player turn', () => {
    const makeMove = vi.fn(() => true);
    const { result, rerender } = renderHook(
      ({ isPlayerTurn }) => usePreMoves(isPlayerTurn, makeMove, false),
      { initialProps: { isPlayerTurn: false } },
    );

    act(() => {
      result.current.addPreMove('e2' as Square, 'e4' as Square);
    });

    expect(makeMove).not.toHaveBeenCalled();

    rerender({ isPlayerTurn: true });

    expect(makeMove).toHaveBeenCalledWith('e2', 'e4', undefined);
    expect(result.current.preMoves).toEqual([]);
  });

  it('should discard invalid premove and keep remaining', () => {
    const makeMove = vi.fn()
      .mockReturnValueOnce(false) // first premove invalid
      .mockReturnValueOnce(true); // second succeeds (but won't execute in same turn cycle)
    const { result, rerender } = renderHook(
      ({ isPlayerTurn }) => usePreMoves(isPlayerTurn, makeMove, false),
      { initialProps: { isPlayerTurn: false } },
    );

    act(() => {
      result.current.addPreMove('e2' as Square, 'e5' as Square); // invalid
      result.current.addPreMove('d2' as Square, 'd4' as Square); // valid
    });

    expect(result.current.preMoves).toHaveLength(2);

    rerender({ isPlayerTurn: true });

    // First premove was attempted (invalid), removed from queue
    expect(makeMove).toHaveBeenCalledWith('e2', 'e5', undefined);
    // Second premove remains in queue
    expect(result.current.preMoves).toEqual([{ from: 'd2', to: 'd4' }]);
  });

  it('should include promotion in premove', () => {
    const makeMove = vi.fn(() => true);
    const { result, rerender } = renderHook(
      ({ isPlayerTurn }) => usePreMoves(isPlayerTurn, makeMove, false),
      { initialProps: { isPlayerTurn: false } },
    );

    act(() => {
      result.current.addPreMove('e7' as Square, 'e8' as Square, 'q');
    });

    expect(result.current.preMoves).toEqual([{ from: 'e7', to: 'e8', promotion: 'q' }]);

    rerender({ isPlayerTurn: true });

    expect(makeMove).toHaveBeenCalledWith('e7', 'e8', 'q');
  });
});
