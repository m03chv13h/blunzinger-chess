/**
 * Simulation gRPC service implementation.
 *
 * Wraps the synchronous bot-vs-bot game runner from core/simulation.ts.
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Call<T> = ServerUnaryCall<T, any>;
type Callback<T> = sendUnaryData<T>;

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
      const config = JSON.parse(req.configJson) as import('../../../../src/core/blunziger/types.js').GameSetupConfig;
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
      const config = JSON.parse(req.configJson) as import('../../../../src/core/blunziger/types.js').GameSetupConfig;
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
};

function toGrpcError(err: unknown): { code: number; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  return { code: 13, message };
}
