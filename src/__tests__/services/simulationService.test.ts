import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runSimulatedGameRemote, runBatchSimulationRemote, listSimulations, getSimulation } from '../../services/simulationService';
import type { GameSetupConfig } from '../../core/blunziger/types';
import { DEFAULT_SETUP_CONFIG } from '../../core/blunziger/types';

// ── Mocks ────────────────────────────────────────────────────────────

const store: Record<string, string> = {};

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  store['blunziger_token'] = 'test-jwt';
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── runSimulatedGameRemote ───────────────────────────────────────────

describe('runSimulatedGameRemote', () => {
  const config: GameSetupConfig = {
    ...DEFAULT_SETUP_CONFIG,
    mode: 'botvbot',
    botDifficulty: 'easy',
  };

  it('sends POST /api/simulation/run with config body', async () => {
    const mockRecord = {
      id: 'sim-1',
      completedAt: 1700000000000,
      config,
      result: { winner: 'w', reason: 'checkmate' },
      finalFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      moveCount: 42,
      scores: { w: 0, b: 0 },
      positionHistory: [],
      moveHistory: [],
      violationReports: [],
      missedChecks: [],
      pieceRemovals: [],
      timeReductions: [],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockRecord,
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await runSimulatedGameRemote(config);

    expect(result.id).toBe('sim-1');
    expect(result.result.winner).toBe('w');
    expect(result.moveCount).toBe(42);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/simulation/run');
    expect(mockFetch.mock.calls[0][1].method).toBe('POST');
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual(config);
  });

  it('includes Authorization header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        id: 'sim-2',
        result: { winner: 'draw', reason: 'stalemate' },
        moveCount: 10,
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await runSimulatedGameRemote(config);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['Authorization']).toBe('Bearer test-jwt');
  });
});

// ── runBatchSimulationRemote ─────────────────────────────────────────

describe('runBatchSimulationRemote', () => {
  const config: GameSetupConfig = {
    ...DEFAULT_SETUP_CONFIG,
    mode: 'botvbot',
    botDifficulty: 'easy',
  };

  it('sends POST /api/simulation/run-batch with config and count', async () => {
    const mockSimulation = {
      id: 'batch-1',
      completedAt: 1700000000000,
      config,
      games: [
        { id: 'g1', result: { winner: 'w', reason: 'checkmate' }, moveCount: 20 },
        { id: 'g2', result: { winner: 'b', reason: 'checkmate' }, moveCount: 30 },
      ],
      standing: { whiteWins: 1, blackWins: 1, draws: 0 },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockSimulation,
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await runBatchSimulationRemote(config, 2);

    expect(result.id).toBe('batch-1');
    expect(result.standing.whiteWins).toBe(1);
    expect(result.standing.blackWins).toBe(1);
    expect(result.games).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/simulation/run-batch');
    expect(mockFetch.mock.calls[0][1].method).toBe('POST');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.config).toEqual(config);
    expect(body.count).toBe(2);
  });
});

// ── listSimulations ──────────────────────────────────────────────────

describe('listSimulations', () => {
  it('sends GET /api/simulation with pagination params', async () => {
    const mockResponse = {
      simulations: [{ id: 's1', gameCount: 10 }],
      total: 1,
      page: 1,
      pageSize: 20,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockResponse,
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await listSimulations(1, 20);

    expect(result.total).toBe(1);
    expect(result.simulations).toHaveLength(1);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/simulation?page=1&pageSize=20');
  });
});

// ── getSimulation ────────────────────────────────────────────────────

describe('getSimulation', () => {
  it('sends GET /api/simulation/:id', async () => {
    const mockSimulation = {
      id: 'abc-123',
      completedAt: 1700000000000,
      config: { ...DEFAULT_SETUP_CONFIG, mode: 'botvbot' },
      games: [],
      standing: { whiteWins: 0, blackWins: 0, draws: 0 },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockSimulation,
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await getSimulation('abc-123');

    expect(result.id).toBe('abc-123');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/simulation/abc-123');
  });
});
