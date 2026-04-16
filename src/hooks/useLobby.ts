/**
 * useLobby – React hook for multiplayer room and matchmaking management.
 *
 * Wraps the lobby REST endpoints and exposes reactive state for
 * room lists, active room, and matchmaking status.
 */

import { useState, useCallback } from 'react';
import type {
  RoomListItem,
  CreateRoomResponse,
  JoinRoomResponse,
} from '../services/lobbyService';
import {
  createRoom,
  joinRoom as joinRoomApi,
  listRooms,
  joinMatchmaking as joinMatchmakingApi,
  cancelMatchmaking as cancelMatchmakingApi,
} from '../services/lobbyService';

// ── Hook state ──────────────────────────────────────────────────────

export interface LobbyState {
  /** List of available waiting rooms. */
  rooms: RoomListItem[];
  /** True while a lobby request is in flight. */
  loading: boolean;
  /** Latest error from a lobby operation. */
  error: string | null;
  /** Active room the user has created or joined. */
  activeRoom: { roomId: string; code: string } | null;
  /** True while the user is in the matchmaking queue. */
  matchmaking: boolean;
}

export interface UseLobby extends LobbyState {
  /** Refresh the list of waiting rooms. */
  refreshRooms: () => Promise<void>;
  /** Create a new private room. */
  createRoom: (matchConfig: string) => Promise<CreateRoomResponse>;
  /** Join a room by its short code. */
  joinRoom: (code: string) => Promise<JoinRoomResponse>;
  /** Enter the matchmaking queue. */
  joinMatchmaking: (preferredConfig: string) => Promise<void>;
  /** Cancel active matchmaking. */
  cancelMatchmaking: () => Promise<void>;
  /** Clear the active room (e.g. after leaving). */
  clearActiveRoom: () => void;
}

export function useLobby(): UseLobby {
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<{ roomId: string; code: string } | null>(null);
  const [matchmaking, setMatchmaking] = useState(false);

  const refreshRooms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listRooms();
      setRooms(data.rooms);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list rooms');
    } finally {
      setLoading(false);
    }
  }, []);

  const createRoomCb = useCallback(async (matchConfig: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await createRoom(matchConfig);
      setActiveRoom({ roomId: res.roomId, code: res.code });
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create room';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const joinRoomCb = useCallback(async (code: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await joinRoomApi(code);
      setActiveRoom({ roomId: res.roomId, code: res.code });
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to join room';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const joinMatchmakingCb = useCallback(async (preferredConfig: string) => {
    setLoading(true);
    setError(null);
    try {
      await joinMatchmakingApi(preferredConfig);
      setMatchmaking(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join matchmaking');
    } finally {
      setLoading(false);
    }
  }, []);

  const cancelMatchmakingCb = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await cancelMatchmakingApi();
      setMatchmaking(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel matchmaking');
    } finally {
      setLoading(false);
    }
  }, []);

  const clearActiveRoom = useCallback(() => {
    setActiveRoom(null);
  }, []);

  return {
    rooms,
    loading,
    error,
    activeRoom,
    matchmaking,
    refreshRooms,
    createRoom: createRoomCb,
    joinRoom: joinRoomCb,
    joinMatchmaking: joinMatchmakingCb,
    cancelMatchmaking: cancelMatchmakingCb,
    clearActiveRoom,
  };
}
