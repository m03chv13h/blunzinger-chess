/**
 * Blunzinger Chess Node.js gRPC Worker
 *
 * Internal gRPC service exposing the game logic engine, bot, evaluation,
 * and simulation capabilities to the .NET API backend.
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gameLogicHandlers } from './services/gameLogic.js';
import { botHandlers } from './services/bot.js';
import { evaluationHandlers } from './services/evaluation.js';
import { restoreSimulationJobs, simulationHandlers } from './services/simulation.js';
import { loadOpenSimulationJobs } from './services/simulationPersistence.js';
import { createHealthHttpServer, resolveHealthPort } from './healthHttp.js';
import { createPortMux } from './portMux.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROTO_DIR = path.resolve(__dirname, '../../proto');

const PROTO_OPTIONS: protoLoader.Options = {
  keepCase: false,
  longs: Number,
  enums: Number,
  defaults: true,
  oneofs: true,
  includeDirs: [PROTO_DIR],
};

function loadProto(filename: string) {
  const packageDefinition = protoLoader.loadSync(
    path.join(PROTO_DIR, filename),
    PROTO_OPTIONS,
  );
  return grpc.loadPackageDefinition(packageDefinition);
}

const PORT = process.env.PORT ?? '50051';
const HOST = process.env.HOST ?? '0.0.0.0';
const HEALTH_PORT = process.env.HEALTH_PORT ?? resolveHealthPort(PORT);
const HEALTH_HOST = process.env.HEALTH_HOST ?? HOST;
// Internal-only port for gRPC when the port mux is active.
// The mux listens on PORT and proxies HTTP/2 traffic here.
const GRPC_INTERNAL_PORT = process.env.GRPC_INTERNAL_PORT ?? '50061';

async function main() {
  const server = new grpc.Server();

  // Load proto definitions
  const gameLogicProto = loadProto('game_logic.proto');
  const botProto = loadProto('bot.proto');
  const evaluationProto = loadProto('evaluation.proto');
  const simulationProto = loadProto('simulation.proto');

  // Get service definitions from loaded protos
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pkg = (proto: any) => proto.blunzinger_chess;

  const gameLogicService = pkg(gameLogicProto).GameLogicService;
  const botService = pkg(botProto).BotService;
  const evaluationService = pkg(evaluationProto).EvaluationService;
  const simulationService = pkg(simulationProto).SimulationService;

  // Register service implementations
  server.addService(gameLogicService.service, gameLogicHandlers);
  server.addService(botService.service, botHandlers);
  server.addService(evaluationService.service, evaluationHandlers);
  server.addService(simulationService.service, simulationHandlers);

  try {
    const openSimulationJobs = await loadOpenSimulationJobs();
    const restoredCount = restoreSimulationJobs(openSimulationJobs);
    if (restoredCount > 0) {
      console.log(`Restored ${restoredCount} open simulation job(s) from database`);
    }
  } catch (err) {
    console.error('Failed to restore open simulation jobs from database:', err);
  }

  // Add gRPC health check (simple implementation without external health proto)
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

  // Health HTTP server handles /health for HTTP/1.1 requests
  const healthServer = createHealthHttpServer(PORT);

  // Start gRPC server on loopback — the port mux will proxy HTTP/2 traffic here
  server.bindAsync(
    `127.0.0.1:${GRPC_INTERNAL_PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        console.error('Failed to start gRPC server:', err);
        process.exit(1);
      }
      console.log(`gRPC server listening on 127.0.0.1:${port}`);
      // Signal readiness only after gRPC is bound and accepting connections
      healthServer.setReady();
    },
  );

  // Port multiplexer on the external PORT — routes HTTP/1.1 to health server,
  // HTTP/2 (gRPC) to the internal gRPC port.  This allows Render to
  // health-check the service via plain HTTP on the same PORT and also allows
  // the .NET API's wake-up request to receive a valid response.
  const mux = createPortMux(healthServer, '127.0.0.1', Number(GRPC_INTERNAL_PORT));
  mux.listen(Number(PORT), HOST, () => {
    console.log(`Port mux listening on ${HOST}:${PORT} (HTTP/1.1 → health, HTTP/2 → gRPC)`);
  });

  // Also keep the standalone health endpoint on HEALTH_PORT for backward compat
  healthServer.listen(Number(HEALTH_PORT), HEALTH_HOST, () => {
    console.log(`Health endpoint listening on http://${HEALTH_HOST}:${HEALTH_PORT}/health`);
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
