/**
 * TCP port multiplexer — routes incoming connections on a single port to
 * either an HTTP/1.1 handler (health checks) or the gRPC (HTTP/2) server.
 *
 * Detection: HTTP/2 connections start with the client connection preface
 * "PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n" (first 3 bytes are "PRI").
 * Everything else is assumed to be HTTP/1.1.
 *
 * This allows Render to health-check the service via HTTP/1.1 on the same
 * PORT that the gRPC server uses, and enables the wake-up mechanism to
 * receive a proper HTTP response.
 */

import { createServer as createNetServer, Socket } from 'node:net';
import type { Server as NetServer } from 'node:net';
import type { Server as HttpServer } from 'node:http';

const HTTP2_PREFACE_PREFIX = 'PRI';

export function createPortMux(
  httpServer: HttpServer,
  grpcHost: string,
  grpcPort: number,
): NetServer {
  const mux = createNetServer((socket) => {
    socket.once('readable', () => {
      const buf: Buffer | null = socket.read(3);

      if (!buf || buf.length < 3) {
        // Not enough data — close gracefully
        socket.destroy();
        return;
      }

      // Put the bytes back so downstream servers get the full stream
      socket.unshift(buf);

      const prefix = buf.toString('ascii', 0, 3);

      if (prefix === HTTP2_PREFACE_PREFIX) {
        // HTTP/2 (gRPC) → proxy to gRPC server on loopback
        const proxy = new Socket();
        proxy.connect(grpcPort, grpcHost, () => {
          socket.pipe(proxy);
          proxy.pipe(socket);
        });
        proxy.on('error', () => socket.destroy());
        socket.on('error', () => proxy.destroy());
      } else {
        // HTTP/1.1 → emit on the HTTP server
        httpServer.emit('connection', socket);
      }
    });
  });

  return mux;
}
