import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

function isHealthRequest(req: IncomingMessage): boolean {
  if (req.method !== 'GET') {
    return false;
  }

  const requestUrl = req.url ?? '/';
  return requestUrl === '/health' || requestUrl.startsWith('/health?');
}

function writeJson(
  res: ServerResponse,
  statusCode: number,
  body: Record<string, unknown>,
): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

export function createHealthHttpServer(grpcPort: string) {
  return createServer((req, res) => {
    if (isHealthRequest(req)) {
      writeJson(res, 200, {
        status: 'ok',
        grpcPort,
      });
      return;
    }

    writeJson(res, 404, { error: 'not_found' });
  });
}

export function resolveHealthPort(grpcPort: string): string {
  const parsed = Number.parseInt(grpcPort, 10);
  if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 65534) {
    return String(parsed + 1);
  }

  return '8080';
}
