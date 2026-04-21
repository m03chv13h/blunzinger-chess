/**
 * Simulation gRPC service implementation.
 *
 * Wraps the synchronous bot-vs-bot game runner from core/simulation.ts.
 * Supports both synchronous (RunSimulatedGame / RunBatchSimulationJson)
 * and queue-based async (EnqueueBatchSimulation / GetSimulationProgress)
 * execution modes.
 */

import type { ServerUnaryCall, sendUnaryData } from '@grpc/grpc-js';
import { runSimulatedGame } from '../../../../src/core/simulation.js';
import {
  protoToGameSetupConfig,
  gameSetupConfigToProto,
  gameResultToProto,
  scoreStateToProto,
  positionHistoryEntryToProto,
  moveToProto,
} from '../mapping.js';
import type { GameRecord } from '../../../../src/core/gameRecord.js';
import type { GameSetupConfig } from '../../../../src/core/blunziger/types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Call<T> = ServerUnaryCall<T, any>;
type Callback<T> = sendUnaryData<T>;

// ── Queue-based async simulation state ───────────────────────────────

interface SimulationJob {
  config: GameSetupConfig;
  totalGames: number;
  completedRecords: GameRecord[];
  finished: boolean;
  /** Timestamp when the job finished, used for delayed cleanup. */
  finishedAt?: number;
}

/** In-memory map of active simulation jobs keyed by simulation ID. */
const simulationJobs = new Map<string, SimulationJob>();

/** Whether the background queue processor is currently running. */
let processingQueue = false;

/** Grace period (ms) to keep finished jobs before cleanup. */
const FINISHED_JOB_TTL_MS = 60_000;

/**
 * Process the next pending game across all queued simulations.
 * Runs one game at a time, then yields via setTimeout so the event loop
 * stays responsive for incoming gRPC calls.
 */
function processQueue(): void {
  if (processingQueue) return;
  processingQueue = true;

  const runNextGame = () => {
    // Find first simulation with remaining games
    let activeJob: SimulationJob | undefined;
    for (const job of simulationJobs.values()) {
      if (!job.finished) {
        activeJob = job;
        break;
      }
    }

    if (!activeJob) {
      processingQueue = false;
      return;
    }

    // Run one game synchronously
    const record = runSimulatedGame(activeJob.config);
    activeJob.completedRecords.push(record);

    if (activeJob.completedRecords.length >= activeJob.totalGames) {
      activeJob.finished = true;
      activeJob.finishedAt = Date.now();
    }

    // Clean up finished jobs past the grace period
    const now = Date.now();
    for (const [id, job] of simulationJobs) {
      if (job.finished && job.finishedAt && now - job.finishedAt > FINISHED_JOB_TTL_MS) {
        simulationJobs.delete(id);
      }
    }

    // Yield to event loop before processing the next game
    setTimeout(runNextGame, 0);
  };

  setTimeout(runNextGame, 0);
}

// ── Proto helpers ────────────────────────────────────────────────────

function gameRecordToProto(record: GameRecord) {
  return {
    id: record.id,
    completed_at: record.completedAt,
    config: gameSetupConfigToProto(record.config),
    result: gameResultToProto(record.result),
    final_fen: record.finalFen,
    move_count: record.moveCount,
    scores: scoreStateToProto(record.scores),
    position_history: record.positionHistory.map(positionHistoryEntryToProto),
    move_history: record.moveHistory.map(moveToProto),
    violation_reports: record.violationReports.map((vr) => ({
      move_index: vr.moveIndex,
      reporting_side: vr.reportingSide === 'w' ? 1 : 2,
      valid: vr.valid,
    })),
    missed_checks: record.missedChecks.map((mc) => ({
      move_index: mc.moveIndex,
      violation_type: mc.violationType === 'missed_check' ? 1
        : mc.violationType === 'gave_forbidden_check' ? 2
        : mc.violationType === 'missed_check_removal' ? 3 : 4,
      available_moves: mc.availableMoves,
      available_regular_moves: mc.availableRegularMoves ?? [],
      available_drop_moves: mc.availableDropMoves ?? [],
      available_removal_squares: mc.availableRemovalSquares ?? [],
      is_additional_move: mc.isAdditionalMove ?? false,
    })),
    piece_removals: record.pieceRemovals.map((pr) => ({
      move_index: pr.moveIndex,
      piece_type: pr.pieceType,
      piece_color: pr.pieceColor,
    })),
    time_reductions: record.timeReductions.map((tr) => ({
      move_index: tr.moveIndex,
      seconds: tr.seconds,
    })),
  };
}

