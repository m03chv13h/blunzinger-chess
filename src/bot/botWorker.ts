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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx = self as any;

ctx.onmessage = (e: MessageEvent<BotActionRequest>) => {
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
      ctx.postMessage({
        type: 'botActionResult',
        id: msg.id,
        action: { kind: 'drop', dropMove },
      } satisfies BotActionResponse);
      return;
    }
  }

  // Regular move
  const move = selectBotMove(msg.fen, msg.level, msg.config);
  ctx.postMessage({
    type: 'botActionResult',
    id: msg.id,
    action: move ? { kind: 'move', move } : null,
  } satisfies BotActionResponse);
};
