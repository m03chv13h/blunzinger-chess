import { Context, MiddlewareHandler } from 'hono';
import * as jose from 'jose';
import type { Env, JwtPayload } from '../types.js';

/** Authenticated user context attached by the auth middleware. */
export interface AuthUser {
  userId: string;
  displayName: string;
  isGuest: boolean;
  provider: string;
  email?: string;
}

/** Hono middleware that verifies the JWT and attaches user context. */
export function authMiddleware(): MiddlewareHandler<{ Bindings: Env; Variables: { user: AuthUser } }> {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization');
    // Also check query param for WebSocket upgrade requests
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : c.req.query('access_token');

    if (!token) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    try {
      const secret = new TextEncoder().encode(c.env.JWT_SECRET);
      const { payload } = await jose.jwtVerify(token, secret, {
        issuer: 'BlunzigerChess',
        audience: 'BlunzigerChess',
      });

      const jwtPayload = payload as unknown as JwtPayload;

      c.set('user', {
        userId: jwtPayload.sub,
        displayName: jwtPayload.name,
        isGuest: jwtPayload.is_guest === 'true',
        provider: jwtPayload.provider,
        email: jwtPayload.email,
      });

      await next();
    } catch {
      return c.json({ error: 'Invalid token' }, 401);
    }
  };
}

/** Generate a JWT token for a user. */
export async function generateJwt(
  env: Env,
  user: { Id: string; DisplayName: string; CustomDisplayName: string | null; IsGuest: number; Provider: string; Email: string | null },
): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const effectiveName = user.CustomDisplayName || user.DisplayName;
  const expiresIn = user.IsGuest ? '30d' : '90d';

  const token = await new jose.SignJWT({
    sub: user.Id,
    name: effectiveName,
    is_guest: user.IsGuest ? 'true' : 'false',
    provider: user.Provider,
    ...(user.Email && { email: user.Email }),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('BlunzigerChess')
    .setAudience('BlunzigerChess')
    .setExpirationTime(expiresIn)
    .sign(secret);

  return token;
}

/** Helper to get the authenticated user from context. */
export function getUser(c: Context<{ Bindings: Env; Variables: { user: AuthUser } }>): AuthUser {
  return c.get('user');
}
