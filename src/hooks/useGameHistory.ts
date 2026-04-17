/**
 * useGameHistory – React hook for persistent game history.
 *
 * In connected mode, saves completed games to the backend and fetches
 * the user's game history. In static mode, this hook is a no-op — game
 * history is managed in-memory by App.tsx as before.
 */

import { useState, useCallback } from 'react';
import { isConnectedMode } from '../config/deployMode';
import type { SaveGameRequest, GameListItem, PaginatedGames } from '../services/gamesService';
import { saveGame, listGames, deleteGame } from '../services/gamesService';
import type { GameRecord } from '../core/gameRecord';

export interface UseGameHistory {
  /** Persisted games fetched from the backend (connected mode only). */
  remoteGames: GameListItem[];
  /** Total number of remote games. */
  remoteTotal: number;
  /** Current page. */
  page: number;
  /** Whether a request is in flight. */
  loading: boolean;
  /** Last error. */
  error: string | null;
  /** Save a completed game to the backend. Returns the game ID. */
  saveGameToBackend: (record: GameRecord) => Promise<string | null>;
  /** Fetch a page of games from the backend. */
  fetchPage: (page?: number, pageSize?: number) => Promise<void>;
  /** Delete a remote game. */
  removeGame: (id: string) => Promise<void>;
}

export function useGameHistory(): UseGameHistory {
  const [remoteGames, setRemoteGames] = useState<GameListItem[]>([]);
  const [remoteTotal, setRemoteTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveGameToBackend = useCallback(async (record: GameRecord): Promise<string | null> => {
    if (!isConnectedMode) return null;
    try {
      const req: SaveGameRequest = {
        matchConfig: JSON.stringify(record.config),
        result: JSON.stringify(record.result),
        scores: JSON.stringify(record.scores),
        positionHistory: JSON.stringify(record.positionHistory),
        moveHistory: JSON.stringify(record.moveHistory),
        finalFen: record.finalFen,
        moveCount: record.moveCount,
        gameMode: 'local',
      };
      const res = await saveGame(req);
      return res.gameId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save game');
      return null;
    }
  }, []);

  const fetchPage = useCallback(async (p = 1, pageSize = 20) => {
    if (!isConnectedMode) return;
    setLoading(true);
    setError(null);
    try {
      const data: PaginatedGames = await listGames(p, pageSize);
      setRemoteGames(data.games);
      setRemoteTotal(data.total);
      setPage(data.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch games');
    } finally {
      setLoading(false);
    }
  }, []);

  const removeGame = useCallback(async (id: string) => {
    if (!isConnectedMode) return;
    setLoading(true);
    setError(null);
    try {
      await deleteGame(id);
      setRemoteGames(prev => prev.filter(g => g.id !== id));
      setRemoteTotal(prev => prev - 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete game');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    remoteGames,
    remoteTotal,
    page,
    loading,
    error,
    saveGameToBackend,
    fetchPage,
    removeGame,
  };
}
