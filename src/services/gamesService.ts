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

// ── Filters ──────────────────────────────────────────────────────────

/** Server-side filters for the games list endpoint. */
export interface GameFilters {
  /** Filter by game mode: "local" (offline) or "multiplayer" (online). */
  gameMode?: 'local' | 'multiplayer';
  /** When false, exclude spectated games (hvh / botvbot). Defaults to true. */
  includeSpectated?: boolean;
}

// ── API calls ────────────────────────────────────────────────────────

/** Save a completed game to the backend. */
export async function saveGame(req: SaveGameRequest): Promise<SaveGameResponse> {
  return apiFetch<SaveGameResponse>('/api/games', {
    method: 'POST',
    body: req,
  });
}

/** List the current user's games (paginated, with optional server-side filters). */
export async function listGames(
  page = 1,
  pageSize = 20,
  filters?: GameFilters,
): Promise<PaginatedGames> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (filters?.gameMode) {
    params.set('gameMode', filters.gameMode);
  }
  if (filters?.includeSpectated === false) {
    params.set('includeSpectated', 'false');
  }
  return apiFetch<PaginatedGames>(`/api/games?${params.toString()}`);
}

/** Fetch a single game by ID. */
export async function getGame(id: string): Promise<GameDetail> {
  return apiFetch<GameDetail>(`/api/games/${encodeURIComponent(id)}`);
}
