/**
 * Evaluation gRPC service implementation.
 *
 * Wraps the evaluation system from core/evaluation/ for gRPC consumption.
 */

import type { ServerUnaryCall, sendUnaryData } from '@grpc/grpc-js';
import { evaluateGameState } from '../../../../src/core/evaluation/evaluate.js';
import { createEngineAdapter } from '../../../../src/core/engine/engineRegistry.js';
import type { EngineId } from '../../../../src/core/engine/types.js';
import {
  protoToGameState,
  protoToEngineId,
} from '../mapping.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Call<T> = ServerUnaryCall<T, any>;
type Callback<T> = sendUnaryData<T>;

export const evaluationHandlers = {
  EvaluateGameState(call: Call<unknown>, callback: Callback<unknown>) {
    try {
      const req = call.request as { state: unknown; white_ms: number; black_ms: number };
      const state = protoToGameState(req.state);
      const result = evaluateGameState(state, Number(req.white_ms), Number(req.black_ms));
      callback(null, {
        result: {
          score_cp: result.scoreCp,
          mate_in: result.mateIn,
          favored_side: result.favoredSide,
          normalized_score: result.normalizedScore,
          best_move: result.bestMove,
          best_move_from: result.bestMoveFrom,
          best_move_to: result.bestMoveTo,
          explanation: result.explanation,
        },
      });
    } catch (err) {
      callback(toGrpcError(err));
    }
  },

  async AnalyzePosition(call: Call<unknown>, callback: Callback<unknown>) {
    try {
      const req = call.request as {
        engine_id: number;
        fen: string;
        depth?: number;
        multi_pv?: number;
        variant_key?: string;
      };
      const engineId: EngineId = protoToEngineId(req.engine_id);
      const adapter = createEngineAdapter(engineId);
      await adapter.initialize();
      const lines = await adapter.analyzePosition({
        fen: req.fen,
        depth: req.depth,
        multiPv: req.multi_pv,
        variantKey: req.variant_key,
      });
      adapter.dispose();
      callback(null, {
        lines: lines.map((line) => ({
          best_move: line.bestMove ?? '',
          pv: line.pv ?? [],
          score: {
            score_cp: line.score.scoreCp ?? 0,
            mate_in: line.score.mateIn ?? null,
            favored_side: line.score.favoredSide ?? 'equal',
          },
        })),
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
