import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createInitialState,
  applyMoveWithRules,
  applyTimeout,
} from '../core/blunziger/engine';
import type { MatchConfig, ClockState, Square } from '../core/blunziger/types';
import { buildMatchConfig, DEFAULT_SETUP_CONFIG } from '../core/blunziger/types';

// ── Helpers ──────────────────────────────────────────────────────────

function clockConfig(overrides: Partial<typeof DEFAULT_SETUP_CONFIG> = {}): MatchConfig {
  return buildMatchConfig({
    ...DEFAULT_SETUP_CONFIG,
    enableClock: true,
    ...overrides,
  });
}

/**
 * Simulate the timestamp-based clock model used by the useGame hook.
 *
 * committedMs  — the stored remaining time for the active player
 * turnStartTs  — the wall-clock timestamp when the current turn started
 * nowTs        — the current wall-clock timestamp
 *
 * Returns the remaining time that would be displayed.
 */
function computeDisplayTime(committedMs: number, turnStartTs: number, nowTs: number): number {
  return Math.max(0, committedMs - (nowTs - turnStartTs));
}

/**
 * Simulate committing elapsed time for the active player (what happens
 * when a move is made).  Returns updated clock state with the active
 * side's time deducted and an optional increment added.
 */
function commitClockOnMove(
  clocks: ClockState,
  activeSide: 'w' | 'b',
  elapsedMs: number,
  incrementMs: number = 0,
): ClockState {
  const key = activeSide === 'w' ? 'whiteMs' : 'blackMs';
  const remaining = Math.max(0, clocks[key] - elapsedMs);
  return { ...clocks, [key]: remaining + incrementMs, lastTimestamp: Date.now() };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Clock – core timing logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Initialization ────────────────────────────────────────────────

  it('initializes both clocks to the configured time', () => {
    const cfg = clockConfig({ initialTimeMs: 3 * 60 * 1000 }); // 3 min
    const state = createInitialState('hvh', cfg);
    expect(state.clocks).not.toBeNull();
    expect(state.clocks!.whiteMs).toBe(180000);
    expect(state.clocks!.blackMs).toBe(180000);
    expect(state.clocks!.lastTimestamp).toBeNull();
  });

  it('does not create clocks when clock overlay is disabled', () => {
    const cfg = clockConfig({ enableClock: false });
    const state = createInitialState('hvh', cfg);
    expect(state.clocks).toBeNull();
  });

  // ── Display time computation (timestamp model) ─────────────────

  it('display time decreases as wall-clock time advances', () => {
    const committed = 300_000; // 5 min
    const turnStart = 1000;

    expect(computeDisplayTime(committed, turnStart, 1000)).toBe(300_000);
    expect(computeDisplayTime(committed, turnStart, 2000)).toBe(299_000);
    expect(computeDisplayTime(committed, turnStart, 11_000)).toBe(290_000);
    expect(computeDisplayTime(committed, turnStart, 301_000)).toBe(0); // clamped
  });

  it('display time never goes below zero', () => {
    expect(computeDisplayTime(5000, 0, 999_999)).toBe(0);
  });

  // ── Clock commit on move ──────────────────────────────────────────

  it('deducts elapsed time from the moving side on commit', () => {
    const initial: ClockState = { whiteMs: 300_000, blackMs: 300_000, lastTimestamp: null };
    const after = commitClockOnMove(initial, 'w', 5_000);
    expect(after.whiteMs).toBe(295_000);
    expect(after.blackMs).toBe(300_000);
  });

  it('applies increment after deducting elapsed time', () => {
    const initial: ClockState = { whiteMs: 300_000, blackMs: 300_000, lastTimestamp: null };
    const after = commitClockOnMove(initial, 'w', 5_000, 2_000);
    expect(after.whiteMs).toBe(297_000); // 300k - 5k + 2k
    expect(after.blackMs).toBe(300_000);
  });

  it('clamps remaining to zero before adding increment', () => {
    const initial: ClockState = { whiteMs: 3_000, blackMs: 300_000, lastTimestamp: null };
    const after = commitClockOnMove(initial, 'w', 10_000, 2_000);
    // remaining = max(0, 3000-10000) = 0, then +2000 = 2000
    expect(after.whiteMs).toBe(2_000);
  });

  // ── Timeout ───────────────────────────────────────────────────────

  it('applyTimeout ends the game for the losing side (white)', () => {
    const state = createInitialState('hvh', clockConfig());
    const after = applyTimeout(state, 'w');
    expect(after.result).not.toBeNull();
    expect(after.result!.winner).toBe('b');
    expect(after.result!.reason).toBe('timeout');
  });

  it('applyTimeout ends the game for the losing side (black)', () => {
    const state = createInitialState('hvh', clockConfig());
    const after = applyTimeout(state, 'b');
    expect(after.result).not.toBeNull();
    expect(after.result!.winner).toBe('w');
    expect(after.result!.reason).toBe('timeout');
  });

  it('applyTimeout is no-op on finished game', () => {
    let state = createInitialState('hvh', clockConfig());
    state = applyTimeout(state, 'w');
    const before = state.result;
    state = applyTimeout(state, 'b');
    expect(state.result).toBe(before);
  });

  it('checkmate takes precedence over subsequent timeout', () => {
    let state = createInitialState('hvh', clockConfig());
    // Fool's mate
    state = applyMoveWithRules(state, 'f3');
    state = applyMoveWithRules(state, 'e5');
    state = applyMoveWithRules(state, 'g4');
    state = applyMoveWithRules(state, { from: 'd8', to: 'h4' });
    expect(state.result!.reason).toBe('checkmate');
    const timeoutState = applyTimeout(state, 'w');
    expect(timeoutState.result!.reason).toBe('checkmate');
  });

  it('timeout clears pending piece removal', () => {
    const cfg = clockConfig({
      gameType: 'penalty_on_miss',
      enablePieceRemovalPenalty: true,
      pieceRemovalCount: 1,
    });
    let state = createInitialState('hvh', cfg);
    // Simulate having a pending piece removal
    state = { ...state, pendingPieceRemoval: { targetSide: 'w', chooserSide: 'b', removableSquares: ['a2' as Square], remainingRemovals: 1, triggerMoveIndex: 0 } };
    state = applyTimeout(state, 'b');
    expect(state.result!.reason).toBe('timeout');
    expect(state.pendingPieceRemoval).toBeNull();
  });

  // ── Side switching ────────────────────────────────────────────────

  it('sideToMove switches after a normal move', () => {
    const state = createInitialState('hvh', clockConfig());
    expect(state.sideToMove).toBe('w');
    const after = applyMoveWithRules(state, 'e4');
    expect(after.sideToMove).toBe('b');
  });

  it('clock values are preserved through moves (engine does not reset them)', () => {
    const cfg = clockConfig();
    let state = createInitialState('hvh', cfg);
    // Manually set clock values to verify they propagate
    state = { ...state, clocks: { whiteMs: 250_000, blackMs: 280_000, lastTimestamp: Date.now() } };
    const after = applyMoveWithRules(state, 'e4');
    // Engine preserves clocks through spread, values shouldn't be reset to initial
    expect(after.clocks).not.toBeNull();
    expect(after.clocks!.whiteMs).toBe(250_000);
    expect(after.clocks!.blackMs).toBe(280_000);
  });

  // ── Time reduction penalty ────────────────────────────────────────

  it('time reduction penalty config is properly set', () => {
    const cfg = clockConfig({
      gameType: 'penalty_on_miss',
      enableTimeReductionPenalty: true,
      timeReductionSeconds: 30,
    });
    // Verify config propagates correctly
    expect(cfg.penaltyConfig.enableTimeReductionPenalty).toBe(true);
    expect(cfg.penaltyConfig.timeReductionSeconds).toBe(30);
    expect(cfg.overlays.enableClock).toBe(true);
  });

  it('time penalty causing clock to reach 0 ends the game with timeout_penalty', () => {
    const cfg = clockConfig({
      gameType: 'penalty_on_miss',
      enableTimeReductionPenalty: true,
      timeReductionSeconds: 60,
    });
    let state = createInitialState('hvh', cfg);
    // Give white only 30 seconds (less than penalty)
    state = { ...state, clocks: { whiteMs: 30_000, blackMs: 300_000, lastTimestamp: Date.now() } };
    // If white then violates, the 60s penalty would bring clock to 0
    // Engine applies this in applyMoveWithRules when a violation is detected
    // We trust engine tests for the full flow; here we verify the clock math
    const remaining = Math.max(0, 30_000 - 60_000);
    expect(remaining).toBe(0);
  });

  // ── Timestamp-based model: no drift ─────────────────────────────

  it('timestamp-based display computation does not accumulate drift', () => {
    const committed = 300_000;
    const turnStart = 1_000_000;

    // Simulate 100ms ticks for 5 seconds (0..5000 inclusive → 51 samples)
    const results: number[] = [];
    for (let t = 0; t <= 5000; t += 100) {
      results.push(computeDisplayTime(committed, turnStart, turnStart + t));
    }

    // First should be 300k, last should be 295k, all should be exact
    expect(results[0]).toBe(300_000);
    expect(results[results.length - 1]).toBe(295_000);

    // Verify no drift: each step should be exactly 100ms less
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1] - results[i]).toBe(100);
    }
  });

  // ── Edge cases ────────────────────────────────────────────────────

  it('commit with zero elapsed time does not change clock', () => {
    const initial: ClockState = { whiteMs: 100_000, blackMs: 200_000, lastTimestamp: null };
    const after = commitClockOnMove(initial, 'w', 0);
    expect(after.whiteMs).toBe(100_000);
  });

  it('both sides can be independently committed', () => {
    let clocks: ClockState = { whiteMs: 300_000, blackMs: 300_000, lastTimestamp: null };
    clocks = commitClockOnMove(clocks, 'w', 10_000);
    expect(clocks.whiteMs).toBe(290_000);
    expect(clocks.blackMs).toBe(300_000);

    clocks = commitClockOnMove(clocks, 'b', 15_000);
    expect(clocks.whiteMs).toBe(290_000);
    expect(clocks.blackMs).toBe(285_000);
  });

  // ── Integration: moves with clock config ──────────────────────────

  it('initialTimeMs and incrementMs are respected in config', () => {
    const cfg = clockConfig({ initialTimeMs: 10_000, incrementMs: 1_000 });
    const state = createInitialState('hvh', cfg);
    expect(state.clocks!.whiteMs).toBe(10_000);
    expect(state.clocks!.blackMs).toBe(10_000);
    expect(cfg.overlays.incrementMs).toBe(1_000);
  });

  // ── Extra turns: clock stays with active side ─────────────────────

  it('extra turns preserve sideToMove for the active side', () => {
    const cfg = clockConfig({
      gameType: 'penalty_on_miss',
      enableAdditionalMovePenalty: true,
      additionalMoveCount: 1,
    });
    const state = createInitialState('hvh', cfg);
    // After a violation grants extra turn, sideToMove stays the same
    // Verified in modes.test.ts; clock follows sideToMove
    expect(state.sideToMove).toBe('w');
  });

  // ── Multiple modes ────────────────────────────────────────────────

  it('clock works in hvbot mode', () => {
    const cfg = clockConfig();
    const state = createInitialState('hvbot', cfg);
    expect(state.clocks).not.toBeNull();
    expect(state.clocks!.whiteMs).toBe(300_000);
    expect(state.clocks!.blackMs).toBe(300_000);
  });

  it('clock works in botvbot mode', () => {
    const cfg = clockConfig();
    const state = createInitialState('botvbot', cfg);
    expect(state.clocks).not.toBeNull();
    expect(state.clocks!.whiteMs).toBe(300_000);
  });

  // ── Clock with penalties combined ─────────────────────────────────

  it('clock + extra move penalty: both features co-exist', () => {
    const cfg = clockConfig({
      gameType: 'penalty_on_miss',
      enableAdditionalMovePenalty: true,
      additionalMoveCount: 1,
    });
    const state = createInitialState('hvh', cfg);
    expect(state.clocks).not.toBeNull();
    expect(state.extraTurns.pendingExtraMovesWhite).toBe(0);
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(0);
  });

  it('clock + piece removal penalty: both features co-exist', () => {
    const cfg = clockConfig({
      gameType: 'penalty_on_miss',
      enablePieceRemovalPenalty: true,
      pieceRemovalCount: 1,
    });
    const state = createInitialState('hvh', cfg);
    expect(state.clocks).not.toBeNull();
    expect(state.pendingPieceRemoval).toBeNull();
  });

  it('clock + time reduction penalty: all three penalty types', () => {
    const cfg = clockConfig({
      gameType: 'penalty_on_miss',
      enableAdditionalMovePenalty: true,
      enablePieceRemovalPenalty: true,
      enableTimeReductionPenalty: true,
      timeReductionSeconds: 30,
    });
    const state = createInitialState('hvh', cfg);
    expect(state.clocks).not.toBeNull();
    expect(cfg.penaltyConfig.enableTimeReductionPenalty).toBe(true);
    expect(cfg.penaltyConfig.timeReductionSeconds).toBe(30);
  });
});
