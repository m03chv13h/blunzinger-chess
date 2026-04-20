/**
 * useAuth – React hook for authentication state.
 *
 * In connected mode: checks for an existing JWT (from localStorage or
 * from an OAuth redirect `?token=…` parameter) and hydrates the user
 * profile. Exposes helpers for guest login, OAuth redirect, and logout.
 *
 * In static mode: immediately resolves with a synthetic local-only user.
 * No network requests are made.
 */

import { useState, useEffect, useCallback } from 'react';
import { isStaticMode } from '../config/deployMode';
import type { UserProfile, OAuthProvider } from '../services/authService';
import { createGuest, fetchMe, fetchProviders, getOAuthLoginUrl } from '../services/authService';
import { getToken, setToken, clearToken } from '../services/apiClient';

export interface AuthState {
  /** `null` while loading, `undefined` when unauthenticated. */
  user: UserProfile | null | undefined;
  /** `true` during initial token validation / guest creation. */
  loading: boolean;
  /** Last error from an auth operation. */
  error: string | null;
  /** OAuth providers that are configured on the backend. Empty when none are available. */
  availableProviders: OAuthProvider[];
}

export interface UseAuth extends AuthState {
  /** Create a guest account and authenticate. */
  loginAsGuest: () => Promise<void>;
  /** Redirect to an OAuth provider for login. */
  loginWithProvider: (provider: OAuthProvider, returnUrl?: string) => void;
  /** Clear token and reset state. */
  logout: () => void;
}

/** Synthetic user returned in static (no-backend) mode. */
const STATIC_USER: UserProfile = {
  userId: 'local',
  displayName: 'Local Player',
  isGuest: true,
  provider: 'local',
};

export function useAuth(): UseAuth {
  const [user, setUser] = useState<UserProfile | null | undefined>(null);
  const [loading, setLoading] = useState(!isStaticMode);
  const [error, setError] = useState<string | null>(null);
  const [availableProviders, setAvailableProviders] = useState<OAuthProvider[]>([]);

  // ── Static mode: resolve immediately with a local user ─────────────
  useEffect(() => {
    if (isStaticMode) {
      setUser(STATIC_USER);
      return;
    }
  }, []);

  // ── Connected mode: OAuth / JWT hydration ──────────────────────────
  useEffect(() => {
    if (isStaticMode) return;
    let cancelled = false;

    async function init() {
      // 1. Check for ?token=… from OAuth redirect
      const params = new URLSearchParams(window.location.search);
      let urlToken = params.get('token');

      // Fallback: check hash fragment for token (handles case where returnUrl
      // contained a hash and the backend appended ?token= after it).
      if (!urlToken && window.location.hash.includes('token=')) {
        const hashQuery = window.location.hash.split('?')[1];
        if (hashQuery) {
          const hashParams = new URLSearchParams(hashQuery);
          urlToken = hashParams.get('token');
        }
      }

      if (urlToken) {
        setToken(urlToken);
        // Clean the URL so the token doesn't linger.
        const url = new URL(window.location.href);
        url.searchParams.delete('token');
        // Preserve the hash path but remove any token from it.
        let cleanHash = url.hash;
        if (cleanHash.includes('token=')) {
          const [hashPath, hashQuery] = cleanHash.split('?');
          if (hashQuery) {
            const hashParams = new URLSearchParams(hashQuery);
            hashParams.delete('token');
            const remaining = hashParams.toString();
            cleanHash = remaining ? `${hashPath}?${remaining}` : hashPath;
          }
        }
        window.history.replaceState({}, '', url.pathname + url.search + cleanHash);
      }

      // 2. If we have a token, fetch profile.
      if (getToken()) {
        try {
          const profile = await fetchMe();
          if (!cancelled) setUser(profile);
        } catch {
          // Token invalid / expired – clear it.
          clearToken();
          if (!cancelled) setUser(undefined);
        }
      } else {
        if (!cancelled) setUser(undefined);
      }

      // 3. Fetch available OAuth providers (unconditional — the UI needs this
      //    regardless of whether the user already has a token).
      try {
        const providers = await fetchProviders();
        if (!cancelled) setAvailableProviders(providers);
      } catch {
        // Backend unreachable or endpoint missing — no OAuth available.
        if (!cancelled) setAvailableProviders([]);
      }

      if (!cancelled) setLoading(false);
    }

    init();
    return () => { cancelled = true; };
  }, []);

  const loginAsGuest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await createGuest();
      setUser({
        userId: data.userId,
        displayName: data.displayName,
        isGuest: true,
        provider: 'guest',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Guest login failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const loginWithProvider = useCallback((provider: OAuthProvider, returnUrl?: string) => {
    // Strip hash fragment from the return URL — hash-based routing fragments
    // would cause the backend to append ?token= after the #, placing the token
    // inside the fragment where window.location.search can't find it.
    const effectiveUrl = returnUrl ?? window.location.href;
    const urlWithoutHash = effectiveUrl.split('#')[0] || effectiveUrl;
    window.location.href = getOAuthLoginUrl(provider, urlWithoutHash);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(undefined);
    setError(null);
  }, []);

  return { user, loading, error, availableProviders, loginAsGuest, loginWithProvider, logout };
}
