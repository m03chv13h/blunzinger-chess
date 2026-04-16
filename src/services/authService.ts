/**
 * Auth service — wraps the `/api/auth` endpoints.
 *
 * Supports:
 * - Guest token creation (anonymous play)
 * - OAuth login redirection (Google, GitHub, Discord, Microsoft)
 * - Current-user profile retrieval
 */

import { apiFetch, setToken, API_BASE } from './apiClient';

// ── Types ────────────────────────────────────────────────────────────

export type OAuthProvider = 'Google' | 'GitHub' | 'Discord' | 'Microsoft';

export interface GuestTokenResponse {
  token: string;
  userId: string;
  displayName: string;
}

export interface UserProfile {
  userId: string;
  displayName: string;
  isGuest: boolean;
  provider: string;
}

// ── API calls ────────────────────────────────────────────────────────

/**
 * Create a guest user and store the JWT locally.
 * Returns the guest profile information.
 */
export async function createGuest(): Promise<GuestTokenResponse> {
  const data = await apiFetch<GuestTokenResponse>('/api/auth/guest', {
    method: 'POST',
    anonymous: true,
  });
  setToken(data.token);
  return data;
}

/**
 * Build the OAuth login URL for the given provider.
 * The browser should be redirected to this URL (full-page navigation).
 * After authentication the backend redirects back with `?token=…`.
 */
export function getOAuthLoginUrl(provider: OAuthProvider, returnUrl?: string): string {
  const base = API_BASE + `/api/auth/login/${provider}`;
  if (returnUrl) {
    return `${base}?returnUrl=${encodeURIComponent(returnUrl)}`;
  }
  return base;
}

/**
 * Fetch the authenticated user's profile.
 * Requires a valid JWT in local storage.
 */
export async function fetchMe(): Promise<UserProfile> {
  return apiFetch<UserProfile>('/api/auth/me');
}

/**
 * Fetch the list of OAuth providers the backend has configured.
 * Returns an empty array when the backend has no OAuth credentials.
 */
export async function fetchProviders(): Promise<OAuthProvider[]> {
  const data = await apiFetch<{ providers: OAuthProvider[] }>('/api/auth/providers', {
    anonymous: true,
  });
  return data.providers;
}
