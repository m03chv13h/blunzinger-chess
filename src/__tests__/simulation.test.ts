import { describe, it, expect } from 'vitest';
import { runSimulatedGame } from '../core/simulation';
import { DEFAULT_SETUP_CONFIG } from '../core/blunziger/types';
import type { GameSetupConfig } from '../core/blunziger/types';

describe('runSimulatedGame', () => {
  it('produces a completed game record with a result', () => {
    const config: GameSetupConfig = {
      ...DEFAULT_SETUP_CONFIG,
      mode: 'botvbot',
      botDifficulty: 'easy',
    };
    const record = runSimulatedGame(config);
    expect(record.result).toBeDefined();
    expect(record.result.winner).toMatch(/^(w|b|draw)$/);
    expect(record.result.reason).toBeTruthy();
  });

  it('produces a record with move history', () => {
    const config: GameSetupConfig = {
      ...DEFAULT_SETUP_CONFIG,
      mode: 'botvbot',
      botDifficulty: 'easy',
    };
    const record = runSimulatedGame(config);
    expect(record.moveCount).toBeGreaterThan(0);
    expect(record.moveHistory.length).toBe(record.moveCount);
  });

  it('produces a valid FEN in the final position', () => {
    const config: GameSetupConfig = {
      ...DEFAULT_SETUP_CONFIG,
      mode: 'botvbot',
      botDifficulty: 'easy',
    };
    const record = runSimulatedGame(config);
    // FEN has at least 6 space-separated parts
    expect(record.finalFen.split(' ').length).toBeGreaterThanOrEqual(6);
  });

  it('forces botvbot mode regardless of config.mode', () => {
    const config: GameSetupConfig = {
      ...DEFAULT_SETUP_CONFIG,
      mode: 'hvh', // not botvbot
      botDifficulty: 'easy',
    };
    const record = runSimulatedGame(config);
    // The config used should be botvbot
    expect(record.config.mode).toBe('botvbot');
  });

  it('disables clock in simulation', () => {
    const config: GameSetupConfig = {
      ...DEFAULT_SETUP_CONFIG,
      mode: 'botvbot',
      botDifficulty: 'easy',
      enableClock: true,
      initialTimeMs: 60000,
    };
    const record = runSimulatedGame(config);
    // Clock should be disabled in the simulation config
    expect(record.config.enableClock).toBe(false);
  });

  it('produces a record with position history', () => {
    const config: GameSetupConfig = {
      ...DEFAULT_SETUP_CONFIG,
      mode: 'botvbot',
      botDifficulty: 'easy',
    };
    const record = runSimulatedGame(config);
    // Position history should have at least the initial position plus moves
    expect(record.positionHistory.length).toBeGreaterThan(1);
  });

  it('works with penalty_on_miss game type', () => {
    const config: GameSetupConfig = {
      ...DEFAULT_SETUP_CONFIG,
      mode: 'botvbot',
      botDifficulty: 'easy',
      gameType: 'penalty_on_miss',
      enableAdditionalMovePenalty: true,
      additionalMoveCount: 1,
    };
    const record = runSimulatedGame(config);
    expect(record.result).toBeDefined();
    expect(record.result.winner).toMatch(/^(w|b|draw)$/);
  });

  it('works with reverse_blunzinger variant', () => {
    const config: GameSetupConfig = {
      ...DEFAULT_SETUP_CONFIG,
      mode: 'botvbot',
      botDifficulty: 'easy',
      variantMode: 'reverse_blunzinger',
    };
    const record = runSimulatedGame(config);
    expect(record.result).toBeDefined();
  }, 15000);

  it('works with king hunt move limit variant', () => {
    const config: GameSetupConfig = {
      ...DEFAULT_SETUP_CONFIG,
      mode: 'botvbot',
      botDifficulty: 'easy',
      variantMode: 'classic_king_hunt_move_limit',
      kingHuntPlyLimit: 20,
    };
    const record = runSimulatedGame(config);
    expect(record.result).toBeDefined();
  });

  it('has a unique id per game', () => {
    const config: GameSetupConfig = {
      ...DEFAULT_SETUP_CONFIG,
      mode: 'botvbot',
      botDifficulty: 'easy',
    };
    const record1 = runSimulatedGame(config);
    const record2 = runSimulatedGame(config);
    expect(record1.id).not.toBe(record2.id);
  });

  it('works with crazyhouse overlay', () => {
    const config: GameSetupConfig = {
      ...DEFAULT_SETUP_CONFIG,
      mode: 'botvbot',
      botDifficulty: 'easy',
      enableCrazyhouse: true,
    };
    const record = runSimulatedGame(config);
    expect(record.result).toBeDefined();
    expect(record.result.winner).toMatch(/^(w|b|draw)$/);
  });

  it('works with different bot difficulty per side', () => {
    const config: GameSetupConfig = {
      ...DEFAULT_SETUP_CONFIG,
      mode: 'botvbot',
      botDifficulty: 'easy',
      botDifficultyWhite: 'medium',
      botDifficultyBlack: 'easy',
    };
    const record = runSimulatedGame(config);
    expect(record.result).toBeDefined();
    expect(record.result.winner).toMatch(/^(w|b|draw)$/);
    // Config should preserve per-side difficulty
    expect(record.config.botDifficultyWhite).toBe('medium');
    expect(record.config.botDifficultyBlack).toBe('easy');
  }, 15000);
});
