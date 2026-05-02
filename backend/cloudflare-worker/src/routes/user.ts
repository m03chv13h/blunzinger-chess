import { Hono } from 'hono';
import type { Env, UserRow } from '../types.js';
import { authMiddleware, getUser, type AuthUser } from '../middleware/auth.js';

const user = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

user.use('*', authMiddleware());

/** Get user profile with game statistics. */
user.get('/profile', async (c) => {
  const authUser = getUser(c);

  const dbUser = await c.env.DB.prepare(
    'SELECT * FROM Users WHERE Id = ?'
  ).bind(authUser.userId).first<UserRow>();

  if (!dbUser) return c.json({ error: 'Not found' }, 404);

  const gameCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM Games WHERE UserId = ?'
  ).bind(authUser.userId).first<{ count: number }>();

  return c.json({
    Id: dbUser.Id,
    DisplayName: dbUser.CustomDisplayName || dbUser.DisplayName,
    Email: dbUser.Email,
    AvatarUrl: dbUser.CustomAvatarUrl || dbUser.AvatarUrl,
    Provider: dbUser.Provider,
    IsGuest: Boolean(dbUser.IsGuest),
    CreatedAt: dbUser.CreatedAt,
    GameCount: gameCount?.count || 0,
    ProviderDisplayName: dbUser.DisplayName,
    ProviderAvatarUrl: dbUser.AvatarUrl,
  });
});

/** Update display name and/or avatar URL. */
user.patch('/profile', async (c) => {
  const authUser = getUser(c);
  const body = await c.req.json<{ displayName?: string; avatarUrl?: string }>();

  const dbUser = await c.env.DB.prepare(
    'SELECT * FROM Users WHERE Id = ?'
  ).bind(authUser.userId).first<UserRow>();

  if (!dbUser) return c.json({ error: 'Not found' }, 404);

  const updates: string[] = [];
  const params: (string | null)[] = [];

  if (body.displayName?.trim()) {
    updates.push('CustomDisplayName = ?');
    params.push(body.displayName.trim());
  }

  if (body.avatarUrl !== undefined) {
    updates.push('CustomAvatarUrl = ?');
    params.push(body.avatarUrl?.trim() || null);
  }

  if (updates.length > 0) {
    params.push(authUser.userId);
    await c.env.DB.prepare(
      `UPDATE Users SET ${updates.join(', ')} WHERE Id = ?`
    ).bind(...params).run();
  }

  const updatedUser = await c.env.DB.prepare(
    'SELECT * FROM Users WHERE Id = ?'
  ).bind(authUser.userId).first<UserRow>();

  return c.json({
    Id: updatedUser!.Id,
    DisplayName: updatedUser!.CustomDisplayName || updatedUser!.DisplayName,
    AvatarUrl: updatedUser!.CustomAvatarUrl || updatedUser!.AvatarUrl,
  });
});

export default user;
