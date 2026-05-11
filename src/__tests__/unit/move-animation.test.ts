import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMoveAnimation } from '../../hooks/useMoveAnimation';
import { createInitialState, applyMoveWithRules, applyDropMoveWithRules } from '../../core/blunziger/engine';
import { buildMatchConfig, DEFAULT_SETUP_CONFIG } from '../../core/blunziger/types';
import type { GameState, DropMove, Square } from '../../core/blunziger/types';

function makeConfig(overrides: Partial<typeof DEFAULT_SETUP_CONFIG> = {}) {
  return buildMatchConfig({ ...DEFAULT_SETUP_CONFIG, ...overrides });
}

describe('useMoveAnimation', () => {
  it('returns null animations for initial state (no moves)', () => {
    const state = createInitialState();
    const { result } = renderHook(() => useMoveAnimation(state, false));
    expect(result.current.moveAnimation).toBeNull();
    expect(result.current.dropAnimation).toBeNull();
    expect(result.current.explosionSquares).toEqual([]);
  });

  it('returns slide animation for a regular move', () => {
    let state = createInitialState();
    state = applyMoveWithRules(state, 'e4');

    const { result } = renderHook(() => useMoveAnimation(state, false));
    expect(result.current.moveAnimation).toEqual({ from: 'e2', to: 'e4' });
    expect(result.current.dropAnimation).toBeNull();
  });

  it('returns drop animation for a crazyhouse drop move', () => {
    const config = makeConfig({ enableCrazyhouse: true });
    let state = createInitialState('hvh', config);
    // Play some moves to get a capture and pieces in reserve
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'd5');
    state = applyMoveWithRules(state, { from: 'e4', to: 'd5' }); // capture
    // White now has a pawn in reserve, black to move
    // Make a neutral black move
    state = applyMoveWithRules(state, 'e6');

    // Now white can drop
    if (state.crazyhouse) {
      const drop: DropMove = { type: 'drop', piece: 'p', to: 'e3' as Square, color: 'w' };
      state = applyDropMoveWithRules(state, drop);

      const { result } = renderHook(() => useMoveAnimation(state, false));
      expect(result.current.dropAnimation).toBe('e3');
      expect(result.current.moveAnimation).toBeNull();
    }
  });

  it('returns explosion squares for atomic capture', () => {
    const config = makeConfig({ enableAtomic: true });
    let state = createInitialState('hvh', config);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'd5');
    state = applyMoveWithRules(state, { from: 'e4', to: 'd5' }); // atomic capture

    const { result } = renderHook(() => useMoveAnimation(state, true));
    expect(result.current.explosionSquares.length).toBeGreaterThan(0);
    expect(result.current.explosionSquares).toContain('d5');
    // Adjacent squares should be in the list
    expect(result.current.explosionSquares).toContain('c4');
    expect(result.current.explosionSquares).toContain('e4');
  });

  it('does not return explosion squares when atomic is disabled', () => {
    let state = createInitialState();
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'd5');
    state = applyMoveWithRules(state, { from: 'e4', to: 'd5' }); // normal capture

    const { result } = renderHook(() => useMoveAnimation(state, false));
    expect(result.current.explosionSquares).toEqual([]);
  });

  it('resets animations when game is reset (empty moveHistory)', () => {
    let state = createInitialState();
    state = applyMoveWithRules(state, 'e4');

    const { result, rerender } = renderHook(
      ({ s, atomic }) => useMoveAnimation(s, atomic),
      { initialProps: { s: state, atomic: false } },
    );
    expect(result.current.moveAnimation).not.toBeNull();

    // Reset to initial state
    const newState = createInitialState();
    rerender({ s: newState, atomic: false });
    expect(result.current.moveAnimation).toBeNull();
    expect(result.current.dropAnimation).toBeNull();
    expect(result.current.explosionSquares).toEqual([]);
  });
});
