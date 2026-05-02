import { Hono } from 'hono';
import type { Env, UserRow } from '../types.js';
import { authMiddleware, generateJwt, type AuthUser } from '../middleware/auth.js';

const auth = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

/** Return the list of configured OAuth providers. */
auth.get('/providers', (c) => {
  const providers: string[] = [];
  if (c.env.OAUTH_GOOGLE_CLIENT_ID && c.env.OAUTH_GOOGLE_CLIENT_SECRET) providers.push('Google');
  if (c.env.OAUTH_MICROSOFT_CLIENT_ID && c.env.OAUTH_MICROSOFT_CLIENT_SECRET) providers.push('Microsoft');
  if (c.env.OAUTH_GITHUB_CLIENT_ID && c.env.OAUTH_GITHUB_CLIENT_SECRET) providers.push('GitHub');
  if (c.env.OAUTH_DISCORD_CLIENT_ID && c.env.OAUTH_DISCORD_CLIENT_SECRET) providers.push('Discord');
  return c.json({ providers });
});

/** Initiate OAuth login for a specific provider. */
auth.get('/login/:provider', (c) => {
  const provider = c.req.param('provider').toLowerCase();
  const returnUrl = c.req.query('returnUrl') || '/';

  let authUrl: string;
  const state = btoa(JSON.stringify({ returnUrl }));

  const redirectUri = `${new URL(c.req.url).origin}/api/auth/callback/${provider}`;

  switch (provider) {
    case 'google': {
      const clientId = c.env.OAUTH_GOOGLE_CLIENT_ID;
      if (!clientId) return c.json({ error: 'Google OAuth not configured' }, 400);
      authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid+email+profile&state=${state}`;
      break;
    }
    case 'github': {
      const clientId = c.env.OAUTH_GITHUB_CLIENT_ID;
      if (!clientId) return c.json({ error: 'GitHub OAuth not configured' }, 400);
      authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email&state=${state}`;
      break;
    }
    case 'discord': {
      const clientId = c.env.OAUTH_DISCORD_CLIENT_ID;
      if (!clientId) return c.json({ error: 'Discord OAuth not configured' }, 400);
      authUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify+email&state=${state}`;
      break;
    }
    case 'microsoft': {
      const clientId = c.env.OAUTH_MICROSOFT_CLIENT_ID;
      if (!clientId) return c.json({ error: 'Microsoft OAuth not configured' }, 400);
      authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid+email+profile&state=${state}`;
      break;
    }
    default:
      return c.json({ error: 'Unsupported provider' }, 400);
  }

  return c.redirect(authUrl);
});

