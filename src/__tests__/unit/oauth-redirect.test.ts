/**
 * Tests for OAuth redirect token detection and hash fragment handling.
 *
 * These tests verify that the OAuth redirect flow correctly handles tokens
 * in both the query string and hash fragment scenarios.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Force connected mode for these tests.
vi.mock('../../config/deployMode', () => ({
  DEPLOY_MODE: 'connected',
  isConnectedMode: true,
  isStaticMode: false,
}));

// Mock the auth service so we can control network responses.
const mockFetchMe = vi.fn();
const mockFetchProviders = vi.fn().mockResolvedValue([]);
const mockGetOAuthLoginUrl = vi.fn((provider: string, returnUrl?: string) => {
  const base = `/api/auth/login/${provider}`;
  if (returnUrl) return `${base}?returnUrl=${encodeURIComponent(returnUrl)}`;
  return base;
});

vi.mock('../../services/authService', () => ({
  createGuest: vi.fn(),
  fetchMe: () => mockFetchMe(),
  fetchProviders: () => mockFetchProviders(),
  getOAuthLoginUrl: (provider: string, returnUrl?: string) => mockGetOAuthLoginUrl(provider, returnUrl),
}));

// Mock apiClient token functions.
let storedToken: string | null = null;
vi.mock('../../services/apiClient', () => ({
  getToken: () => storedToken,
  setToken: (t: string) => { storedToken = t; },
  clearToken: () => { storedToken = null; },
}));

describe('OAuth redirect token detection', () => {
  let originalLocation: Location;
  let replaceStateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    storedToken = null;
    mockFetchMe.mockReset();
    mockFetchProviders.mockResolvedValue([]);
    originalLocation = window.location;
    replaceStateSpy = vi.spyOn(window.history, 'replaceState');
  });

  afterEach(() => {
    replaceStateSpy.mockRestore();
    // Reset location state.
    window.location.hash = '';
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  it('detects token from query string (standard case)', async () => {
    // Simulate: http://app.example.com/?token=jwt-123
    Object.defineProperty(window, 'location', {
      value: new URL('http://app.example.com/?token=jwt-123'),
      writable: true,
    });

    mockFetchMe.mockResolvedValue({
      userId: 'u1',
      displayName: 'Alice',
      isGuest: false,
      provider: 'Google',
    });

    const { useAuth } = await import('../../hooks/useAuth');
    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toEqual({
      userId: 'u1',
      displayName: 'Alice',
      isGuest: false,
      provider: 'Google',
    });
    expect(storedToken).toBe('jwt-123');
  });

  it('detects token from hash fragment (fallback for hash-based routing)', async () => {
    // Simulate: http://app.example.com/#/quick-start?token=jwt-456
    // This happens when returnUrl contained a hash and backend appended token after it.
    Object.defineProperty(window, 'location', {
      value: new URL('http://app.example.com/#/quick-start?token=jwt-456'),
      writable: true,
    });

    mockFetchMe.mockResolvedValue({
      userId: 'u2',
      displayName: 'Bob',
      isGuest: false,
      provider: 'GitHub',
    });

    const { useAuth } = await import('../../hooks/useAuth');
    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toEqual({
      userId: 'u2',
      displayName: 'Bob',
      isGuest: false,
      provider: 'GitHub',
    });
    expect(storedToken).toBe('jwt-456');
  });

  it('loginWithProvider strips hash from returnUrl', async () => {
    // Simulate being on a page with hash routing.
    Object.defineProperty(window, 'location', {
      value: {
        ...new URL('http://app.example.com/#/quick-start'),
        href: 'http://app.example.com/#/quick-start',
        search: '',
        hash: '#/quick-start',
      },
      writable: true,
    });

    // Mock window.location.href setter to capture the redirect URL.
    let redirectedTo = '';
    Object.defineProperty(window.location, 'href', {
      set: (val: string) => { redirectedTo = val; },
      get: () => 'http://app.example.com/#/quick-start',
    });

    mockFetchMe.mockResolvedValue(undefined);

    const { useAuth } = await import('../../hooks/useAuth');
    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));

    result.current.loginWithProvider('Google');

    // The returnUrl passed to getOAuthLoginUrl should NOT contain the hash.
    expect(mockGetOAuthLoginUrl).toHaveBeenCalledWith(
      'Google',
      'http://app.example.com/',
    );
  });
});
