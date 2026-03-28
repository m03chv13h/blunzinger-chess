import { Chess } from 'chess.js';
import type { Move, BotLevel, MatchConfig, Square, ViolationRecord, CrazyhouseState, DropMove, Color, Chess960State } from '../core/blunziger/types';
import {
  getLegalMoves,
  getCheckingMoves,
  getNonCheckingMoves,
  getCrazyhouseDropMoves,
  doesDropGiveCheck,
  isKingOfTheHillEnabled,
  isHillSquare,
} from '../core/blunziger/engine';
import { isKingHuntVariant } from '../core/blunziger/types';
import {
  selectBlunznforonMove,
  selectBlunznforonDrop,
  shouldBlunznforonReport,
} from '../core/bots/blunznforon';

/**
 * Determine whether the bot should report an opponent's violation.
 *
 * Hard and medium bots always report. Easy bots may miss violations that are
 * hard to spot — specifically missed-check violations where few checking moves
 * were available. "Gave forbidden check" violations (reverse mode) are always
 * obvious because the bot knows when it is in check.
 */

/** Probability that the easy bot makes a move violation (misses check or gives forbidden check). */
const EASY_BOT_VIOLATION_PROBABILITY = 0.25;

export function shouldBotReport(level: BotLevel, violation: ViolationRecord): boolean {
  return shouldBlunznforonReport(level, violation);
}

// Piece values for heuristic evaluation
const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

// Score for a KOTH win (just below checkmate at -1000)
const KOTH_WIN_SCORE = 900;

// Hill square coordinates as [file, rank] (0-indexed) for proximity calculations
const HILL_COORDINATES = [[3, 3], [3, 4], [4, 3], [4, 4]]; // d4, d5, e4, e5

/**
 * Select a move for the bot, obeying mode-specific rules.
 *
 * Move-selection priority:
 * 1. Filter moves allowed by the current variant mode
 * 2. Look for immediate winning moves (KOTH hill)
 * 3. Apply mode-specific priorities (King Hunt → prefer checks)
 * 4. Use heuristic/engine selection among remaining candidates
 */
export function selectBotMove(fen: string, level: BotLevel, config?: MatchConfig, chess960?: Chess960State | null): Move | null {
  const legalMoves = getLegalMoves(fen, chess960);
  if (legalMoves.length === 0) return null;

  // When config is available, use Blunznforön's variant-aware search
  if (config) {
    const side = (fen.split(' ')[1] ?? 'w') as Color;
    return selectBlunznforonMove(fen, level, config, side, null, undefined, undefined, 0, 0, chess960);
  }

  // Fallback: no config — use simple heuristic selection
  let candidateMoves: Move[];

  // Classic default: prefer checking moves
  const checkingMoves = getCheckingMoves(fen, chess960);
  if (checkingMoves.length > 0) {
    const nonCheckingMoves = level === 'easy' ? getNonCheckingMoves(fen, chess960) : [];
    if (nonCheckingMoves.length > 0 && Math.random() < EASY_BOT_VIOLATION_PROBABILITY) {
      candidateMoves = nonCheckingMoves;
    } else {
      candidateMoves = checkingMoves;
    }
  } else {
    candidateMoves = legalMoves;
  }

  switch (level) {
    case 'easy':
      return selectRandom(candidateMoves);
    case 'medium':
      return selectMedium(candidateMoves, fen, config);
    case 'hard':
      return selectHard(candidateMoves, fen, false, config);
    default:
      return selectRandom(candidateMoves);
  }
}

/**
 * Easy bot: random legal move.
 */
function selectRandom(moves: Move[]): Move {
  return moves[Math.floor(Math.random() * moves.length)];
}

/**
 * Medium bot: simple heuristic - prefer captures, checks, central moves.
 */
function selectMedium(moves: Move[], fen: string, config?: MatchConfig): Move {
  const scored = moves.map((move) => ({
    move,
    score: scoreMove(move, fen, config),
  }));

  scored.sort((a, b) => b.score - a.score);

  // Pick among top moves with some randomness
  const topScore = scored[0].score;
  const topMoves = scored.filter((s) => s.score >= topScore - 1);
  return topMoves[Math.floor(Math.random() * topMoves.length)].move;
}

/**
 * Hard bot: deeper evaluation using minimax.
 */
