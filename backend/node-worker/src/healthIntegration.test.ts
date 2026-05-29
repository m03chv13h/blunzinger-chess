/**
 * Integration test: verifies health via both HTTP (/health) and gRPC
 * (grpc.health.v1.Health/Check) through the port mux, matching the
 * real deployment topology where a single port handles both protocols.
 */
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import * as grpc from '@grpc/grpc-js';
import { createHealthHttpServer } from './healthHttp.js';
import { createPortMux } from './portMux.js';

const cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((fn) => fn()));
});

/**
 * Builds a minimal gRPC server with a Health/Check RPC, just like
 * the real server.ts does.  Returns the bound loopback port.
 */
async function startGrpcServerWithHealth(): Promise<{ server: grpc.Server; port: number }> {
  const server = new grpc.Server();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const healthServiceDefinition: grpc.ServiceDefinition<any> = {
    Check: {
      path: '/grpc.health.v1.Health/Check',
      requestStream: false,
      responseStream: false,
      requestSerialize: (value: unknown) => Buffer.from(JSON.stringify(value)),
      requestDeserialize: (buffer: Buffer) => JSON.parse(buffer.toString()),
      responseSerialize: (value: unknown) => Buffer.from(JSON.stringify(value)),
      responseDeserialize: (buffer: Buffer) => JSON.parse(buffer.toString()),
    },
  };
  server.addService(healthServiceDefinition, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Check(_call: any, callback: any) {
      callback(null, { status: 1 /* SERVING */ });
    },
  });

  const port = await new Promise<number>((resolve, reject) => {
    server.bindAsync(
      '127.0.0.1:0',
      grpc.ServerCredentials.createInsecure(),
      (err, boundPort) => {
        if (err) reject(err);
        else resolve(boundPort);
      },
    );
  });

  cleanup.push(
    () => new Promise<void>((resolve) => { server.tryShutdown(() => resolve()); }),
  );

  return { server, port };
}

/**
 * Creates a gRPC client that can call Health/Check on the given address.
 */
function createHealthClient(address: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const healthServiceDefinition: grpc.ServiceDefinition<any> = {
    Check: {
      path: '/grpc.health.v1.Health/Check',
      requestStream: false,
      responseStream: false,
      requestSerialize: (value: unknown) => Buffer.from(JSON.stringify(value)),
      requestDeserialize: (buffer: Buffer) => JSON.parse(buffer.toString()),
      responseSerialize: (value: unknown) => Buffer.from(JSON.stringify(value)),
      responseDeserialize: (buffer: Buffer) => JSON.parse(buffer.toString()),
    },
  };

  const Client = grpc.makeGenericClientConstructor(healthServiceDefinition, 'Health');
  return new Client(address, grpc.credentials.createInsecure());
}

describe('health integration (HTTP + gRPC via port mux)', () => {
  it('HTTP /health returns 503 before setReady, 200 after', async () => {
    const { port: grpcPort } = await startGrpcServerWithHealth();

    const healthServer = createHealthHttpServer(String(grpcPort));
    const mux = createPortMux(healthServer, '127.0.0.1', grpcPort);

    await new Promise<void>((resolve) => { mux.listen(0, '127.0.0.1', () => resolve()); });
    cleanup.push(
      () => new Promise<void>((resolve, reject) => { mux.close((err) => (err ? reject(err) : resolve())); }),
    );

    const { port: muxPort } = mux.address() as AddressInfo;

    // Before ready: 503
    const pre = await fetch(`http://127.0.0.1:${muxPort}/health`);
    expect(pre.status).toBe(503);
    expect(await pre.json()).toMatchObject({ status: 'starting' });

    // Signal readiness (as server.ts does after gRPC binds)
    healthServer.setReady();

    // After ready: 200
    const post = await fetch(`http://127.0.0.1:${muxPort}/health`);
    expect(post.status).toBe(200);
    expect(await post.json()).toMatchObject({ status: 'ok' });
  });

  it('gRPC Health/Check returns SERVING through the port mux', async () => {
    const { port: grpcPort } = await startGrpcServerWithHealth();

    const healthServer = createHealthHttpServer(String(grpcPort));
    healthServer.setReady();
    const mux = createPortMux(healthServer, '127.0.0.1', grpcPort);

    await new Promise<void>((resolve) => { mux.listen(0, '127.0.0.1', () => resolve()); });
    cleanup.push(
      () => new Promise<void>((resolve, reject) => { mux.close((err) => (err ? reject(err) : resolve())); }),
    );

    const { port: muxPort } = mux.address() as AddressInfo;

    // Call gRPC Health/Check through the same mux port
    const client = createHealthClient(`127.0.0.1:${muxPort}`);
    cleanup.push(() => { client.close(); return Promise.resolve(); });

    const result = await new Promise<{ status: number }>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).Check({}, (err: grpc.ServiceError | null, response: any) => {
        if (err) reject(err);
        else resolve(response);
      });
    });

    // status 1 = SERVING in grpc.health.v1
    expect(result.status).toBe(1);
  });

  it('both HTTP and gRPC health pass concurrently on the same port', async () => {
    const { port: grpcPort } = await startGrpcServerWithHealth();

    const healthServer = createHealthHttpServer(String(grpcPort));
    healthServer.setReady();
    const mux = createPortMux(healthServer, '127.0.0.1', grpcPort);

    await new Promise<void>((resolve) => { mux.listen(0, '127.0.0.1', () => resolve()); });
    cleanup.push(
      () => new Promise<void>((resolve, reject) => { mux.close((err) => (err ? reject(err) : resolve())); }),
    );

    const { port: muxPort } = mux.address() as AddressInfo;

    const client = createHealthClient(`127.0.0.1:${muxPort}`);
    cleanup.push(() => { client.close(); return Promise.resolve(); });

    // Fire both checks in parallel
    const [httpRes, grpcRes] = await Promise.all([
      fetch(`http://127.0.0.1:${muxPort}/health`),
      new Promise<{ status: number }>((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (client as any).Check({}, (err: grpc.ServiceError | null, response: any) => {
          if (err) reject(err);
          else resolve(response);
        });
      }),
    ]);

    expect(httpRes.status).toBe(200);
    expect(await httpRes.json()).toMatchObject({ status: 'ok' });
    expect(grpcRes.status).toBe(1);
  });
});
