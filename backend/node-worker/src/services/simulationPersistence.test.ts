import { describe, expect, it } from 'vitest';
import { mapOpenSimulationRows } from './simulationPersistence.js';

describe('mapOpenSimulationRows', () => {
  it('maps valid rows into restorable jobs', () => {
    const jobs = mapOpenSimulationRows([
      {
        id: 'sim-1',
        configJson: '{"mode":"botvbot"}',
        gameCount: 10,
        gamesJson: '[{"id":"g1"},{"id":"g2"}]',
      },
    ]);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.simulationId).toBe('sim-1');
    expect(jobs[0]?.totalGames).toBe(10);
    expect(jobs[0]?.completedRecords).toHaveLength(2);
  });

  it('skips rows with invalid config JSON', () => {
    const jobs = mapOpenSimulationRows([
      {
        id: 'sim-1',
        configJson: '{"mode":',
        gameCount: 5,
        gamesJson: '[]',
      },
    ]);

    expect(jobs).toEqual([]);
  });

  it('skips rows that are already complete', () => {
    const jobs = mapOpenSimulationRows([
      {
        id: 'sim-1',
        configJson: '{"mode":"botvbot"}',
        gameCount: 2,
        gamesJson: '[{"id":"g1"},{"id":"g2"}]',
      },
    ]);

    expect(jobs).toEqual([]);
  });
});