export const simulationHandlers = {
  RunSimulatedGame(call: Call<unknown>, callback: Callback<unknown>) {
    try {
      const req = call.request as { config: unknown };
      const config = protoToGameSetupConfig(req.config);
      const record = runSimulatedGame(config);
      callback(null, { record: gameRecordToProto(record) });
    } catch (err) {
      callback(toGrpcError(err));
    }
  },

  /**
   * JSON passthrough variant — accepts and returns native frontend JSON
   * so the .NET API gateway can forward requests without complex enum mapping.
   */
  RunSimulatedGameJson(call: Call<unknown>, callback: Callback<unknown>) {
    try {
      const req = call.request as { configJson: string };
      const config = JSON.parse(req.configJson) as GameSetupConfig;
      const record = runSimulatedGame(config);
      callback(null, { recordJson: JSON.stringify(record) });
    } catch (err) {
      callback(toGrpcError(err));
    }
  },

  /**
   * Batch JSON variant — runs N games sequentially and returns all records
   * as a JSON array string.
   */
  RunBatchSimulationJson(call: Call<unknown>, callback: Callback<unknown>) {
    try {
      const req = call.request as { configJson: string; count: number };
      const config = JSON.parse(req.configJson) as GameSetupConfig;
      const count = Math.max(1, Math.min(req.count, 200));
      const records: GameRecord[] = [];
      for (let i = 0; i < count; i++) {
        records.push(runSimulatedGame(config));
      }
      callback(null, { recordsJson: JSON.stringify(records) });
    } catch (err) {
      callback(toGrpcError(err));
    }
  },

  /**
   * Enqueue a batch of games for async processing.
   * Each game is placed as a separate item in the worker's internal queue.
   * Returns immediately after queuing.
   */
  EnqueueBatchSimulation(call: Call<unknown>, callback: Callback<unknown>) {
    try {
      const req = call.request as { simulationId: string; configJson: string; count: number };
      const config = JSON.parse(req.configJson) as GameSetupConfig;
      const count = Math.max(1, Math.min(req.count, 200));

      simulationJobs.set(req.simulationId, {
        config,
        totalGames: count,
        completedRecords: [],
        finished: false,
      });

      // Start processing the queue (no-op if already running)
      processQueue();

      callback(null, {});
    } catch (err) {
      callback(toGrpcError(err));
    }
  },

  /**
   * Return the current progress for a queued simulation.
   * Returns NOT_FOUND (code 5) if the simulation ID is unknown.
   */
  GetSimulationProgress(call: Call<unknown>, callback: Callback<unknown>) {
    try {
      const req = call.request as { simulationId: string };
      const job = simulationJobs.get(req.simulationId);

      if (!job) {
        // Unknown simulation — may have been cleaned up after the grace period
        // or was never enqueued. Return NOT_FOUND so the caller can distinguish
        // this from a legitimately finished simulation.
        callback({ code: 5, message: `Simulation ${req.simulationId} not found` });
        return;
      }

      callback(null, {
        completedGames: job.completedRecords.length,
        totalGames: job.totalGames,
        completedRecordsJson: JSON.stringify(job.completedRecords),
        finished: job.finished,
      });
    } catch (err) {
      callback(toGrpcError(err));
    }
  },
};

function toGrpcError(err: unknown): { code: number; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  return { code: 13, message };
}
