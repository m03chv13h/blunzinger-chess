import { describe, it, expect } from 'vitest';
import { getUserOutcome, getUserResultLabel } from '../../core/gameRecord';
import { DEFAULT_SETUP_CONFIG } from '../../core/blunziger/types';
import type { GameResult, GameSetupConfig } from '../../core/blunziger/types';

describe('getUserOutcome', () => {
  const baseConfig: GameSetupConfig = { ...DEFAULT_SETUP_CONFIG };

  describe('hvbot mode', () => {
    it('returns win when user (white) wins against bot (black)', () => {
      const config = { ...baseConfig, mode: 'hvbot' as const, botSide: 'b' as const };
      const result: GameResult = { winner: 'w', reason: 'checkmate' };
      expect(getUserOutcome(result, config)).toBe('win');
    });

    it('returns loss when bot (black) wins against user (white)', () => {
      const config = { ...baseConfig, mode: 'hvbot' as const, botSide: 'b' as const };
      const result: GameResult = { winner: 'b', reason: 'checkmate' };
      expect(getUserOutcome(result, config)).toBe('loss');
    });

    it('returns win when user (black) wins against bot (white)', () => {
      const config = { ...baseConfig, mode: 'hvbot' as const, botSide: 'w' as const };
      const result: GameResult = { winner: 'b', reason: 'checkmate' };
      expect(getUserOutcome(result, config)).toBe('win');
    });

    it('returns loss when bot (white) wins against user (black)', () => {
      const config = { ...baseConfig, mode: 'hvbot' as const, botSide: 'w' as const };
      const result: GameResult = { winner: 'w', reason: 'checkmate' };
      expect(getUserOutcome(result, config)).toBe('loss');
    });

    it('returns draw for drawn game', () => {
      const config = { ...baseConfig, mode: 'hvbot' as const, botSide: 'b' as const };
      const result: GameResult = { winner: 'draw', reason: 'stalemate' };
      expect(getUserOutcome(result, config)).toBe('draw');
    });
  });

  describe('hvh mode', () => {
    it('assumes user is white — returns win when white wins', () => {
      const config = { ...baseConfig, mode: 'hvh' as const };
      const result: GameResult = { winner: 'w', reason: 'checkmate' };
      expect(getUserOutcome(result, config)).toBe('win');
    });

    it('assumes user is white — returns loss when black wins', () => {
      const config = { ...baseConfig, mode: 'hvh' as const };
      const result: GameResult = { winner: 'b', reason: 'checkmate' };
      expect(getUserOutcome(result, config)).toBe('loss');
    });

    it('returns draw for drawn game', () => {
      const config = { ...baseConfig, mode: 'hvh' as const };
      const result: GameResult = { winner: 'draw', reason: 'stalemate' };
      expect(getUserOutcome(result, config)).toBe('draw');
    });
  });

  describe('botvbot mode', () => {
    it('returns null (spectator, no user perspective)', () => {
      const config = { ...baseConfig, mode: 'botvbot' as const };
      const result: GameResult = { winner: 'w', reason: 'checkmate' };
      expect(getUserOutcome(result, config)).toBeNull();
    });

    it('returns draw (draw is detected before mode check)', () => {
      const config = { ...baseConfig, mode: 'botvbot' as const };
      const result: GameResult = { winner: 'draw', reason: 'stalemate' };
      // Draw is detected before mode check
      expect(getUserOutcome(result, config)).toBe('draw');
    });
  });

  describe('explicit playerColor override', () => {
    it('uses playerColor over config inference', () => {
      const config = { ...baseConfig, mode: 'hvh' as const };
      const result: GameResult = { winner: 'b', reason: 'checkmate' };
      // Without playerColor, hvh assumes white -> this would be loss
      // With playerColor='b', user is black -> this is a win
      expect(getUserOutcome(result, config, 'b')).toBe('win');
    });

    it('playerColor overrides botvbot null behavior', () => {
      const config = { ...baseConfig, mode: 'botvbot' as const };
      const result: GameResult = { winner: 'w', reason: 'checkmate' };
      // Without playerColor, botvbot returns null
      // With explicit playerColor, it should return result from that perspective
      expect(getUserOutcome(result, config, 'w')).toBe('win');
    });
  });
});

describe('getUserResultLabel', () => {
  it('returns Victory for win', () => {
    expect(getUserResultLabel('win')).toBe('Victory');
  });

  it('returns Defeat for loss', () => {
    expect(getUserResultLabel('loss')).toBe('Defeat');
  });

  it('returns Draw for draw', () => {
    expect(getUserResultLabel('draw')).toBe('Draw');
  });
});
