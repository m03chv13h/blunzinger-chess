import { Hono } from 'hono';
import type { Env, RoomRow, UserRow } from '../types.js';
import { RoomStatus, MatchmakingStatus } from '../types.js';
import { authMiddleware, getUser, type AuthUser } from '../middleware/auth.js';

const lobby = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

lobby.use('*', authMiddleware());

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Create a new room or autopair with an existing waiting room. */
lobby.post('/rooms', async (c) => {
  const user = getUser(c);
  const body = await c.req.json<{ matchConfig: string }>();

  // Autopair: look for an existing waiting room with the same config
  const existingRoom = await c.env.DB.prepare(
    `SELECT r.*, u.DisplayName as HostDisplayName, u.CustomDisplayName as HostCustomName
     FROM MultiplayerRooms r
     LEFT JOIN Users u ON u.Id = r.HostUserId
     WHERE r.Status = ? AND r.HostUserId != ? AND r.MatchConfig = ?
     LIMIT 1`
  ).bind(RoomStatus.Waiting, user.userId, body.matchConfig).first<RoomRow & { HostDisplayName: string; HostCustomName: string | null }>();

  if (existingRoom) {
    const now = new Date().toISOString();
    await c.env.DB.prepare(
      'UPDATE MultiplayerRooms SET GuestUserId = ?, Status = ?, LastActivityAt = ? WHERE Id = ?'
    ).bind(user.userId, RoomStatus.Playing, now, existingRoom.Id).run();

    return c.json({
      roomId: existingRoom.Id,
      code: existingRoom.Code,
      paired: true,
      hostDisplayName: existingRoom.HostCustomName || existingRoom.HostDisplayName || 'Unknown',
    });
  }

  // Create new room
  const roomId = crypto.randomUUID();
  const code = generateRoomCode();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO MultiplayerRooms (Id, Code, HostUserId, MatchConfig, Status, CreatedAt)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(roomId, code, user.userId, body.matchConfig, RoomStatus.Waiting, now).run();

  return c.json({ roomId, code, paired: false });
});

/** Join a room by code. */
lobby.post('/rooms/join', async (c) => {
  const user = getUser(c);
  const body = await c.req.json<{ code: string }>();

  const room = await c.env.DB.prepare(
    `SELECT r.*, u.DisplayName as HostDisplayName, u.CustomDisplayName as HostCustomName
     FROM MultiplayerRooms r
     LEFT JOIN Users u ON u.Id = r.HostUserId
     WHERE r.Code = ? AND r.Status = ?`
  ).bind(body.code, RoomStatus.Waiting).first<RoomRow & { HostDisplayName: string; HostCustomName: string | null }>();

  if (!room) return c.json({ error: 'Room not found or already full' }, 404);
  if (room.HostUserId === user.userId) return c.json({ error: 'Cannot join your own room' }, 400);

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    'UPDATE MultiplayerRooms SET GuestUserId = ?, Status = ?, LastActivityAt = ? WHERE Id = ?'
  ).bind(user.userId, RoomStatus.Playing, now, room.Id).run();

  return c.json({
    roomId: room.Id,
    code: room.Code,
    matchConfig: room.MatchConfig,
    hostDisplayName: room.HostCustomName || room.HostDisplayName || 'Unknown',
  });
});

/** Check for active games to reconnect to. */
lobby.get('/rooms/active', async (c) => {
  const user = getUser(c);
  const abandonedCutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const room = await c.env.DB.prepare(
    `SELECT r.*,
            h.DisplayName as HostDisplayName, h.CustomDisplayName as HostCustomName,
            g.DisplayName as GuestDisplayName, g.CustomDisplayName as GuestCustomName
     FROM MultiplayerRooms r
     LEFT JOIN Users h ON h.Id = r.HostUserId
     LEFT JOIN Users g ON g.Id = r.GuestUserId
     WHERE r.Status = ?
       AND (r.HostUserId = ? OR r.GuestUserId = ?)
       AND COALESCE(r.LastActivityAt, r.CreatedAt) > ?
     ORDER BY r.CreatedAt DESC
     LIMIT 1`
  ).bind(RoomStatus.Playing, user.userId, user.userId, abandonedCutoff)
    .first<RoomRow & { HostDisplayName: string; HostCustomName: string | null; GuestDisplayName: string | null; GuestCustomName: string | null }>();

  if (!room) return c.json({ active: false });

  const isHost = room.HostUserId === user.userId;
  const opponentName = isHost
    ? (room.GuestCustomName || room.GuestDisplayName || 'Opponent')
    : (room.HostCustomName || room.HostDisplayName || 'Opponent');

  return c.json({
    active: true,
    roomCode: room.Code,
    playerColor: isHost ? 'w' : 'b',
    opponentName,
    matchConfig: room.MatchConfig,
  });
});

/** List public waiting rooms. */
lobby.get('/rooms', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT r.Id, r.Code, r.MatchConfig, r.CreatedAt,
            COALESCE(u.CustomDisplayName, u.DisplayName) as HostName
     FROM MultiplayerRooms r
     LEFT JOIN Users u ON u.Id = r.HostUserId
     WHERE r.Status = ?
     ORDER BY r.CreatedAt DESC
     LIMIT 50`
  ).bind(RoomStatus.Waiting).all();

  return c.json({ rooms: result.results });
});

/** Join matchmaking queue. */
lobby.post('/matchmaking', async (c) => {
  const user = getUser(c);
  const body = await c.req.json<{ preferredConfig: string }>();

  // Remove existing queued entries
  await c.env.DB.prepare(
    'DELETE FROM MatchmakingQueue WHERE UserId = ? AND Status = ?'
  ).bind(user.userId, MatchmakingStatus.Queued).run();

  const entryId = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    'INSERT INTO MatchmakingQueue (Id, UserId, PreferredConfig, Status, JoinedAt) VALUES (?, ?, ?, ?, ?)'
  ).bind(entryId, user.userId, body.preferredConfig, MatchmakingStatus.Queued, now).run();

  return c.json({ entryId });
});

/** Cancel matchmaking. */
lobby.delete('/matchmaking', async (c) => {
  const user = getUser(c);

  await c.env.DB.prepare(
    'UPDATE MatchmakingQueue SET Status = ? WHERE UserId = ? AND Status = ?'
  ).bind(MatchmakingStatus.Cancelled, user.userId, MatchmakingStatus.Queued).run();

  return c.body(null, 204);
});

export default lobby;
