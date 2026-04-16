import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, ApiError, getToken, setToken, clearToken } from '../services/apiClient';

// ── localStorage mock ────────────────────────────────────────────────

const store: Record<string, string> = {};

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Token helpers ────────────────────────────────────────────────────

describe('Token helpers', () => {
  it('getToken returns null when nothing stored', () => {
    expect(getToken()).toBeNull();
  });

  it('setToken + getToken roundtrips', () => {
    setToken('jwt-123');
    expect(getToken()).toBe('jwt-123');
  });

  it('clearToken removes the stored token', () => {
    setToken('jwt-123');
    clearToken();
    expect(getToken()).toBeNull();
  });
});

// ── apiFetch ─────────────────────────────────────────────────────────

describe('apiFetch', () => {
  it('sends GET requests with Authorization header', async () => {
    setToken('my-jwt');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ hello: 'world' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await apiFetch<{ hello: string }>('/api/test');

    expect(result).toEqual({ hello: 'world' });
    expect(mockFetch).toHaveBeenCalledWith('/api/test', {
      method: 'GET',
      headers: { Authorization: 'Bearer my-jwt' },
      body: undefined,
    });
  });

  it('sends POST with JSON body', async () => {
    setToken('tok');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ id: 1 }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await apiFetch('/api/data', { method: 'POST', body: { name: 'test' } });

    expect(mockFetch).toHaveBeenCalledWith('/api/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer tok',
      },
      body: JSON.stringify({ name: 'test' }),
    });
  });

  it('skips Authorization header when anonymous', async () => {
    setToken('should-not-appear');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    await apiFetch('/api/anon', { anonymous: true });

    const callHeaders = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders).not.toHaveProperty('Authorization');
  });

  it('handles 204 No Content', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: new Headers(),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await apiFetch('/api/empty', { method: 'DELETE' });
    expect(result).toBeUndefined();
  });

  it('throws ApiError on non-2xx', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ error: 'Not found' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(apiFetch('/api/missing')).rejects.toThrow(ApiError);
    try {
      await apiFetch('/api/missing');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(404);
      expect((e as ApiError).body).toEqual({ error: 'Not found' });
    }
  });

  it('handles non-JSON error responses', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers({ 'content-type': 'text/plain' }),
      text: async () => 'Internal Server Error',
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(apiFetch('/api/error')).rejects.toThrow(ApiError);
  });

  it('throws ApiError when 2xx response is not JSON (e.g. SPA fallback)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => '<html><body>index.html</body></html>',
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(apiFetch('/api/auth/providers')).rejects.toThrow(ApiError);
  });

  it('omits Authorization when no token stored', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    await apiFetch('/api/public');

    const callHeaders = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders).not.toHaveProperty('Authorization');
  });
});
