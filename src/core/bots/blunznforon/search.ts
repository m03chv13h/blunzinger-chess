/**
 * Blunznforön bot — negamax search with alpha-beta pruning.
 *
 * Implements a proper search algorithm:
 * - Negamax framework (simplifies minimax for two-player zero-sum games)
 * - Alpha-beta pruning for efficient tree traversal
 * - Quiescence search for tactical positions (captures/checks at leaf nodes)
 * - Move ordering for better pruning
 * - Tactical extensions (extend search in check positions)
 */

import { Chess } from 'chess.js';
import type { Move, Color, DropMove } from '../../blunziger/types';
import { isHillSquare, applyDropToFen } from '../../blunziger/engine';
import { evaluatePosition, evaluatePositionFull } from './evaluate';
import { orderMoves } from './moveOrdering';
import { MATE_SCORE, KOTH_WIN_SCORE } from './tactical';
import type { SearchContext, ScoredMove, ScoredDrop, BlunznforonConfig } from './types';
import { evaluateDropMove } from './crazyhouse';

// ── Search engine ────────────────────────────────────────────────────

/**
 * Run negamax search on regular moves.
 *
 * Returns scored moves sorted by quality (best first).
 */
export function searchMoves(
  fen: string,
  moves: Move[],
  config: BlunznforonConfig,
  ctx: SearchContext,
  whiteMs: number,
  blackMs: number,
): ScoredMove[] {
  const perspective = (fen.split(' ')[1] ?? 'w') as Color;
  const orderedMoves = orderMoves(moves, fen, ctx.config);

  const scored: ScoredMove[] = [];

  let alpha = -Infinity;
  const beta = Infinity;

  for (const move of orderedMoves) {
    const chess = new Chess(fen);
    try {
      chess.move(move.san);
    } catch {
      continue; // Skip invalid moves
    }

    // Check for immediate wins
    if (chess.isCheckmate()) {
      scored.push({ move, score: MATE_SCORE });
      continue;
    }

    if (ctx.kothEnabled && move.piece === 'k' && isHillSquare(move.to)) {
      scored.push({ move, score: KOTH_WIN_SCORE });
      continue;
    }

    // Negamax search
    const resultFen = chess.fen();
    const depth = config.searchDepth - 1;

    let score: number;
    if (depth <= 0) {
      // Depth 1 (easy/fast): just evaluate the resulting position
      score = -evaluatePositionFull(resultFen, oppositeColor(perspective), ctx, whiteMs, blackMs);
    } else {
      // Tactical extension: extend by 1 ply when in check
      const extension = config.useTacticalExtensions && chess.inCheck() ? 1 : 0;

      score = -negamax(
        resultFen,
        depth + extension,
        -beta,
        -alpha,
        oppositeColor(perspective),
        perspective,
        ctx,
        config,
        whiteMs,
        blackMs,
      );
    }

    scored.push({ move, score });

    if (score > alpha) {
      alpha = score;
    }
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/**
 * Score drop moves using shallow evaluation.
 * Drops don't go through the full negamax tree (too expensive with many drop targets)
 * but get a good heuristic score plus optional 1-ply lookahead.
 */
export function searchDropMoves(
  fen: string,
  drops: DropMove[],
  config: BlunznforonConfig,
  ctx: SearchContext,
  whiteMs: number,
  blackMs: number,
): ScoredDrop[] {
  const perspective = (fen.split(' ')[1] ?? 'w') as Color;

  const scored: ScoredDrop[] = drops.map((drop) => {
    let score = evaluateDropMove(fen, drop, ctx.config);

    // For deeper search, do a 1-ply negamax on the resulting position
    if (config.searchDepth >= 2) {
      try {
        const resultFen = applyDropToFen(fen, drop.color, drop.piece, drop.to);
        const chess = new Chess(resultFen);

        if (chess.isCheckmate()) {
          return { drop, score: MATE_SCORE };
        }

        const evalScore = -negamax(
          resultFen,
          1,
          -Infinity,
          Infinity,
          oppositeColor(perspective),
          perspective,
          ctx,
          config,
          whiteMs,
          blackMs,
        );
        score += evalScore * 0.3; // Blend heuristic and search scores
      } catch {
        // Skip if FEN construction fails
      }
    }

    return { drop, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

// ── Negamax with alpha-beta ──────────────────────────────────────────

/**
 * Negamax search with alpha-beta pruning.
 *
 * Returns the score from the perspective of `perspective` (not necessarily
 * the current side to move — we negate at each level).
 *
 * @param fen Current position
 * @param depth Remaining search depth
 * @param alpha Lower bound
 * @param beta Upper bound
 * @param sideToMove Current side to move
 * @param perspective Original searching side
 * @param ctx Search context with variant info
 * @param config Search configuration
 */
function negamax(
  fen: string,
  depth: number,
  alpha: number,
  beta: number,
  sideToMove: Color,
  perspective: Color,
  ctx: SearchContext,
  config: BlunznforonConfig,
  whiteMs: number,
  blackMs: number,
): number {
  // Terminal / leaf node
  if (depth <= 0) {
    if (config.quiescenceDepth > 0) {
      return quiescence(fen, config.quiescenceDepth, alpha, beta, sideToMove, perspective, ctx, whiteMs, blackMs);
    }
    return evaluatePosition(fen, sideToMove, ctx, whiteMs, blackMs);
  }

  const chess = new Chess(fen);

  // Check for KOTH win by the side that just moved
  if (ctx.kothEnabled) {
    const lastMover = oppositeColor(sideToMove);
    if (isKingOnHill(chess, lastMover)) {
      // Last mover won — bad for current side to move
      return -KOTH_WIN_SCORE;
    }
  }

  if (chess.isCheckmate()) {
    return -MATE_SCORE + (config.searchDepth - depth); // Prefer faster mates
  }
  if (chess.isStalemate() || chess.isDraw()) {
    return 0;
  }

  const moves = chess.moves({ verbose: true }) as Move[];
  if (moves.length === 0) return 0;

  const orderedMoves = orderMoves(moves, fen, ctx.config);

  let bestScore = -Infinity;

  for (const move of orderedMoves) {
    chess.move(move.san);
    const newFen = chess.fen();

    // Tactical extension
    const extension = config.useTacticalExtensions && chess.inCheck() ? 1 : 0;

    const score = -negamax(
      newFen,
      depth - 1 + extension,
      -beta,
      -alpha,
      oppositeColor(sideToMove),
      perspective,
      ctx,
      config,
      whiteMs,
      blackMs,
    );

    chess.undo();

    if (score > bestScore) {
      bestScore = score;
    }
    if (score > alpha) {
      alpha = score;
    }
    if (alpha >= beta) {
      break; // Beta cutoff
    }
  }

  return bestScore;
}

// ── Quiescence search ────────────────────────────────────────────────

/**
 * Quiescence search: continue searching captures and checks at leaf nodes
 * to avoid the horizon effect (evaluating unstable tactical positions).
 *
 * Uses fail-soft returns so that scores propagated back to the root search
 * reflect actual position evaluations rather than alpha/beta bounds.  This
 * prevents all root moves from collapsing to the same bounded value when
 * the stand-pat evaluation exceeds the search window.
 */
function quiescence(
  fen: string,
  depth: number,
  alpha: number,
  beta: number,
  sideToMove: Color,
  perspective: Color,
  ctx: SearchContext,
  whiteMs: number,
  blackMs: number,
): number {
  const standPat = evaluatePosition(fen, sideToMove, ctx, whiteMs, blackMs);

  if (depth <= 0) return standPat;

  if (standPat >= beta) return standPat;
  if (standPat > alpha) alpha = standPat;

  const chess = new Chess(fen);
  if (chess.isGameOver()) return standPat;

  // Only search captures and checks (tactical moves)
  const moves = chess.moves({ verbose: true }) as Move[];
  const tacticalMoves = moves.filter((m) => {
    if (m.captured) return true;
    // Check if move gives check
    chess.move(m.san);
    const givesCheck = chess.inCheck();
    chess.undo();
    return givesCheck;
  });

  if (tacticalMoves.length === 0) return standPat;

  let bestScore = standPat;

  for (const move of tacticalMoves) {
    chess.move(move.san);
    const score = -quiescence(
      chess.fen(),
      depth - 1,
      -beta,
      -alpha,
      oppositeColor(sideToMove),
      perspective,
      ctx,
      whiteMs,
      blackMs,
    );
    chess.undo();

    if (score > bestScore) bestScore = score;
    if (score >= beta) return bestScore;
    if (score > alpha) alpha = score;
  }

  return bestScore;
}

// ── Helpers ──────────────────────────────────────────────────────────

function oppositeColor(c: Color): Color {
  return c === 'w' ? 'b' : 'w';
}

function isKingOnHill(chess: Chess, side: Color): boolean {
  for (const row of chess.board()) {
    for (const cell of row) {
      if (cell && cell.type === 'k' && cell.color === side) {
        return isHillSquare(cell.square);
      }
    }
  }
  return false;
}
