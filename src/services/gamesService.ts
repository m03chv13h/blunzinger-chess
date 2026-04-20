/**
 * Games service — wraps the `/api/games` endpoints.
 *
 * Supports saving completed games, listing game history (paginated),
 * and fetching individual games.
 */

import { apiFetch } from './apiClient';

// ── Types ────────────────────────────────────────────────────────────

export interface SaveGameRequest {
  matchConfig: string;
  gameState?: string;
  result?: string;
  scores?: string;
  positionHistory?: string;
  moveHistory?: string;
  finalFen?: string;
  moveCount: number;
  gameMode?: 'local' | 'multiplayer';
}

export interface SaveGameResponse {
  gameId: string;
}

export interface GameListItem {
  id: string;
  matchConfig: string;
  result?: string;
  scores?: string;
  finalFen?: string;
  moveCount: number;
  gameMode?: string;
  createdAt: string;
  completedAt?: string;
}

export interface GameDetail extends GameListItem {
  gameState?: string;
  positionHistory?: string;
  moveHistory?: string;
}

export interface PaginatedGames {
  games: GameListItem[];
  total: number;
  page: number;
  pageSize: number;
}

// ── API calls ────────────────────────────────────────────────────────

/** Save a completed game to the backend. */
export async function saveGame(req: SaveGameRequest): Promise<SaveGameResponse> {
  return apiFetch<SaveGameResponse>('/api/games', {
    method: 'POST',
    body: req,
  });
}

/** List the current user's games (paginated). */
export async function listGames(page = 1, pageSize = 20): Promise<PaginatedGames> {
  return apiFetch<PaginatedGames>(`/api/games?page=${page}&pageSize=${pageSize}`);
}

/** Fetch a single game by ID. */
export async function getGame(id: string): Promise<GameDetail> {
  return apiFetch<GameDetail>(`/api/games/${encodeURIComponent(id)}`);
}
