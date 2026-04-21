/**
 * useGameHistory – React hook for persistent game history.
 *
 * In connected mode, saves completed games to the backend and fetches
 * the user's game history. In static mode, this hook is a no-op — game
 * history is managed in-memory by App.tsx as before.
 */

import { useState, useCallback } from 'react';
import { isConnectedMode } from '../config/deployMode';
import type { SaveGameRequest, GameListItem, GameDetail, PaginatedGames } from '../services/gamesService';
import { saveGame, listGames, getGame } from '../services/gamesService';
import type { GameRecord } from '../core/gameRecord';
import type { GameSetupConfig, GameResult, ScoreState, PositionHistoryEntry, Move } from '../core/blunziger/types';

/** Convert a backend GameDetail (JSON strings) to a GameRecord for review. */
export function gameDetailToRecord(detail: GameDetail): GameRecord {
  const config: GameSetupConfig = JSON.parse(detail.matchConfig);
  const result: GameResult = detail.result ? JSON.parse(detail.result) : { winner: 'draw', reason: 'unknown' };
  const scores: ScoreState = detail.scores ? JSON.parse(detail.scores) : { w: 0, b: 0 };
  const positionHistory: PositionHistoryEntry[] = detail.positionHistory ? JSON.parse(detail.positionHistory) : [];
  const moveHistory: Move[] = detail.moveHistory ? JSON.parse(detail.moveHistory) : [];

  return {
    id: detail.id,
    completedAt: detail.completedAt ? new Date(detail.completedAt).getTime() : new Date(detail.createdAt).getTime(),
    config,
    result,
    finalFen: detail.finalFen ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    moveCount: detail.moveCount,
    scores,
    positionHistory,
    moveHistory,
    violationReports: [],
    missedChecks: [],
    pieceRemovals: [],
    timeReductions: [],
  };
}

/** Convert a backend GameListItem (summary) to a GameRecord for display (no review data). */
export function gameListItemToRecord(item: GameListItem): GameRecord {
  const config: GameSetupConfig = JSON.parse(item.matchConfig);
  const result: GameResult = item.result ? JSON.parse(item.result) : { winner: 'draw', reason: 'unknown' };
  const scores: ScoreState = item.scores ? JSON.parse(item.scores) : { w: 0, b: 0 };

  return {
    id: item.id,
    completedAt: item.completedAt ? new Date(item.completedAt).getTime() : new Date(item.createdAt).getTime(),
    config,
    result,
    finalFen: item.finalFen ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    moveCount: item.moveCount,
    scores,
    positionHistory: [],
    moveHistory: [],
    violationReports: [],
    missedChecks: [],
    pieceRemovals: [],
    timeReductions: [],
    isOnline: item.gameMode === 'multiplayer',
  };
}

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
  /** Fetch a single remote game and convert it for review. */
  fetchGameForReview: (id: string) => Promise<GameRecord | null>;
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

  const fetchGameForReview = useCallback(async (id: string): Promise<GameRecord | null> => {
    if (!isConnectedMode) return null;
    setLoading(true);
    setError(null);
    try {
      const detail = await getGame(id);
      return gameDetailToRecord(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load game');
      return null;
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
    fetchGameForReview,
  };
}
