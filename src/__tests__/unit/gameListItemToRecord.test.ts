import { describe, it, expect } from 'vitest';
import { gameListItemToRecord } from '../../hooks/useGameHistory';
import { DEFAULT_SETUP_CONFIG } from '../../core/blunzinger/types';
import type { GameListItem } from '../../services/gamesService';

describe('gameListItemToRecord', () => {
  const config = { ...DEFAULT_SETUP_CONFIG, mode: 'hvbot' as const };
  const result = { winner: 'w' as const, reason: 'checkmate' as const };
  const scores = { w: 3, b: 1 };

  function makeListItem(overrides: Partial<GameListItem> = {}): GameListItem {
    return {
      id: 'remote-1',
      matchConfig: JSON.stringify(config),
      result: JSON.stringify(result),
      scores: JSON.stringify(scores),
      finalFen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
      moveCount: 10,
      gameMode: 'local',
      createdAt: '2025-01-01T00:00:00Z',
      completedAt: '2025-01-01T00:05:00Z',
      ...overrides,
    };
  }

  it('parses config from JSON', () => {
    const record = gameListItemToRecord(makeListItem());
    expect(record.config.mode).toBe('hvbot');
    expect(record.config.variantMode).toBe(config.variantMode);
  });

  it('parses result from JSON', () => {
    const record = gameListItemToRecord(makeListItem());
    expect(record.result.winner).toBe('w');
    expect(record.result.reason).toBe('checkmate');
  });

  it('parses scores from JSON', () => {
    const record = gameListItemToRecord(makeListItem());
    expect(record.scores).toEqual({ w: 3, b: 1 });
  });

  it('preserves id, finalFen, and moveCount', () => {
    const record = gameListItemToRecord(makeListItem());
    expect(record.id).toBe('remote-1');
    expect(record.finalFen).toContain('4P3');
    expect(record.moveCount).toBe(10);
  });

  it('uses completedAt timestamp', () => {
    const record = gameListItemToRecord(makeListItem());
    expect(record.completedAt).toBe(new Date('2025-01-01T00:05:00Z').getTime());
  });

  it('falls back to createdAt when completedAt is missing', () => {
    const record = gameListItemToRecord(makeListItem({ completedAt: undefined }));
    expect(record.completedAt).toBe(new Date('2025-01-01T00:00:00Z').getTime());
  });

  it('provides defaults for missing optional fields', () => {
    const record = gameListItemToRecord(makeListItem({
      result: undefined,
      scores: undefined,
      finalFen: undefined,
    }));
    expect(record.result).toEqual({ winner: 'draw', reason: 'draw' });
    expect(record.scores).toEqual({ w: 0, b: 0 });
    expect(record.finalFen).toContain('RNBQKBNR');
  });

  it('has empty position and move history (list items are summaries)', () => {
    const record = gameListItemToRecord(makeListItem());
    expect(record.positionHistory).toEqual([]);
    expect(record.moveHistory).toEqual([]);
  });

  it('initializes violation-related arrays as empty', () => {
    const record = gameListItemToRecord(makeListItem());
    expect(record.violationReports).toEqual([]);
    expect(record.missedChecks).toEqual([]);
    expect(record.pieceRemovals).toEqual([]);
    expect(record.timeReductions).toEqual([]);
  });

  it('marks game as online when gameMode is multiplayer', () => {
    const record = gameListItemToRecord(makeListItem({ gameMode: 'multiplayer' }));
    expect(record.isOnline).toBe(true);
  });

  it('marks game as not online when gameMode is local', () => {
    const record = gameListItemToRecord(makeListItem({ gameMode: 'local' }));
    expect(record.isOnline).toBe(false);
  });
});
