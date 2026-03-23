/**
 * Synchronous bot-vs-bot game runner for simulation mode.
 *
 * Runs a complete game without React hooks or timers, producing a GameRecord.
 * Clock features are disabled during simulation to keep execution deterministic.
 */

import type {
  GameState,
  GameSetupConfig,
  MatchConfig,
  Square,
} from './blunziger/types';
import { buildMatchConfig } from './blunziger/types';
import type { GameRecord } from './gameRecord';
import { createGameRecord } from './gameRecord';
import {
  createInitialState,
  applyMoveWithRules,
  canReport,
  reportViolation,
  applyPieceRemoval,
  selectBestPieceForRemoval,
} from './blunziger/engine';
import { selectBotMove, shouldBotReport } from '../bot/botEngine';

/** Maximum number of plies before forcing a draw to prevent infinite games. */
const MAX_PLIES = 600;

export interface SimulationProgress {
  /** Current move count (half-moves played). */
  moveCount: number;
  /** True when the game has finished. */
  finished: boolean;
  /** The final game record, available only when finished. */
  record?: GameRecord;
}

/**
 * Run a single complete bot-vs-bot game synchronously.
 *
 * Returns a GameRecord representing the completed game.
 * The config is forced to botvbot mode with clocks disabled to keep
 * execution deterministic and fast.
 */
export function runSimulatedGame(config: GameSetupConfig): GameRecord {
  const simConfig: GameSetupConfig = {
    ...config,
    mode: 'botvbot',
    enableClock: false,
  };

  const matchConfig: MatchConfig = buildMatchConfig(simConfig);
  let state: GameState = createInitialState(
    'botvbot',
    matchConfig,
    simConfig.botDifficulty,
    simConfig.botSide,
    simConfig.engineIdWhite,
    simConfig.engineIdBlack,
  );

  while (!state.result && state.plyCount < MAX_PLIES) {
    // Handle pending piece removal
    if (state.pendingPieceRemoval) {
      const targetSquare = selectBestPieceForRemoval(
        state.fen,
        state.pendingPieceRemoval.targetSide,
      );
      if (targetSquare) {
        state = applyPieceRemoval(state, targetSquare);
      } else {
        break; // Cannot proceed
      }
      continue;
    }

    // Bot reports violations before making a move
    if (
      canReport(state, state.sideToMove) &&
      state.pendingViolation &&
      shouldBotReport(state.botLevel, state.pendingViolation)
    ) {
      state = reportViolation(state, state.sideToMove);
      if (state.result) break;
      continue;
    }

    const botMove = selectBotMove(state.fen, state.botLevel, state.config);
    if (!botMove) break;

    const newState = applyMoveWithRules(state, {
      from: botMove.from as Square,
      to: botMove.to as Square,
      promotion: botMove.promotion,
    });

    if (newState === state) break; // Move was rejected
    state = newState;
  }

  // If the game didn't end naturally, force a draw
  if (!state.result) {
    state = {
      ...state,
      result: { winner: 'draw', reason: 'draw', detail: 'Simulation ply limit reached' },
    };
  }

  return createGameRecord(
    simConfig,
    state.result!,
    state.fen,
    state.moveHistory.length,
    state.scores,
    state.positionHistory,
    state.moveHistory,
    state.violationReports,
    state.missedChecks,
    state.pieceRemovals,
    state.timeReductions,
  );
}
