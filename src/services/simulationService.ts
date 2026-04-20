/**
 * Simulation service — runs bot-vs-bot games on the backend.
 *
 * In connected mode the heavy simulation work is offloaded to the
 * Node.js game engine worker via the .NET API gateway.
 */

import { apiFetch } from './apiClient';
import type { GameSetupConfig } from '../core/blunziger/types';
import type { GameRecord, SimulationRecord } from '../core/gameRecord';

/**
 * Run a single simulated bot-vs-bot game on the backend.
 *
 * @param config The game setup configuration (frontend format).
 * @returns The completed game record.
 */
export async function runSimulatedGameRemote(config: GameSetupConfig): Promise<GameRecord> {
  return apiFetch<GameRecord>('/api/simulation/run', {
    method: 'POST',
    body: config,
  });
}

/**
 * Run a batch of simulated bot-vs-bot games on the backend.
 * Results are persisted server-side and returned as a SimulationRecord.
 *
 * @param config The game setup configuration (frontend format).
 * @param count Number of games to simulate (1–200).
 * @returns The complete simulation record with all game results.
 */
export async function runBatchSimulationRemote(
  config: GameSetupConfig,
  count: number,
): Promise<SimulationRecord> {
  return apiFetch<SimulationRecord>('/api/simulation/run-batch', {
    method: 'POST',
    body: { config, count },
  });
}

// ── Simulation history ───────────────────────────────────────────────

export interface SimulationListItem {
  id: string;
  configJson: string;
  gameCount: number;
  whiteWins: number;
  blackWins: number;
  draws: number;
  createdAt: string;
  completedAt?: string;
}

export interface PaginatedSimulations {
  simulations: SimulationListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** List the current user's saved simulations (paginated, without full game data). */
export async function listSimulations(page = 1, pageSize = 20): Promise<PaginatedSimulations> {
  return apiFetch<PaginatedSimulations>(`/api/simulation?page=${page}&pageSize=${pageSize}`);
}

/** Fetch a single saved simulation by ID (includes all game records). */
export async function getSimulation(id: string): Promise<SimulationRecord> {
  return apiFetch<SimulationRecord>(`/api/simulation/${encodeURIComponent(id)}`);
}
