/**
 * Simulation service — runs bot-vs-bot games on the backend.
 *
 * In connected mode the heavy simulation work is offloaded to the
 * Node.js game engine worker via the .NET API gateway.
 */

import { apiFetch } from './apiClient';
import type { GameSetupConfig } from '../core/blunziger/types';
import type { GameRecord } from '../core/gameRecord';

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
