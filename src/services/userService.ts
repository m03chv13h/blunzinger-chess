/**
 * User service — wraps the `/api/user` endpoints.
 *
 * Supports fetching and updating the current user's profile.
 */

import { apiFetch } from './apiClient';

// ── Types ────────────────────────────────────────────────────────────

export interface UserProfileDetail {
  id: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  provider: string;
  isGuest: boolean;
  gameCount: number;
  createdAt: string;
}

export interface UpdateProfileRequest {
  displayName?: string;
}

export interface UpdateProfileResponse {
  id: string;
  displayName: string;
}

// ── API calls ────────────────────────────────────────────────────────

/** Fetch the authenticated user's full profile with statistics. */
export async function fetchUserProfile(): Promise<UserProfileDetail> {
  return apiFetch<UserProfileDetail>('/api/user/profile');
}

/** Update the display name (or other profile fields). */
export async function updateUserProfile(req: UpdateProfileRequest): Promise<UpdateProfileResponse> {
  return apiFetch<UpdateProfileResponse>('/api/user/profile', {
    method: 'PATCH',
    body: req,
  });
}
