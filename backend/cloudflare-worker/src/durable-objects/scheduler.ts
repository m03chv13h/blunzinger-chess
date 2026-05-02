import type { Env, SimulationRow } from '../types.js';
import { RoomStatus, MatchmakingStatus } from '../types.js';

interface SimulationJob {
  simulationId: string;
  configJson: string;
  totalGames: number;
  completedGames: number;
  finished: boolean;
}

/**
 * Scheduler Durable Object.
 * Manages background tasks:
 * - Simulation execution (runs games sequentially via alarms)
 * - Room expiry cleanup
 * - Matchmaking queue processing
 *
 * Uses Durable Object alarms for periodic execution.
 */
export class Scheduler implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private simulationJobs: Map<string, SimulationJob> = new Map();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;

    // Restore jobs from storage on wake
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<Map<string, SimulationJob>>('simulationJobs');
      if (stored) this.simulationJobs = stored;
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/simulation/run' && request.method === 'POST') {
      return this.runSingleSimulation(request);
    }

    if (url.pathname === '/simulation/enqueue' && request.method === 'POST') {
      return this.enqueueSimulation(request);
    }

    if (url.pathname === '/tick' && request.method === 'POST') {
      await this.tick();
      return new Response('OK');
    }

    return new Response('Not found', { status: 404 });
  }

  /**
   * Run a single simulated game synchronously.
   * Uses dynamic import of the game simulation logic.
   */
  private async runSingleSimulation(request: Request): Promise<Response> {
    const configJson = await request.text();

    // The simulation logic from the shared TypeScript core
    // We import it dynamically since it's bundled with the worker
    const { runSimulatedGame } = await import('../../../../src/core/simulation.js');
    const config = JSON.parse(configJson);
    const record = runSimulatedGame(config);

    return new Response(JSON.stringify(record), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /** Enqueue a batch simulation for async processing. */
  private async enqueueSimulation(request: Request): Promise<Response> {
    const body = await request.json<{ simulationId: string; configJson: string; count: number }>();

    this.simulationJobs.set(body.simulationId, {
      simulationId: body.simulationId,
      configJson: body.configJson,
      totalGames: Math.min(200, Math.max(1, body.count)),
      completedGames: 0,
      finished: false,
    });

    await this.state.storage.put('simulationJobs', this.simulationJobs);

    // Schedule immediate processing
    await this.state.storage.setAlarm(Date.now() + 100);

    return new Response('OK');
  }

  /** Periodic tick — processes simulations, matchmaking, and room expiry. */
  async alarm(): Promise<void> {
    await this.tick();
  }

  private async tick(): Promise<void> {
    // 1. Process simulation games (one game per tick for fairness)
    await this.processSimulations();

    // 2. Room expiry
    await this.expireStaleRooms();

    // 3. Matchmaking
    await this.processMatchmaking();

    // Schedule next tick if there's work to do
    const hasActiveJobs = [...this.simulationJobs.values()].some(j => !j.finished);
    if (hasActiveJobs) {
      // Process simulations quickly (100ms between games)
      await this.state.storage.setAlarm(Date.now() + 100);
    } else {
      // Background maintenance every 10 seconds
      await this.state.storage.setAlarm(Date.now() + 10_000);
    }
  }

  private async processSimulations(): Promise<void> {
    const { runSimulatedGame } = await import('../../../../src/core/simulation.js');

    // Round-robin: process one game from each active simulation
    for (const [id, job] of this.simulationJobs) {
      if (job.finished) continue;

      try {
        const config = JSON.parse(job.configJson);
        const record = runSimulatedGame(config);

        job.completedGames++;

        // Parse result for standings
        let whiteWins = 0, blackWins = 0, draws = 0;
        if (record.result?.winner === 'w') whiteWins = 1;
        else if (record.result?.winner === 'b') blackWins = 1;
        else draws = 1;

        if (job.completedGames >= job.totalGames) {
          job.finished = true;
        }

        // Update DB with progress
        const sim = await this.env.DB.prepare(
          'SELECT * FROM Simulations WHERE Id = ?'
        ).bind(id).first<SimulationRow>();

        if (sim) {
          const existingGames = JSON.parse(sim.GamesJson) as unknown[];
          existingGames.push(record);

          const updateFields = job.finished
            ? 'CompletedGames = ?, GamesJson = ?, WhiteWins = WhiteWins + ?, BlackWins = BlackWins + ?, Draws = Draws + ?, CompletedAt = datetime(\'now\')'
            : 'CompletedGames = ?, GamesJson = ?, WhiteWins = WhiteWins + ?, BlackWins = BlackWins + ?, Draws = Draws + ?';

          await this.env.DB.prepare(
            `UPDATE Simulations SET ${updateFields} WHERE Id = ?`
          ).bind(
            job.completedGames,
            JSON.stringify(existingGames),
            whiteWins,
            blackWins,
            draws,
            id,
          ).run();
        }

        // Only process one game per tick for responsiveness
        break;
      } catch (err) {
        console.error(`Simulation ${id} error:`, err);
        job.finished = true;
      }
    }

    // Cleanup finished jobs
    for (const [id, job] of this.simulationJobs) {
      if (job.finished) {
        this.simulationJobs.delete(id);
      }
    }

    await this.state.storage.put('simulationJobs', this.simulationJobs);
  }

  private async expireStaleRooms(): Promise<void> {
    const waitingCutoff = new Date(Date.now() - 60_000).toISOString();
    const abandonedCutoff = new Date(Date.now() - 3600_000).toISOString();

    // Expire waiting rooms
    await this.env.DB.prepare(
      'UPDATE MultiplayerRooms SET Status = ? WHERE Status = ? AND CreatedAt < ?'
    ).bind(RoomStatus.Cancelled, RoomStatus.Waiting, waitingCutoff).run();

    // Expire abandoned playing rooms
    await this.env.DB.prepare(
      `UPDATE MultiplayerRooms SET Status = ?
       WHERE Status = ? AND COALESCE(LastActivityAt, CreatedAt) < ?`
    ).bind(RoomStatus.Finished, RoomStatus.Playing, abandonedCutoff).run();
  }

  private async processMatchmaking(): Promise<void> {
    // Expire old entries (>5 minutes)
    const expiryCutoff = new Date(Date.now() - 300_000).toISOString();
    await this.env.DB.prepare(
      'UPDATE MatchmakingQueue SET Status = ? WHERE Status = ? AND JoinedAt < ?'
    ).bind(MatchmakingStatus.Expired, MatchmakingStatus.Queued, expiryCutoff).run();

    // Get queued entries
    const entries = await this.env.DB.prepare(
      'SELECT * FROM MatchmakingQueue WHERE Status = ? ORDER BY JoinedAt ASC'
    ).bind(MatchmakingStatus.Queued).all<{
      Id: string; UserId: string; PreferredConfig: string;
    }>();

    const queued = entries.results;
    const matched = new Set<string>();

    for (let i = 0; i < queued.length; i++) {
      if (matched.has(queued[i].Id)) continue;
      for (let j = i + 1; j < queued.length; j++) {
        if (matched.has(queued[j].Id)) continue;
        if (queued[i].UserId === queued[j].UserId) continue;

        // Match found — create room
        const roomId = crypto.randomUUID();
        const code = this.generateRoomCode();
        const now = new Date().toISOString();

        await this.env.DB.prepare(
          `INSERT INTO MultiplayerRooms (Id, Code, HostUserId, GuestUserId, MatchConfig, Status, CreatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(roomId, code, queued[i].UserId, queued[j].UserId, queued[i].PreferredConfig, RoomStatus.Playing, now).run();

        await this.env.DB.prepare(
          'UPDATE MatchmakingQueue SET Status = ?, RoomId = ? WHERE Id = ?'
        ).bind(MatchmakingStatus.Matched, roomId, queued[i].Id).run();

        await this.env.DB.prepare(
          'UPDATE MatchmakingQueue SET Status = ?, RoomId = ? WHERE Id = ?'
        ).bind(MatchmakingStatus.Matched, roomId, queued[j].Id).run();

        matched.add(queued[i].Id);
        matched.add(queued[j].Id);
        break;
      }
    }
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }
}
