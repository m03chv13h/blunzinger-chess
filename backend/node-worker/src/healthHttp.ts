import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';

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

export interface HealthHttpServer extends Server {
  /** Signal that the gRPC server is ready to accept connections. */
  setReady(): void;
}

export function createHealthHttpServer(grpcPort: string): HealthHttpServer {
  let ready = false;

  const server = createServer((req, res) => {
    if (isHealthRequest(req)) {
      if (!ready) {
        writeJson(res, 503, {
          status: 'starting',
          grpcPort,
        });
        return;
      }

      writeJson(res, 200, {
        status: 'ok',
        grpcPort,
      });
      return;
    }

    writeJson(res, 404, { error: 'not_found' });
  }) as HealthHttpServer;

  server.setReady = () => {
    ready = true;
  };

  return server;
}

export function resolveHealthPort(grpcPort: string): string {
  const parsed = Number.parseInt(grpcPort, 10);
  if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 65534) {
    return String(parsed + 1);
  }

  return '8080';
}
