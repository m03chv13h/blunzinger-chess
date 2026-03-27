/**
 * Web Worker for bot move computation.
 *
 * Runs bot move selection off the main thread so the chess clock
 * interval and React renders are never blocked by the search algorithm.
 *
 * The worker receives a single request type that combines regular and
 * drop move selection. It tries a Crazyhouse drop first (if applicable),
 * then falls back to a regular move.
 */

import { selectBotMove, selectBotDropMove } from './botEngine';
import type { Move, BotLevel, MatchConfig, Color, CrazyhouseState, DropMove } from '../core/blunziger/types';

// ── Message types ────────────────────────────────────────────────────

export interface BotActionRequest {
  type: 'selectBotAction';
  id: number;
  fen: string;
  level: BotLevel;
  config?: MatchConfig;
  crazyhouse?: CrazyhouseState;
  side: Color;
}

export type BotActionResult =
  | { kind: 'move'; move: Move }
  | { kind: 'drop'; dropMove: DropMove }
  | null;

export interface BotActionResponse {
  type: 'botActionResult';
  id: number;
  action: BotActionResult;
}

// Worker-scoped `self` typed for message passing (the main tsconfig includes
// the DOM lib, not the WebWorker lib, so we provide a narrow interface).
const workerSelf: {
  onmessage: ((e: MessageEvent<BotActionRequest>) => void) | null;
  postMessage: (msg: BotActionResponse) => void;
} = self as never;

workerSelf.onmessage = (e: MessageEvent<BotActionRequest>) => {
  const msg = e.data;

  // Try Crazyhouse drop first
  if (msg.crazyhouse) {
    const dropMove = selectBotDropMove(
      msg.fen,
      msg.level,
      msg.crazyhouse,
      msg.side,
      msg.config,
    );
    if (dropMove) {
      workerSelf.postMessage({
        type: 'botActionResult',
        id: msg.id,
        action: { kind: 'drop', dropMove },
      });
      return;
    }
  }

  // Regular move
  const move = selectBotMove(msg.fen, msg.level, msg.config);
  workerSelf.postMessage({
    type: 'botActionResult',
    id: msg.id,
    action: move ? { kind: 'move', move } : null,
  });
};
