import { Hono } from 'hono';
import type { Env, SimulationRow } from '../types.js';
import { authMiddleware, getUser, type AuthUser } from '../middleware/auth.js';

const simulation = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

simulation.use('*', authMiddleware());

/**
 * In-memory simulation job queue.
 * Cloudflare Workers are stateless per-request but Durable Objects maintain state.
 * For now we use the Scheduler Durable Object to manage long-running simulations.
 */

/** Run a single simulated game. Delegates to Scheduler Durable Object. */
simulation.post('/run', async (c) => {
  const body = await c.req.json();
  const configJson = JSON.stringify(body);

  // Forward to Scheduler DO for execution
  const id = c.env.SCHEDULER.idFromName('global');
  const stub = c.env.SCHEDULER.get(id);

  const res = await stub.fetch(new Request('http://internal/simulation/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: configJson,
  }));

  const result = await res.text();
  return c.body(result, 200, { 'Content-Type': 'application/json' });
});

/** Run a batch of simulated games asynchronously. */
simulation.post('/run-batch', async (c) => {
  const user = getUser(c);
  const body = await c.req.json<{ config: unknown; count: number }>();
  const count = Math.min(200, Math.max(1, body.count));
  const configJson = JSON.stringify(body.config);

  // Create the simulation record
  const simulationId = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO Simulations (Id, UserId, ConfigJson, GameCount, WhiteWins, BlackWins, Draws, CompletedGames, GamesJson, CreatedAt)
     VALUES (?, ?, ?, ?, 0, 0, 0, 0, '[]', ?)`
  ).bind(simulationId, user.userId, configJson, count, now).run();

  // Enqueue on Scheduler DO
  const id = c.env.SCHEDULER.idFromName('global');
  const stub = c.env.SCHEDULER.get(id);

  await stub.fetch(new Request('http://internal/simulation/enqueue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ simulationId, configJson, count }),
  }));

  return c.json({
    id: simulationId,
    status: 'running',
    gameCount: count,
    completedGames: 0,
  });
});

/** Get simulation status/progress. */
simulation.get('/:id/status', async (c) => {
  const user = getUser(c);
  const simId = c.req.param('id');

  const sim = await c.env.DB.prepare(
    'SELECT * FROM Simulations WHERE Id = ? AND UserId = ?'
  ).bind(simId, user.userId).first<SimulationRow>();

  if (!sim) return c.json({ error: 'Not found' }, 404);

  const status = sim.CompletedAt
    ? (sim.CompletedGames >= sim.GameCount ? 'completed' : 'abandoned')
    : 'running';

  return c.json({
    id: sim.Id,
    status,
    ...(sim.CompletedAt && { completedAt: new Date(sim.CompletedAt).getTime() }),
    config: JSON.parse(sim.ConfigJson),
    games: JSON.parse(sim.GamesJson),
    gameCount: sim.GameCount,
    completedGames: sim.CompletedGames,
    standing: {
      whiteWins: sim.WhiteWins,
      blackWins: sim.BlackWins,
      draws: sim.Draws,
    },
  });
});

/** List simulations. */
simulation.get('/', async (c) => {
  const user = getUser(c);
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(c.req.query('pageSize')) || 20));

  const countResult = await c.env.DB.prepare(
    'SELECT COUNT(*) as total FROM Simulations WHERE UserId = ?'
  ).bind(user.userId).first<{ total: number }>();
  const total = countResult?.total || 0;

  const offset = (page - 1) * pageSize;
  const sims = await c.env.DB.prepare(
    `SELECT Id, ConfigJson, GameCount, CompletedGames, WhiteWins, BlackWins, Draws, CreatedAt, CompletedAt
     FROM Simulations WHERE UserId = ?
     ORDER BY COALESCE(CompletedAt, CreatedAt) DESC
     LIMIT ? OFFSET ?`
  ).bind(user.userId, pageSize, offset).all<SimulationRow>();

  const simulations = sims.results.map(s => ({
    ...s,
    Status: s.CompletedAt
      ? (s.CompletedGames >= s.GameCount ? 'completed' : 'abandoned')
      : 'running',
  }));

  return c.json({ simulations, total, page, pageSize });
});

/** Get a specific simulation by ID. */
simulation.get('/:id', async (c) => {
  const user = getUser(c);
  const simId = c.req.param('id');

  const sim = await c.env.DB.prepare(
    'SELECT * FROM Simulations WHERE Id = ? AND UserId = ?'
  ).bind(simId, user.userId).first<SimulationRow>();

  if (!sim) return c.json({ error: 'Not found' }, 404);

  const status = sim.CompletedAt
    ? (sim.CompletedGames >= sim.GameCount ? 'completed' : 'abandoned')
    : 'running';

  return c.json({
    id: sim.Id,
    status,
    ...(sim.CompletedAt && { completedAt: new Date(sim.CompletedAt).getTime() }),
    config: JSON.parse(sim.ConfigJson),
    games: JSON.parse(sim.GamesJson),
    gameCount: sim.GameCount,
    completedGames: sim.CompletedGames,
    standing: {
      whiteWins: sim.WhiteWins,
      blackWins: sim.BlackWins,
      draws: sim.Draws,
    },
  });
});

export default simulation;