/** OAuth callback — exchanges code for token and issues JWT. */
auth.get('/callback/:provider', async (c) => {
  const provider = c.req.param('provider').toLowerCase();
  const code = c.req.query('code');
  const stateParam = c.req.query('state');

  if (!code) return c.json({ error: 'No code provided' }, 400);

  let returnUrl = '/';
  if (stateParam) {
    try {
      const state = JSON.parse(atob(stateParam));
      returnUrl = state.returnUrl || '/';
    } catch { /* ignore */ }
  }

  const redirectUri = `${new URL(c.req.url).origin}/api/auth/callback/${provider}`;
  let providerId: string;
  let displayName: string;
  let email: string | null = null;
  let avatarUrl: string | null = null;

  try {
    switch (provider) {
      case 'github': {
        // Exchange code for access token
        const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            client_id: c.env.OAUTH_GITHUB_CLIENT_ID,
            client_secret: c.env.OAUTH_GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: redirectUri,
          }),
        });
        const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
        if (!tokenData.access_token) throw new Error(tokenData.error || 'Failed to get access token');

        // Get user info
        const userRes = await fetch('https://api.github.com/user', {
          headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'BlunzigerChess' },
        });
        const userData = await userRes.json() as { id: number; login: string; email?: string; avatar_url?: string };
        providerId = String(userData.id);
        displayName = userData.login;
        email = userData.email || null;
        avatarUrl = userData.avatar_url || null;
        break;
      }
      case 'google': {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: c.env.OAUTH_GOOGLE_CLIENT_ID!,
            client_secret: c.env.OAUTH_GOOGLE_CLIENT_SECRET!,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        });
        const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
        if (!tokenData.access_token) throw new Error(tokenData.error || 'Failed to get access token');

        const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const userData = await userRes.json() as { id: string; name: string; email?: string; picture?: string };
        providerId = userData.id;
        displayName = userData.name;
        email = userData.email || null;
        avatarUrl = userData.picture || null;
        break;
      }
      case 'discord': {
        const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: c.env.OAUTH_DISCORD_CLIENT_ID!,
            client_secret: c.env.OAUTH_DISCORD_CLIENT_SECRET!,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        });
        const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
        if (!tokenData.access_token) throw new Error(tokenData.error || 'Failed to get access token');

        const userRes = await fetch('https://discord.com/api/users/@me', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const userData = await userRes.json() as { id: string; username: string; email?: string; avatar?: string };
        providerId = userData.id;
        displayName = userData.username;
        email = userData.email || null;
        avatarUrl = userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : null;
        break;
      }
      case 'microsoft': {
        const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: c.env.OAUTH_MICROSOFT_CLIENT_ID!,
            client_secret: c.env.OAUTH_MICROSOFT_CLIENT_SECRET!,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
            scope: 'openid email profile',
          }),
        });
        const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
        if (!tokenData.access_token) throw new Error(tokenData.error || 'Failed to get access token');

        const userRes = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const userData = await userRes.json() as { id: string; displayName: string; mail?: string };
        providerId = userData.id;
        displayName = userData.displayName;
        email = userData.mail || null;
        break;
      }
      default:
        return c.json({ error: 'Unsupported provider' }, 400);
    }
  } catch (err) {
    return c.json({ error: `OAuth failed: ${err instanceof Error ? err.message : String(err)}` }, 400);
  }

  // Find or create user
  const existingUser = await c.env.DB.prepare(
    'SELECT * FROM Users WHERE Provider = ? AND ProviderId = ?'
  ).bind(provider, providerId).first<UserRow>();

  let userId: string;
  if (existingUser) {
    // Update profile info
    await c.env.DB.prepare(
      'UPDATE Users SET DisplayName = ?, Email = ?, AvatarUrl = ? WHERE Id = ?'
    ).bind(displayName, email, avatarUrl, existingUser.Id).run();
    userId = existingUser.Id;
  } else {
    userId = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO Users (Id, DisplayName, Email, AvatarUrl, Provider, ProviderId, IsGuest, CreatedAt) VALUES (?, ?, ?, ?, ?, ?, 0, datetime(\'now\'))'
    ).bind(userId, displayName, email, avatarUrl, provider, providerId).run();
  }

  const user = await c.env.DB.prepare('SELECT * FROM Users WHERE Id = ?').bind(userId).first<UserRow>();
  if (!user) return c.json({ error: 'User creation failed' }, 500);

  const token = await generateJwt(c.env, user);

  // Redirect to frontend with token — insert before any hash fragment
  const hashIndex = returnUrl.indexOf('#');
  let baseUrl: string, fragment: string;
  if (hashIndex >= 0) {
    baseUrl = returnUrl.slice(0, hashIndex);
    fragment = returnUrl.slice(hashIndex);
  } else {
    baseUrl = returnUrl;
    fragment = '';
  }
  const separator = baseUrl.includes('?') ? '&' : '?';
  return c.redirect(`${baseUrl}${separator}token=${token}${fragment}`);
});

/** Create a guest user and return JWT. */
auth.post('/guest', async (c) => {
  const userId = crypto.randomUUID();
  const guestName = `Guest_${userId.slice(0, 8)}`;

  await c.env.DB.prepare(
    'INSERT INTO Users (Id, DisplayName, Provider, IsGuest, CreatedAt) VALUES (?, ?, \'guest\', 1, datetime(\'now\'))'
  ).bind(userId, guestName).run();

  const user = await c.env.DB.prepare('SELECT * FROM Users WHERE Id = ?').bind(userId).first<UserRow>();
  if (!user) return c.json({ error: 'User creation failed' }, 500);

  const token = await generateJwt(c.env, user);
  return c.json({ token, userId, displayName: guestName });
});

/** Get the currently authenticated user's profile. */
auth.get('/me', authMiddleware(), (c) => {
  const user = c.get('user');
  return c.json({
    userId: user.userId,
    displayName: user.displayName,
    isGuest: user.isGuest,
    provider: user.provider,
  });
});

export default auth;
