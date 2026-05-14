import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createRoom,
  joinRoom,
  listRooms,
  joinMatchmaking,
  cancelMatchmaking,
  getActiveRoom,
} from '../../services/lobbyService';

// ── Mocks ────────────────────────────────────────────────────────────

const store: Record<string, string> = {};

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  store['blunzinger_token'] = 'test-jwt';
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── createRoom ───────────────────────────────────────────────────────

describe('createRoom', () => {
  it('sends POST /api/lobby/rooms with matchConfig', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ roomId: 'r1', code: 'ABC123' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await createRoom('{"variant":"classic"}');

    expect(result.roomId).toBe('r1');
    expect(result.code).toBe('ABC123');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/lobby/rooms');
    expect(mockFetch.mock.calls[0][1].method).toBe('POST');
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
      matchConfig: '{"variant":"classic"}',
    });
  });
});

// ── joinRoom ─────────────────────────────────────────────────────────

describe('joinRoom', () => {
  it('sends POST /api/lobby/rooms/join with code', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ roomId: 'r2', code: 'XYZ789' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await joinRoom('XYZ789');

    expect(result.code).toBe('XYZ789');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/lobby/rooms/join');
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ code: 'XYZ789' });
  });
});

// ── listRooms ────────────────────────────────────────────────────────

describe('listRooms', () => {
  it('sends GET /api/lobby/rooms', async () => {
    const rooms = [
      { id: 'r1', code: 'ABC', matchConfig: '{}', createdAt: '2024-01-01', hostName: 'Alice' },
    ];
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ rooms }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await listRooms();

    expect(result.rooms).toHaveLength(1);
    expect(result.rooms[0].hostName).toBe('Alice');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/lobby/rooms');
    expect(mockFetch.mock.calls[0][1].method).toBe('GET');
  });
});

// ── matchmaking ──────────────────────────────────────────────────────

describe('joinMatchmaking', () => {
  it('sends POST /api/lobby/matchmaking', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ entryId: 'e1' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await joinMatchmaking('{"variant":"classic"}');

    expect(result.entryId).toBe('e1');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/lobby/matchmaking');
    expect(mockFetch.mock.calls[0][1].method).toBe('POST');
  });
});

describe('cancelMatchmaking', () => {
  it('sends DELETE /api/lobby/matchmaking', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: new Headers(),
    });
    vi.stubGlobal('fetch', mockFetch);

    await cancelMatchmaking();

    expect(mockFetch.mock.calls[0][0]).toBe('/api/lobby/matchmaking');
    expect(mockFetch.mock.calls[0][1].method).toBe('DELETE');
  });
});

// ── getActiveRoom ────────────────────────────────────────────────────

describe('getActiveRoom', () => {
  it('sends GET /api/lobby/rooms/active', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        active: true,
        roomCode: 'ABC123',
        playerColor: 'w',
        opponentName: 'Bob',
        matchConfig: '{}',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await getActiveRoom();

    expect(result.active).toBe(true);
    expect(result.roomCode).toBe('ABC123');
    expect(result.playerColor).toBe('w');
    expect(result.opponentName).toBe('Bob');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/lobby/rooms/active');
    expect(mockFetch.mock.calls[0][1].method).toBe('GET');
  });

  it('returns active=false when no active game', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ active: false }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await getActiveRoom();

    expect(result.active).toBe(false);
    expect(result.roomCode).toBeUndefined();
  });
});
