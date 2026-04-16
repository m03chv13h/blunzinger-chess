/**
 * Base HTTP client for the Blunziger Chess backend API.
 *
 * Handles JWT token storage, automatic Authorization headers,
 * and response deserialization.  All service modules (auth, lobby)
 * call through this client.
 */

const TOKEN_KEY = 'blunziger_token';

/**
 * Resolve the API base URL from the environment.
 *
 * - Empty string → "same origin" (handled by Vite proxy in dev).
 * - Bare hostname or host:port (e.g. from Render `fromService` linking) →
 *   prepends `https://`.
 * - Full URL → used as-is.
 */
function resolveApiBase(): string {
  const raw = import.meta.env.VITE_API_BASE_URL ?? '';
  if (!raw) return '';
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
    return `https://${raw}`;
  }
  return raw;
}

/** Resolved base URL — empty string means "same origin" (handled by Vite proxy in dev). */
export const API_BASE = resolveApiBase();

// ── Token helpers ────────────────────────────────────────────────────

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage may be unavailable (private browsing, quota exceeded).
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore
  }
}

// ── HTTP helpers ─────────────────────────────────────────────────────

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`API ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** When `true` the Authorization header is omitted. */
  anonymous?: boolean;
}

/**
 * Low-level fetch wrapper.
 *
 * - Prepends `API_BASE`.
 * - Attaches the JWT token as a Bearer header (unless `anonymous`).
 * - Returns parsed JSON on 2xx; throws `ApiError` otherwise.
 */
export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, anonymous = false } = opts;

  const headers: Record<string, string> = {};

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (!anonymous) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) {
    // 204 No Content — callers should use apiFetch<void> for these endpoints.
    return undefined as unknown as T;
  }

  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    throw new ApiError(res.status, data);
  }

  // All API endpoints return JSON.  A successful non-JSON response (e.g.
  // an SPA fallback returning index.html for an /api/* route) indicates
  // that the request never reached the backend.
  if (!isJson) {
    throw new ApiError(res.status, 'Expected JSON response from API');
  }

  return data as T;
}
