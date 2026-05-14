import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createGuest, fetchMe, fetchProviders, getOAuthLoginUrl } from '../../services/authService';
import type { OAuthProvider } from '../../services/authService';

// ── Mocks ────────────────────────────────────────────────────────────

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

// ── createGuest ──────────────────────────────────────────────────────

describe('createGuest', () => {
  it('calls POST /api/auth/guest and stores the token', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        token: 'guest-jwt-123',
        userId: 'uid-1',
        displayName: 'Guest_abc',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await createGuest();

    expect(result.token).toBe('guest-jwt-123');
    expect(result.userId).toBe('uid-1');
    expect(result.displayName).toBe('Guest_abc');
    // Token should be stored
    expect(store['blunzinger_token']).toBe('guest-jwt-123');
    // Should have been called as anonymous (no existing token)
    expect(mockFetch.mock.calls[0][0]).toBe('/api/auth/guest');
    expect(mockFetch.mock.calls[0][1].method).toBe('POST');
  });
});

// ── fetchMe ──────────────────────────────────────────────────────────

describe('fetchMe', () => {
  it('calls GET /api/auth/me with Authorization header', async () => {
    store['blunzinger_token'] = 'my-jwt';
    const profile = {
      userId: 'u1',
      displayName: 'Alice',
      isGuest: false,
      provider: 'Google',
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => profile,
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchMe();

    expect(result).toEqual(profile);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/auth/me');
    expect(opts.headers.Authorization).toBe('Bearer my-jwt');
  });
});

// ── getOAuthLoginUrl ─────────────────────────────────────────────────

describe('getOAuthLoginUrl', () => {
  it('builds URL for a provider', () => {
    const url = getOAuthLoginUrl('Google');
    expect(url).toBe('/api/auth/login/Google');
  });

  it('includes returnUrl when provided', () => {
    const url = getOAuthLoginUrl('GitHub', 'http://localhost:5173/play');
    expect(url).toBe('/api/auth/login/GitHub?returnUrl=http%3A%2F%2Flocalhost%3A5173%2Fplay');
  });

  it.each<OAuthProvider>(['Google', 'GitHub', 'Discord', 'Microsoft'])(
    'supports provider %s',
    (provider) => {
      const url = getOAuthLoginUrl(provider);
      expect(url).toContain(provider);
    },
  );
});

// ── fetchProviders ───────────────────────────────────────────────────

describe('fetchProviders', () => {
  it('returns the provider list from the backend', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ providers: ['Google', 'GitHub'] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchProviders();

    expect(result).toEqual(['Google', 'GitHub']);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/auth/providers');
    // Should be anonymous (no Authorization header needed)
    expect(opts.headers.Authorization).toBeUndefined();
  });

  it('returns an empty array when no providers are configured', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ providers: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchProviders();

    expect(result).toEqual([]);
  });
});
