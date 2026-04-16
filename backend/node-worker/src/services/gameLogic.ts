/**
 * Game Logic gRPC service implementation.
 *
 * Wraps the pure functions from core/blunziger/engine.ts for gRPC consumption.
 */

import type { ServerUnaryCall, sendUnaryData } from '@grpc/grpc-js';
import {
  createInitialState,
  applyMoveWithRules,
  applyDropMoveWithRules,
  applyPieceRemoval,
  reportViolation,
  canReport,
  applyTimeout,
  getLegalMoves,
  getCheckingMoves,
  getNonCheckingMoves,
  getRemovablePieces,
  getCrazyhouseDropMoves,
} from '../../../../src/core/blunziger/engine.js';
import { buildMatchConfig } from '../../../../src/core/blunziger/types.js';
import {
  protoToGameState,
  gameStateToProto,
  protoToMove,
  moveToProto,
  protoToDropMove,
  dropMoveToProto,
  protoToColor,
  protoToChess960State,
  protoToCrazyhouseState,
  protoToGameSetupConfig,
} from '../mapping.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Call<T> = ServerUnaryCall<T, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Callback<T> = sendUnaryData<T>;

export const gameLogicHandlers = {
  CreateInitialState(call: Call<unknown>, callback: Callback<unknown>) {
    try {
      const setupConfig = protoToGameSetupConfig(call.request);
      const matchConfig = buildMatchConfig(setupConfig);
      const state = createInitialState(
        setupConfig.mode,
        matchConfig,
        setupConfig.botDifficulty,
        setupConfig.botSide,
        setupConfig.engineIdWhite,
        setupConfig.engineIdBlack,
        setupConfig.botDifficultyWhite,
        setupConfig.botDifficultyBlack,
      );
      callback(null, { state: gameStateToProto(state) });
    } catch (err) {
      callback(toGrpcError(err));
    }
  },

  ApplyMoveWithRules(call: Call<unknown>, callback: Callback<unknown>) {
    try {
      const state = protoToGameState((call.request as { state: unknown }).state);
      const move = protoToMove((call.request as { move: unknown }).move);
      const newState = applyMoveWithRules(state, move);
      callback(null, { state: gameStateToProto(newState) });
    } catch (err) {
      callback(toGrpcError(err));
    }
  },

  ApplyDropMoveWithRules(call: Call<unknown>, callback: Callback<unknown>) {
    try {
      const state = protoToGameState((call.request as { state: unknown }).state);
      const drop = protoToDropMove((call.request as { drop: unknown }).drop);
      const newState = applyDropMoveWithRules(state, drop);
      callback(null, { state: gameStateToProto(newState) });
    } catch (err) {
      callback(toGrpcError(err));
    }
  },

  ApplyPieceRemoval(call: Call<unknown>, callback: Callback<unknown>) {
    try {
      const req = call.request as { state: unknown; square: string };
      const state = protoToGameState(req.state);
      const newState = applyPieceRemoval(state, req.square as import('../../../../src/core/blunziger/types.js').Square);
      callback(null, { state: gameStateToProto(newState) });
    } catch (err) {
      callback(toGrpcError(err));
    }
  },

  ReportViolation(call: Call<unknown>, callback: Callback<unknown>) {
    try {
      const req = call.request as { state: unknown; reporting_side: number };
      const state = protoToGameState(req.state);
      const side = protoToColor(req.reporting_side);
      const newState = reportViolation(state, side);
      callback(null, { state: gameStateToProto(newState) });
    } catch (err) {
      callback(toGrpcError(err));
    }
  },

  CanReport(call: Call<unknown>, callback: Callback<unknown>) {
    try {
      const req = call.request as { state: unknown; side: number };
      const state = protoToGameState(req.state);
      const side = protoToColor(req.side);
      const result = canReport(state, side);
      callback(null, { can_report: result });
    } catch (err) {
      callback(toGrpcError(err));
    }
  },

  ApplyTimeout(call: Call<unknown>, callback: Callback<unknown>) {
    try {
      const req = call.request as { state: unknown; losing_side: number };
      const state = protoToGameState(req.state);
      const side = protoToColor(req.losing_side);
      const newState = applyTimeout(state, side);
      callback(null, { state: gameStateToProto(newState) });
    } catch (err) {
      callback(toGrpcError(err));
    }
  },

  GetLegalMoves(call: Call<unknown>, callback: Callback<unknown>) {
    try {
      const req = call.request as { fen: string; chess960?: unknown; atomic: boolean };
      const chess960 = protoToChess960State(req.chess960);
      const moves = getLegalMoves(req.fen, chess960, req.atomic);
      callback(null, { moves: moves.map(moveToProto) });
    } catch (err) {
      callback(toGrpcError(err));
    }
  },

  GetCheckingMoves(call: Call<unknown>, callback: Callback<unknown>) {
    try {
      const req = call.request as { fen: string; chess960?: unknown; atomic: boolean };
      const chess960 = protoToChess960State(req.chess960);
      const moves = getCheckingMoves(req.fen, chess960, req.atomic);
      callback(null, { moves: moves.map(moveToProto) });
    } catch (err) {
      callback(toGrpcError(err));
    }
  },

  GetNonCheckingMoves(call: Call<unknown>, callback: Callback<unknown>) {
    try {
      const req = call.request as { fen: string; chess960?: unknown; atomic: boolean };
      const chess960 = protoToChess960State(req.chess960);
      const moves = getNonCheckingMoves(req.fen, chess960, req.atomic);
      callback(null, { moves: moves.map(moveToProto) });
    } catch (err) {
      callback(toGrpcError(err));
    }
  },

  GetRemovablePieces(call: Call<unknown>, callback: Callback<unknown>) {
    try {
      const req = call.request as { fen: string; side: number };
      const side = protoToColor(req.side);
      const squares = getRemovablePieces(req.fen, side);
      callback(null, { squares });
    } catch (err) {
      callback(toGrpcError(err));
    }
  },

  GetCrazyhouseDropMoves(call: Call<unknown>, callback: Callback<unknown>) {
    try {
      const req = call.request as { fen: string; crazyhouse: unknown; side: number };
      const ch = protoToCrazyhouseState(req.crazyhouse)!;
      const side = protoToColor(req.side);
      const drops = getCrazyhouseDropMoves(req.fen, ch, side);
      callback(null, { drops: drops.map(dropMoveToProto) });
    } catch (err) {
      callback(toGrpcError(err));
    }
  },
};

function toGrpcError(err: unknown): { code: number; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  return { code: 13 /* INTERNAL */, message };
}