function selectHard(moves: Move[], fen: string, kingHunt: boolean, config?: MatchConfig): Move {
  const kothEnabled = config ? isKingOfTheHillEnabled(config) : false;
  let bestScore = -Infinity;
  let bestMoves: Move[] = [];

  for (const move of moves) {
    const chess = new Chess(fen);
    chess.move(move.san);
    let score = -minimax(chess, 2, -Infinity, Infinity, false, kothEnabled);
    // King Hunter bonus for checks
    if (kingHunt && chess.inCheck()) {
      score += 3;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMoves = [move];
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
  }

  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

/**
 * Simple minimax with alpha-beta pruning.
 */
function minimax(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  kothEnabled: boolean,
): number {
  // KOTH terminal: the side that just moved may have won by reaching the hill
  if (kothEnabled) {
    const lastMover = chess.turn() === 'w' ? 'b' : 'w';
    if (isKingOnHill(chess, lastMover)) {
      return -KOTH_WIN_SCORE; // Last mover won – very bad for the current side to move
    }
  }

  if (depth === 0 || chess.isGameOver()) {
    return evaluatePosition(chess, kothEnabled);
  }

  const moves = chess.moves({ verbose: true });

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      chess.move(move.san);
      const score = minimax(chess, depth - 1, alpha, beta, false, kothEnabled);
      chess.undo();
      maxEval = Math.max(maxEval, score);
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      chess.move(move.san);
      const score = minimax(chess, depth - 1, alpha, beta, true, kothEnabled);
      chess.undo();
      minEval = Math.min(minEval, score);
      beta = Math.min(beta, score);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

/**
 * Evaluate a position from the perspective of the side to move.
 */
function evaluatePosition(chess: Chess, kothEnabled: boolean): number {
  if (chess.isCheckmate()) {
    return -1000; // Being checkmated is bad
  }
  if (chess.isDraw()) {
    return 0;
  }

  const fen = chess.fen();
  const board = chess.board();
  let score = 0;
  const turn = fen.split(' ')[1];

  for (const row of board) {
    for (const square of row) {
      if (square) {
        const value = PIECE_VALUES[square.type] || 0;
        if (square.color === turn) {
          score += value;
        } else {
          score -= value;
        }
        // KOTH: reward king proximity to the center hill squares
        if (kothEnabled && square.type === 'k') {
          const proximity = hillProximityScore(square.square as Square);
          if (square.color === turn) {
            score += proximity;
          } else {
            score -= proximity;
          }
        }
      }
    }
  }

  return score;
}

/**
 * Check whether a side's king occupies a hill square on the given board.
 */
function isKingOnHill(chess: Chess, side: 'w' | 'b'): boolean {
  for (const row of chess.board()) {
    for (const cell of row) {
      if (cell && cell.type === 'k' && cell.color === side) {
        return isHillSquare(cell.square as Square);
      }
    }
  }
  return false;
}

/**
 * Return a proximity bonus (0-3) for how close the square is to the nearest
 * hill center square (d4, d5, e4, e5).  Uses Chebyshev distance.
 */
function hillProximityScore(sq: Square): number {
  const file = (sq as string).charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = parseInt((sq as string)[1]) - 1;
  let minDist = Infinity;
  for (const [hf, hr] of HILL_COORDINATES) {
    minDist = Math.min(minDist, Math.max(Math.abs(file - hf), Math.abs(rank - hr)));
  }
  return Math.max(0, 3 - minDist);
}

/**
 * Score a move for heuristic ordering.
 */
function scoreMove(move: Move, fen: string, config?: MatchConfig): number {
  let score = 0;

  // King of the Hill: king reaching center is extremely valuable
  if (config && isKingOfTheHillEnabled(config) && move.piece === 'k' && isHillSquare(move.to)) {
    score += 1000;
  }

  // Captures are good
  if (move.captured) {
    score += PIECE_VALUES[move.captured] * 10;
  }

  // Checks are good (especially in King Hunt)
  const chess = new Chess(fen);
  chess.move(move.san);
  if (chess.inCheck()) {
    const kingHunt = config ? isKingHuntVariant(config.variantMode) : false;
    score += kingHunt ? 20 : 5;
  }

  // Central control
  const centralSquares = ['d4', 'd5', 'e4', 'e5'];
  if (centralSquares.includes(move.to)) {
    score += 2;
  }

  // Promotions are great
  if (move.promotion) {
    score += PIECE_VALUES[move.promotion] * 10;
  }

  return score;
}

// ── Crazyhouse bot support ───────────────────────────────────────────

/** Piece values for drop move scoring. */
const DROP_PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
};

/**
 * Select a drop move for the bot (Crazyhouse overlay).
 *
 * Returns a DropMove if the bot decides to drop, or null if it prefers a normal move.
 * The bot considers available drop moves alongside regular moves and may choose
 * a drop when it offers the best outcome.
 *
 * Variant rules apply: in classic mode, if checking drops exist, they are preferred;
 * in reverse mode, checking drops are avoided.
 */
export function selectBotDropMove(
  fen: string,
  level: BotLevel,
  ch: CrazyhouseState,
  side: Color,
  config?: MatchConfig,
  chess960?: Chess960State | null,
): DropMove | null {
  // When config is available, use Blunznforön's variant-aware drop selection
  if (config) {
    return selectBlunznforonDrop(fen, level, config, side, ch, undefined, undefined, 0, 0, chess960);
  }

  // Fallback: no config — use simple heuristic drop selection
  const allDrops = getCrazyhouseDropMoves(fen, ch, side);
  if (allDrops.length === 0) return null;

  if (level === 'easy') {
    if (Math.random() < 0.5) return null;
    return allDrops[Math.floor(Math.random() * allDrops.length)];
  }

  // Medium/Hard: score drops by piece value + check bonus
  let bestDrop: DropMove | null = null;
  let bestScore = -Infinity;

  for (const drop of allDrops) {
    let score = DROP_PIECE_VALUES[drop.piece] ?? 0;

    if (doesDropGiveCheck(fen, side, drop.piece, drop.to)) {
      score += 5;
    }

    const centralSquares = ['d4', 'd5', 'e4', 'e5'];
    if (centralSquares.includes(drop.to)) {
      score += 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestDrop = drop;
    }
  }

  return bestDrop;
}
