import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createHealthHttpServer } from './healthHttp.js';
import { createPortMux } from './portMux.js';
import * as grpc from '@grpc/grpc-js';

const cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((fn) => fn()));
});

describe('createPortMux', () => {
  it('routes HTTP/1.1 requests to the health handler', async () => {
    // Start a gRPC server on a random port (won't actually be hit)
    const grpcServer = new grpc.Server();
    const grpcPort = await new Promise<number>((resolve, reject) => {
      grpcServer.bindAsync(
        '127.0.0.1:0',
        grpc.ServerCredentials.createInsecure(),
        (err, port) => {
          if (err) reject(err);
          else resolve(port);
        },
      );
    });
    cleanup.push(() => new Promise<void>((resolve) => {
      grpcServer.tryShutdown(() => resolve());
    }));

    const healthServer = createHealthHttpServer('50051');
    const mux = createPortMux(healthServer, '127.0.0.1', grpcPort);

    await new Promise<void>((resolve) => {
      mux.listen(0, '127.0.0.1', () => resolve());
    });
    cleanup.push(
      () => new Promise<void>((resolve, reject) => {
        mux.close((err) => (err ? reject(err) : resolve()));
      }),
    );

    const { port } = mux.address() as AddressInfo;

    // HTTP/1.1 GET /health should be handled by the health server
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: 'ok', grpcPort: '50051' });
  });

  it('returns 404 for non-health HTTP/1.1 requests', async () => {
    const grpcServer = new grpc.Server();
    const grpcPort = await new Promise<number>((resolve, reject) => {
      grpcServer.bindAsync(
        '127.0.0.1:0',
        grpc.ServerCredentials.createInsecure(),
        (err, port) => {
          if (err) reject(err);
          else resolve(port);
        },
      );
    });
    cleanup.push(() => new Promise<void>((resolve) => {
      grpcServer.tryShutdown(() => resolve());
    }));

    const healthServer = createHealthHttpServer('50051');
    const mux = createPortMux(healthServer, '127.0.0.1', grpcPort);

    await new Promise<void>((resolve) => {
      mux.listen(0, '127.0.0.1', () => resolve());
    });
    cleanup.push(
      () => new Promise<void>((resolve, reject) => {
        mux.close((err) => (err ? reject(err) : resolve()));
      }),
    );

    const { port } = mux.address() as AddressInfo;

    const response = await fetch(`http://127.0.0.1:${port}/unknown`);
    expect(response.status).toBe(404);
  });
});
