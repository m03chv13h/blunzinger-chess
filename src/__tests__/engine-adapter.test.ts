import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { EngineId, VariantEngineAdapter } from '../core/engine/types';
import {
  getAllEngineInfos,
  getEngineInfo,
  getAvailableEngineInfos,
  createEngineAdapter,
  DEFAULT_ENGINE_ID,
} from '../core/engine/engineRegistry';
import { createHeuristicAdapter } from '../core/engine/adapters/heuristicAdapter';
import { createBlunznforönAdapter } from '../core/engine/adapters/blunznforönAdapter';
import { INITIAL_FEN, DEFAULT_SETUP_CONFIG } from '../core/blunziger/types';
import { createInitialState } from '../core/blunziger/engine';

describe('Engine Abstraction Layer', () => {
  // ── Registry ───────────────────────────────────────────────────────

  describe('engineRegistry', () => {
    it('should list all registered engines', () => {
      const infos = getAllEngineInfos();
      const ids = infos.map((i) => i.id);
      expect(ids).toContain('heuristic');
      expect(ids).toContain('blunznforön');
      expect(ids).toContain('blunznfish');
    });

    it('should expose engine metadata', () => {
      const heuristic = getEngineInfo('heuristic');
      expect(heuristic).toBeDefined();
      expect(heuristic!.name).toBe('Heuristic');
      expect(heuristic!.availability).toBe('available');
      expect(heuristic!.supportsEvaluation).toBe(true);
      expect(heuristic!.supportsBotPlay).toBe(true);

      const blunznforön = getEngineInfo('blunznforön');
      expect(blunznforön).toBeDefined();
      expect(blunznforön!.name).toBe('Blunznforön');
      expect(blunznforön!.availability).toBe('available');
      expect(blunznforön!.supportsVariantAwareness).toBe(true);
    });

    it('should mark Blunznfish as coming_soon', () => {
      const blunznfish = getEngineInfo('blunznfish');
      expect(blunznfish).toBeDefined();
      expect(blunznfish!.availability).toBe('coming_soon');
      expect(blunznfish!.name).toBe('Blunznfish');
    });

    it('getAvailableEngineInfos should exclude non-available engines', () => {
      const available = getAvailableEngineInfos();
      const ids = available.map((i) => i.id);
      expect(ids).toContain('heuristic');
      expect(ids).toContain('blunznforön');
      expect(ids).not.toContain('blunznfish');
    });

    it('should create adapters for available engines', () => {
      const adapter = createEngineAdapter('heuristic');
      expect(adapter).toBeDefined();
      expect(adapter.info.id).toBe('heuristic');

      const blunzn = createEngineAdapter('blunznforön');
      expect(blunzn).toBeDefined();
      expect(blunzn.info.id).toBe('blunznforön');
    });

    it('should throw when creating adapter for unregistered engine', () => {
      expect(() => createEngineAdapter('blunznfish' as EngineId)).toThrow();
    });

    it('DEFAULT_ENGINE_ID should be heuristic', () => {
      expect(DEFAULT_ENGINE_ID).toBe('heuristic');
    });
  });

  // ── Heuristic Adapter ─────────────────────────────────────────────

  describe('heuristicAdapter', () => {
    let adapter: VariantEngineAdapter;

    beforeEach(() => {
      adapter = createHeuristicAdapter();
    });

    afterEach(() => {
      adapter.dispose();
    });

    it('should initialize without error', async () => {
      await expect(adapter.initialize()).resolves.toBeUndefined();
    });

    it('should analyze the starting position', async () => {
      await adapter.initialize();
      const lines = await adapter.analyzePosition({ fen: INITIAL_FEN });
      expect(lines.length).toBeGreaterThan(0);
      const line = lines[0];
      expect(line.score).toBeDefined();
      expect(line.score.scoreCp).toBeDefined();
      expect(typeof line.score.scoreCp).toBe('number');
    });

    it('should return a best move from starting position', async () => {
      await adapter.initialize();
      const move = await adapter.getBestMove({ fen: INITIAL_FEN });
      expect(move).not.toBeNull();
      expect(typeof move).toBe('string');
      expect(move!.length).toBeGreaterThanOrEqual(4); // e.g. "e2e4"
    });

    it('should return null for checkmate position', async () => {
      await adapter.initialize();
      const matedFen = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
      const move = await adapter.getBestMove({ fen: matedFen });
      expect(move).toBeNull();
    });

    it('should provide a score with a clear advantage for white in a winning position', async () => {
      await adapter.initialize();
      // White has massive material advantage
      const fen = 'k7/8/8/8/8/8/8/KQR5 w - - 0 1';
      const lines = await adapter.analyzePosition({ fen });
      expect(lines[0].score.scoreCp).toBeGreaterThan(0);
    });
  });

  // ── Blunznforön Adapter ───────────────────────────────────────────

  describe('blunznforönAdapter', () => {
    let adapter: VariantEngineAdapter;

    beforeEach(() => {
      adapter = createBlunznforönAdapter();
    });

    afterEach(() => {
      adapter.dispose();
    });

    it('should initialize without error', async () => {
      await expect(adapter.initialize()).resolves.toBeUndefined();
    });

    it('should analyze the starting position', async () => {
      await adapter.initialize();
      const lines = await adapter.analyzePosition({ fen: INITIAL_FEN });
      expect(lines.length).toBeGreaterThan(0);
      expect(lines[0].score).toBeDefined();
      expect(lines[0].score.scoreCp).toBeDefined();
    });

    it('should return a best move from starting position', async () => {
      await adapter.initialize();
      const move = await adapter.getBestMove({ fen: INITIAL_FEN });
      expect(move).not.toBeNull();
      expect(typeof move).toBe('string');
    });

    it('should accept variant key in options', async () => {
      await adapter.initialize();
      const lines = await adapter.analyzePosition({
        fen: INITIAL_FEN,
        variantKey: 'chess',
        depth: 8,
      });
      expect(lines.length).toBeGreaterThan(0);
    });

    it('should return empty results after dispose', async () => {
      await adapter.initialize();
      adapter.dispose();
      const lines = await adapter.analyzePosition({ fen: INITIAL_FEN });
      expect(lines).toEqual([]);
      const move = await adapter.getBestMove({ fen: INITIAL_FEN });
      expect(move).toBeNull();
    });
  });

  // ── Per-side Engine Selection in GameState ─────────────────────────

  describe('per-side engine selection', () => {
    it('createInitialState should store engine IDs', () => {
      const state = createInitialState('botvbot', undefined, 'easy', 'b', 'blunznforön', 'heuristic');
      expect(state.engineIdWhite).toBe('blunznforön');
      expect(state.engineIdBlack).toBe('heuristic');
    });

    it('createInitialState should default engine IDs to heuristic', () => {
      const state = createInitialState();
      expect(state.engineIdWhite).toBe('heuristic');
      expect(state.engineIdBlack).toBe('heuristic');
    });

    it('GameSetupConfig defaults should include engine IDs', () => {
      expect(DEFAULT_SETUP_CONFIG.engineId).toBe('heuristic');
      expect(DEFAULT_SETUP_CONFIG.engineIdWhite).toBe('heuristic');
      expect(DEFAULT_SETUP_CONFIG.engineIdBlack).toBe('heuristic');
    });
  });

  // ── Adapter Interface Contract ─────────────────────────────────────

  describe('adapter interface contract', () => {
    const adapterFactories: Array<{ id: EngineId; create: () => VariantEngineAdapter }> = [
      { id: 'heuristic', create: createHeuristicAdapter },
      { id: 'blunznforön', create: createBlunznforönAdapter },
    ];

    for (const { id, create } of adapterFactories) {
      describe(`${id} adapter`, () => {
        it('should have required info fields', () => {
          const adapter = create();
          expect(adapter.info.id).toBe(id);
          expect(typeof adapter.info.name).toBe('string');
          expect(typeof adapter.info.description).toBe('string');
          expect(['available', 'unavailable', 'coming_soon']).toContain(adapter.info.availability);
          expect(typeof adapter.info.supportsEvaluation).toBe('boolean');
          expect(typeof adapter.info.supportsBotPlay).toBe('boolean');
          expect(typeof adapter.info.supportsVariantAwareness).toBe('boolean');
          adapter.dispose();
        });

        it('should implement initialize, analyzePosition, getBestMove, dispose', () => {
          const adapter = create();
          expect(typeof adapter.initialize).toBe('function');
          expect(typeof adapter.analyzePosition).toBe('function');
          expect(typeof adapter.getBestMove).toBe('function');
          expect(typeof adapter.dispose).toBe('function');
          adapter.dispose();
        });
      });
    }
  });
});
