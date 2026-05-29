/**
 * Simulation service — runs bot-vs-bot games on the backend.
 *
 * In connected mode the heavy simulation work is offloaded to the
 * Node.js game engine worker via the .NET API gateway.
 * Batch simulations are processed asynchronously: the API returns
 * immediately and the frontend polls for progress every 4 seconds.
 */

import { apiFetch } from './apiClient';
import type { GameSetupConfig } from '../core/blunzinger/types';
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

// ── Async batch simulation ───────────────────────────────────────────

/** Response from the batch start endpoint (POST /api/simulation/run-batch). */
export interface BatchSimulationStartResult {
  id: string;
  status: 'running';
  gameCount: number;
  completedGames: number;
}

/**
 * Start a batch of simulated bot-vs-bot games on the backend.
 * The API enqueues the games on the worker and returns immediately.
 * Use {@link getSimulationStatus} to poll for progress.
 *
 * @param config The game setup configuration (frontend format).
 * @param count Number of games to simulate (1–200).
 * @returns The initial simulation record with its ID.
 */
export async function runBatchSimulationRemote(
  config: GameSetupConfig,
  count: number,
): Promise<BatchSimulationStartResult> {
  return apiFetch<BatchSimulationStartResult>('/api/simulation/run-batch', {
    method: 'POST',
    body: { config, count },
  });
}

/** Status response from the simulation status polling endpoint. */
export interface SimulationStatusResponse {
  id: string;
  status: 'running' | 'completed' | 'abandoned';
  completedAt?: number;
  config: GameSetupConfig;
  games: GameRecord[];
  gameCount: number;
  completedGames: number;
  standing: {
    whiteWins: number;
    blackWins: number;
    draws: number;
  };
}

/**
 * Poll the current status/progress of a running simulation.
 *
 * @param id The simulation ID returned by {@link runBatchSimulationRemote}.
 * @returns Current simulation state with partial or full results.
 */
export async function getSimulationStatus(id: string): Promise<SimulationStatusResponse> {
  return apiFetch<SimulationStatusResponse>(`/api/simulation/${encodeURIComponent(id)}/status`);
}

// ── Simulation history ───────────────────────────────────────────────

export interface SimulationListItem {
  id: string;
  configJson: string;
  gameCount: number;
  completedGames: number;
  whiteWins: number;
  blackWins: number;
  draws: number;
  createdAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'abandoned';
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

/** Worker status response from the backend. */
export interface WorkerStatusResponse {
  status: 'ready' | 'unavailable';
}

/**
 * Ping the simulation worker via the backend to check if it's up.
 * This also wakes the worker if it is sleeping (Render free plan).
 * The call is fire-and-forget from the caller's perspective — failures are swallowed.
 */
export async function checkWorkerStatus(): Promise<WorkerStatusResponse> {
  return apiFetch<WorkerStatusResponse>('/api/simulation/worker-status', { anonymous: true });
}
