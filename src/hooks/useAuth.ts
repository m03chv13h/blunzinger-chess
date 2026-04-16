/**
 * useAuth – React hook for authentication state.
 *
 * On mount it checks for an existing JWT (from localStorage or from an
 * OAuth redirect `?token=…` parameter) and hydrates the user profile.
 * Exposes helpers for guest login, OAuth redirect, and logout.
 */

import { useState, useEffect, useCallback } from 'react';
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

export function useAuth(): UseAuth {
  const [user, setUser] = useState<UserProfile | null | undefined>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableProviders, setAvailableProviders] = useState<OAuthProvider[]>([]);

  // On mount: check URL for OAuth token, then try to hydrate profile.
  // Also fetch the list of enabled OAuth providers from the backend.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // 1. Check for ?token=… from OAuth redirect
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');
      if (urlToken) {
        setToken(urlToken);
        // Clean the URL so the token doesn't linger.
        const url = new URL(window.location.href);
        url.searchParams.delete('token');
        window.history.replaceState({}, '', url.pathname + url.search);
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

      // 3. Fetch available OAuth providers.
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
    window.location.href = getOAuthLoginUrl(provider, returnUrl ?? window.location.href);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(undefined);
    setError(null);
  }, []);

  return { user, loading, error, availableProviders, loginAsGuest, loginWithProvider, logout };
}
