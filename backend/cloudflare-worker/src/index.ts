/**
 * Blunziger Chess — Cloudflare Worker API
 *
 * Full backend deployment on Cloudflare:
 * - REST API via Hono framework
 * - D1 database (SQLite-compatible)
 * - Durable Objects for WebSocket (multiplayer) and background tasks
 * - Direct TypeScript game logic (no gRPC layer)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types.js';
import auth from './routes/auth.js';
import games from './routes/games.js';
import lobby from './routes/lobby.js';
import simulation from './routes/simulation.js';
import user from './routes/user.js';

export { GameRoom } from './durable-objects/game-room.js';
export { Scheduler } from './durable-objects/scheduler.js';

const app = new Hono<{ Bindings: Env }>();

// ── CORS ─────────────────────────────────────────────────────────────

app.use('*', cors({
  origin: (origin, c) => {
    const frontendUrl = c.env.FRONTEND_URL;
    const allowedOrigins = [
      frontendUrl,
      'http://localhost:5173',
      'http://localhost:4173',
    ];
    if (allowedOrigins.includes(origin)) return origin;
    return frontendUrl;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ── Routes ───────────────────────────────────────────────────────────

app.route('/api/auth', auth);
app.route('/api/games', games);
app.route('/api/lobby', lobby);
app.route('/api/simulation', simulation);
app.route('/api/user', user);

// ── Health Check ─────────────────────────────────────────────────────

app.get('/health', (c) => c.json({ status: 'healthy' }));

// ── WebSocket Upgrade (game rooms) ───────────────────────────────────

app.get('/hubs/game', async (c) => {
  const upgradeHeader = c.req.header('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return c.text('Expected WebSocket upgrade', 426);
  }

  const roomCode = c.req.query('roomCode');
  const accessToken = c.req.query('access_token');

  if (!accessToken) {
    return c.text('Missing access_token', 400);
  }

  // Verify JWT to get userId
  const { jwtVerify } = await import('jose');
  const secret = new TextEncoder().encode(c.env.JWT_SECRET);

  try {
    const { payload } = await jwtVerify(accessToken, secret, {
      issuer: 'BlunzigerChess',
      audience: 'BlunzigerChess',
    });

    const userId = payload.sub as string;

    if (!roomCode) {
      // No room code — return a simple WebSocket that waits for JoinRoom
      // For now, reject since the frontend will reconnect with roomCode
      return c.text('Missing roomCode query parameter', 400);
    }

    // Route to the GameRoom Durable Object for this room
    const id = c.env.GAME_ROOM.idFromName(roomCode);
    const stub = c.env.GAME_ROOM.get(id);

    // Forward the WebSocket upgrade to the Durable Object
    const doUrl = new URL(`http://internal/websocket?userId=${userId}&roomCode=${roomCode}`);
    return stub.fetch(new Request(doUrl.toString(), {
      headers: c.req.raw.headers,
    }));
  } catch {
    return c.text('Invalid token', 401);
  }
});

// ── Scheduled (Cron Trigger) ─────────────────────────────────────────

export default {
  fetch: app.fetch,

  /** Cron trigger for periodic maintenance. */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Trigger the Scheduler DO for background tasks
    const id = env.SCHEDULER.idFromName('global');
    const stub = env.SCHEDULER.get(id);
    ctx.waitUntil(stub.fetch(new Request('http://internal/tick', { method: 'POST' })));
  },
};
