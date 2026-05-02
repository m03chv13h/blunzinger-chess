import { Hono } from 'hono';
import type { Env, GameRow } from '../types.js';
import { authMiddleware, getUser, type AuthUser } from '../middleware/auth.js';

const games = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

games.use('*', authMiddleware());

/** Save a completed game. */
games.post('/', async (c) => {
  const user = getUser(c);
  const body = await c.req.json<{
    matchConfig: string;
    gameState?: string;
    result?: string;
    scores?: string;
    positionHistory?: string;
    moveHistory?: string;
    finalFen?: string;
    moveCount: number;
    gameMode?: string;
  }>();

  const gameId = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO Games (Id, UserId, MatchConfig, GameStateJson, Result, Scores, PositionHistory, MoveHistory, FinalFen, MoveCount, GameMode, CreatedAt, CompletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    gameId,
    user.userId,
    body.matchConfig,
    body.gameState || null,
    body.result || null,
    body.scores || null,
    body.positionHistory || null,
    body.moveHistory || null,
    body.finalFen || null,
    body.moveCount,
    body.gameMode || 'local',
    now,
    now,
  ).run();

  return c.json({ gameId });
});

/** List the authenticated user's games. */
games.get('/', async (c) => {
  const user = getUser(c);
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(c.req.query('pageSize')) || 20));
  const gameMode = c.req.query('gameMode');
  const includeSpectated = c.req.query('includeSpectated') !== 'false';

  let whereClause = 'WHERE UserId = ?';
  const params: (string | number)[] = [user.userId];

  if (gameMode) {
    whereClause += ' AND GameMode = ?';
    params.push(gameMode);
  }

  if (!includeSpectated) {
    whereClause += ' AND MatchConfig NOT LIKE \'%"mode":"hvh"%\' AND MatchConfig NOT LIKE \'%"mode":"botvbot"%\'';
  }

  const countResult = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM Games ${whereClause}`
  ).bind(...params).first<{ total: number }>();
  const total = countResult?.total || 0;

  const offset = (page - 1) * pageSize;
  const gamesResult = await c.env.DB.prepare(
    `SELECT Id, MatchConfig, Result, Scores, FinalFen, MoveCount, GameMode, CreatedAt, CompletedAt
     FROM Games ${whereClause}
     ORDER BY COALESCE(CompletedAt, CreatedAt) DESC
     LIMIT ? OFFSET ?`
  ).bind(...params, pageSize, offset).all<GameRow>();

  return c.json({
    games: gamesResult.results,
    total,
    page,
    pageSize,
  });
});

/** Get a specific game by ID. */
games.get('/:id', async (c) => {
  const user = getUser(c);
  const id = c.req.param('id');

  const game = await c.env.DB.prepare(
    'SELECT * FROM Games WHERE Id = ? AND UserId = ?'
  ).bind(id, user.userId).first<GameRow>();

  if (!game) return c.json({ error: 'Not found' }, 404);
  return c.json(game);
});

export default games;
