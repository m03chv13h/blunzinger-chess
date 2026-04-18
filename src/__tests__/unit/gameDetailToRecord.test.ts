import { describe, it, expect } from 'vitest';
import { gameDetailToRecord } from '../../hooks/useGameHistory';
import { DEFAULT_SETUP_CONFIG } from '../../core/blunziger/types';
import type { GameDetail } from '../../services/gamesService';

describe('gameDetailToRecord', () => {
  const config = { ...DEFAULT_SETUP_CONFIG, mode: 'hvh' as const };
  const result = { winner: 'w' as const, reason: 'checkmate' as const };
  const scores = { w: 3, b: 1 };
  const positionHistory = [
    { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', scores: { w: 0, b: 0 } },
    { fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', scores: { w: 0, b: 0 } },
  ];
  const moveHistory = [{ san: 'e4', from: 'e2', to: 'e4', color: 'w' }];

  function makeDetail(overrides: Partial<GameDetail> = {}): GameDetail {
    return {
      id: 'remote-1',
      matchConfig: JSON.stringify(config),
      result: JSON.stringify(result),
      scores: JSON.stringify(scores),
      positionHistory: JSON.stringify(positionHistory),
      moveHistory: JSON.stringify(moveHistory),
      finalFen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
      moveCount: 1,
      createdAt: '2025-01-01T00:00:00Z',
      completedAt: '2025-01-01T00:05:00Z',
      ...overrides,
    };
  }

  it('parses config from JSON', () => {
    const record = gameDetailToRecord(makeDetail());
    expect(record.config.mode).toBe('hvh');
    expect(record.config.variantMode).toBe(config.variantMode);
  });

  it('parses result from JSON', () => {
    const record = gameDetailToRecord(makeDetail());
    expect(record.result.winner).toBe('w');
    expect(record.result.reason).toBe('checkmate');
  });

  it('parses scores from JSON', () => {
    const record = gameDetailToRecord(makeDetail());
    expect(record.scores).toEqual({ w: 3, b: 1 });
  });

  it('parses positionHistory from JSON', () => {
    const record = gameDetailToRecord(makeDetail());
    expect(record.positionHistory).toHaveLength(2);
    expect(record.positionHistory[0].fen).toContain('rnbqkbnr');
  });

  it('parses moveHistory from JSON', () => {
    const record = gameDetailToRecord(makeDetail());
    expect(record.moveHistory).toHaveLength(1);
    expect(record.moveHistory[0].san).toBe('e4');
  });

  it('preserves id and finalFen', () => {
    const record = gameDetailToRecord(makeDetail());
    expect(record.id).toBe('remote-1');
    expect(record.finalFen).toContain('4P3');
  });

  it('uses completedAt timestamp', () => {
    const record = gameDetailToRecord(makeDetail());
    expect(record.completedAt).toBe(new Date('2025-01-01T00:05:00Z').getTime());
  });

  it('falls back to createdAt when completedAt is missing', () => {
    const record = gameDetailToRecord(makeDetail({ completedAt: undefined }));
    expect(record.completedAt).toBe(new Date('2025-01-01T00:00:00Z').getTime());
  });

  it('provides defaults for missing optional fields', () => {
    const record = gameDetailToRecord(makeDetail({
      result: undefined,
      scores: undefined,
      positionHistory: undefined,
      moveHistory: undefined,
      finalFen: undefined,
    }));
    expect(record.result).toEqual({ winner: 'draw', reason: 'unknown' });
    expect(record.scores).toEqual({ w: 0, b: 0 });
    expect(record.positionHistory).toEqual([]);
    expect(record.moveHistory).toEqual([]);
    expect(record.finalFen).toContain('RNBQKBNR');
  });

  it('initializes violation-related arrays as empty', () => {
    const record = gameDetailToRecord(makeDetail());
    expect(record.violationReports).toEqual([]);
    expect(record.missedChecks).toEqual([]);
    expect(record.pieceRemovals).toEqual([]);
    expect(record.timeReductions).toEqual([]);
  });
});
