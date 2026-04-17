/**
 * Deployment mode configuration.
 *
 * Controls whether the app runs as a standalone static webapp (no backend)
 * or as a deployed webapp connected to the .NET API backend.
 *
 * Set via the `VITE_DEPLOY_MODE` environment variable:
 * - `'static'`    — No backend. Auth, online play, and persistent game
 *                    history are disabled. All game logic runs client-side.
 * - `'connected'` — Full backend integration with auth, multiplayer,
 *                    game persistence, and user profiles.
 *
 * Defaults to `'static'` when the variable is unset.
 */

export type DeployMode = 'static' | 'connected';

const raw = import.meta.env.VITE_DEPLOY_MODE ?? 'static';

export const DEPLOY_MODE: DeployMode =
  raw === 'connected' ? 'connected' : 'static';

export const isConnectedMode = DEPLOY_MODE === 'connected';
export const isStaticMode = DEPLOY_MODE === 'static';
