import { describe, it, expect } from 'vitest';
import { createSimulationRecord } from '../core/gameRecord';
import type { GameRecord } from '../core/gameRecord';
import { DEFAULT_SETUP_CONFIG } from '../core/blunziger/types';
import type { ScoreState } from '../core/blunziger/types';

function makeGameRecord(winner: 'w' | 'b' | 'draw'): GameRecord {
  return {
    id: `g-${Date.now()}-${Math.random()}`,
    completedAt: Date.now(),
    config: { ...DEFAULT_SETUP_CONFIG, mode: 'botvbot' },
    result: { winner, reason: winner === 'draw' ? 'draw' : 'checkmate' },
    finalFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    moveCount: 20,
    scores: { w: 0, b: 0 } as ScoreState,
    positionHistory: [],
    moveHistory: [],
    violationReports: [],
    missedChecks: [],
    pieceRemovals: [],
    timeReductions: [],
  };
}

describe('createSimulationRecord', () => {
  it('creates a record with correct standing', () => {
    const games = [
      makeGameRecord('w'),
      makeGameRecord('w'),
      makeGameRecord('b'),
      makeGameRecord('draw'),
    ];
    const config = { ...DEFAULT_SETUP_CONFIG, mode: 'botvbot' as const };
    const record = createSimulationRecord(config, games);

    expect(record.standing.whiteWins).toBe(2);
    expect(record.standing.blackWins).toBe(1);
    expect(record.standing.draws).toBe(1);
  });

  it('creates a record with a unique id', () => {
    const config = { ...DEFAULT_SETUP_CONFIG, mode: 'botvbot' as const };
    const r1 = createSimulationRecord(config, []);
    const r2 = createSimulationRecord(config, []);
    expect(r1.id).not.toBe(r2.id);
  });

  it('stores the config and games', () => {
    const config = { ...DEFAULT_SETUP_CONFIG, mode: 'botvbot' as const, botDifficulty: 'hard' as const };
    const games = [makeGameRecord('w')];
    const record = createSimulationRecord(config, games);

    expect(record.config).toBe(config);
    expect(record.games).toBe(games);
    expect(record.games.length).toBe(1);
  });

  it('sets completedAt timestamp', () => {
    const before = Date.now();
    const record = createSimulationRecord({ ...DEFAULT_SETUP_CONFIG, mode: 'botvbot' as const }, []);
    const after = Date.now();
    expect(record.completedAt).toBeGreaterThanOrEqual(before);
    expect(record.completedAt).toBeLessThanOrEqual(after);
  });
});
