/**
 * Bot gRPC service implementation.
 *
 * Wraps bot move selection from bot/botEngine.ts for gRPC consumption.
 */

import type { ServerUnaryCall, sendUnaryData } from '@grpc/grpc-js';
import { selectBotMove, selectBotDropMove, shouldBotReport } from '../../../../src/bot/botEngine.js';
import { selectBestPieceForRemoval } from '../../../../src/core/blunziger/engine.js';
import {
  protoToBotLevel,
  protoToMatchConfig,
  protoToChess960State,
  protoToCrazyhouseState,
  protoToViolationRecord,
  protoToColor,
  protoToVariantMode,
  moveToProto,
  dropMoveToProto,
} from '../mapping.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Call<T> = ServerUnaryCall<T, any>;
type Callback<T> = sendUnaryData<T>;

export const botHandlers = {
  SelectBotMove(call: Call<unknown>, callback: Callback<unknown>) {
    try {
      const req = call.request as { fen: string; level: number; config?: unknown; chess960?: unknown };
      const level = protoToBotLevel(req.level);
      const config = req.config ? protoToMatchConfig(req.config) : undefined;
      const chess960 = protoToChess960State(req.chess960);
      const move = selectBotMove(req.fen, level, config, chess960);
      callback(null, { move: move ? moveToProto(move) : null });
    } catch (err) {
      callback(toGrpcError(err));
    }
  },

  SelectBotDropMove(call: Call<unknown>, callback: Callback<unknown>) {
    try {
      const req = call.request as { fen: string; level: number; crazyhouse: unknown; side: number; config?: unknown; chess960?: unknown };
      const level = protoToBotLevel(req.level);
      const ch = protoToCrazyhouseState(req.crazyhouse)!;
      const side = protoToColor(req.side);
      const config = req.config ? protoToMatchConfig(req.config) : undefined;
      const chess960 = protoToChess960State(req.chess960);
      const drop = selectBotDropMove(req.fen, level, ch, side, config, chess960);
      callback(null, { drop: drop ? dropMoveToProto(drop) : null });
    } catch (err) {
      callback(toGrpcError(err));
    }
  },

  ShouldBotReport(call: Call<unknown>, callback: Callback<unknown>) {
    try {
      const req = call.request as { level: number; violation: unknown };
      const level = protoToBotLevel(req.level);
      const violation = protoToViolationRecord(req.violation);
      if (!violation) {
        callback(null, { should_report: false });
        return;
      }
      const result = shouldBotReport(level, violation);
      callback(null, { should_report: result });
    } catch (err) {
      callback(toGrpcError(err));
    }
  },

  SelectPieceForRemoval(call: Call<unknown>, callback: Callback<unknown>) {
    try {
      const req = call.request as { fen: string; target_side: number; variant_mode?: number };
      const side = protoToColor(req.target_side);
      const variantMode = req.variant_mode ? protoToVariantMode(req.variant_mode) : undefined;
      const square = selectBestPieceForRemoval(req.fen, side, variantMode);
      callback(null, { square: square ?? '' });
    } catch (err) {
      callback(toGrpcError(err));
    }
  },
};

function toGrpcError(err: unknown): { code: number; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  return { code: 13, message };
}
