import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listGames } from '../../services/gamesService';

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

// ── listGames ────────────────────────────────────────────────────────

describe('listGames', () => {
  const mockResponse = { games: [], total: 0, page: 1, pageSize: 20 };

  function mockFetch() {
    const fn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockResponse,
    });
    vi.stubGlobal('fetch', fn);
    return fn;
  }

  it('sends GET /api/games with page and pageSize', async () => {
    const fetch = mockFetch();
    await listGames(2, 30);
    expect(fetch.mock.calls[0][0]).toBe('/api/games?page=2&pageSize=30');
  });

  it('uses defaults (page=1, pageSize=20) when no args are passed', async () => {
    const fetch = mockFetch();
    await listGames();
    expect(fetch.mock.calls[0][0]).toBe('/api/games?page=1&pageSize=20');
  });

  it('appends gameMode filter to URL', async () => {
    const fetch = mockFetch();
    await listGames(1, 20, { gameMode: 'multiplayer' });
    const url: string = fetch.mock.calls[0][0];
    expect(url).toContain('gameMode=multiplayer');
  });

  it('appends includeSpectated=false filter to URL', async () => {
    const fetch = mockFetch();
    await listGames(1, 20, { includeSpectated: false });
    const url: string = fetch.mock.calls[0][0];
    expect(url).toContain('includeSpectated=false');
  });

  it('does not append includeSpectated when true (default)', async () => {
    const fetch = mockFetch();
    await listGames(1, 20, { includeSpectated: true });
    const url: string = fetch.mock.calls[0][0];
    expect(url).not.toContain('includeSpectated');
  });

  it('does not append gameMode when not specified', async () => {
    const fetch = mockFetch();
    await listGames(1, 20, {});
    const url: string = fetch.mock.calls[0][0];
    expect(url).not.toContain('gameMode');
  });

  it('appends both filters when both are specified', async () => {
    const fetch = mockFetch();
    await listGames(1, 20, { gameMode: 'local', includeSpectated: false });
    const url: string = fetch.mock.calls[0][0];
    expect(url).toContain('gameMode=local');
    expect(url).toContain('includeSpectated=false');
  });
});
