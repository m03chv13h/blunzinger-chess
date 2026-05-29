import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createHealthHttpServer, resolveHealthPort } from './healthHttp.js';

const startedServers: Array<ReturnType<typeof createHealthHttpServer>> = [];

afterEach(async () => {
  await Promise.all(
    startedServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        }),
    ),
  );
});

describe('resolveHealthPort', () => {
  it('uses grpc port + 1 when grpc port is numeric', () => {
    expect(resolveHealthPort('50051')).toBe('50052');
  });

  it('falls back to 8080 when grpc port is not numeric', () => {
    expect(resolveHealthPort('not-a-port')).toBe('8080');
  });
});

describe('createHealthHttpServer', () => {
  it('returns 503 on /health before setReady is called', async () => {
    const server = createHealthHttpServer('50051');
    startedServers.push(server);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const { port } = server.address() as AddressInfo;

    const response = await fetch(`http://127.0.0.1:${port}/health`);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: 'starting',
      grpcPort: '50051',
    });
  });

  it('returns 200 on /health after setReady is called', async () => {
    const server = createHealthHttpServer('50051');
    startedServers.push(server);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const { port } = server.address() as AddressInfo;

    server.setReady();

    const response = await fetch(`http://127.0.0.1:${port}/health`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      grpcPort: '50051',
    });
  });

  it('returns 404 on unknown path', async () => {
    const server = createHealthHttpServer('50051');
    startedServers.push(server);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const { port } = server.address() as AddressInfo;

    const response = await fetch(`http://127.0.0.1:${port}/not-found`);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'not_found',
    });
  });
});
