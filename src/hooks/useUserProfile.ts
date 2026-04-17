/**
 * useUserProfile – React hook for user profile management.
 *
 * In connected mode, fetches and updates the user profile from the backend.
 * In static mode, returns a null profile and no-op methods.
 */

import { useState, useCallback, useEffect } from 'react';
import { isConnectedMode } from '../config/deployMode';
import type { UserProfileDetail } from '../services/userService';
import { fetchUserProfile, updateUserProfile } from '../services/userService';

export interface UseUserProfile {
  /** Full user profile from the backend, or null. */
  profile: UserProfileDetail | null;
  /** Whether a request is in flight. */
  loading: boolean;
  /** Last error. */
  error: string | null;
  /** Refresh the profile from the backend. */
  refresh: () => Promise<void>;
  /** Update the display name. */
  updateDisplayName: (name: string) => Promise<void>;
}

export function useUserProfile(authenticated: boolean): UseUserProfile {
  const [profile, setProfile] = useState<UserProfileDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isConnectedMode) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUserProfile();
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateDisplayName = useCallback(async (name: string) => {
    if (!isConnectedMode) return;
    setLoading(true);
    setError(null);
    try {
      const res = await updateUserProfile({ displayName: name });
      setProfile(prev => prev ? { ...prev, displayName: res.displayName } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch profile when authenticated in connected mode.
  useEffect(() => {
    if (isConnectedMode && authenticated) {
      refresh();
    }
    if (!authenticated) {
      setProfile(null);
    }
  }, [authenticated, refresh]);

  return { profile, loading, error, refresh, updateDisplayName };
}
