/**
 * Lobby service — wraps the `/api/lobby` endpoints.
 *
 * Supports:
 * - Creating/joining multiplayer rooms
 * - Listing waiting rooms
 * - Matchmaking queue management
 */

import { apiFetch } from './apiClient';

// ── Types ────────────────────────────────────────────────────────────

export interface CreateRoomResponse {
  roomId: string;
  code: string;
}

export interface JoinRoomResponse {
  roomId: string;
  code: string;
}

export interface RoomListItem {
  id: string;
  code: string;
  matchConfig: string;
  createdAt: string;
  hostName: string;
}

export interface ListRoomsResponse {
  rooms: RoomListItem[];
}

export interface JoinMatchmakingResponse {
  entryId: string;
}

// ── API calls ────────────────────────────────────────────────────────

/** Create a new private multiplayer room. */
export async function createRoom(matchConfig: string): Promise<CreateRoomResponse> {
  return apiFetch<CreateRoomResponse>('/api/lobby/rooms', {
    method: 'POST',
    body: { matchConfig },
  });
}

/** Join a room by its short code. */
export async function joinRoom(code: string): Promise<JoinRoomResponse> {
  return apiFetch<JoinRoomResponse>('/api/lobby/rooms/join', {
    method: 'POST',
    body: { code },
  });
}

/** List public waiting rooms. */
export async function listRooms(): Promise<ListRoomsResponse> {
  return apiFetch<ListRoomsResponse>('/api/lobby/rooms');
}

/** Join the matchmaking queue with preferred configuration. */
export async function joinMatchmaking(preferredConfig: string): Promise<JoinMatchmakingResponse> {
  return apiFetch<JoinMatchmakingResponse>('/api/lobby/matchmaking', {
    method: 'POST',
    body: { preferredConfig },
  });
}

/** Cancel active matchmaking. */
export async function cancelMatchmaking(): Promise<void> {
  return apiFetch<void>('/api/lobby/matchmaking', { method: 'DELETE' });
}
