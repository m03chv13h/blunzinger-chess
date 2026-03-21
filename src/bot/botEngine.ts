import { Chess } from 'chess.js';
import type { Move, BotLevel, MatchConfig, Square } from '../core/blunziger/types';
import { isReverseForcedCheckMode, isKingHuntVariant } from '../core/blunziger/types';
import {
  getLegalMoves,
  getCheckingMoves,
  getNonCheckingMoves,
  isKingOfTheHillEnabled,
  isHillSquare,
} from '../core/blunziger/engine';

// Piece values for heuristic evaluation
const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

/**
 * Select a move for the bot, obeying mode-specific rules.
 *
 * Move-selection priority:
 * 1. Filter moves allowed by the current variant mode
 * 2. Look for immediate winning moves (KOTH hill)
 * 3. Apply mode-specific priorities (King Hunt → prefer checks)
 * 4. Use heuristic/engine selection among remaining candidates
 */
export function selectBotMove(fen: string, level: BotLevel, config?: MatchConfig): Move | null {
  const legalMoves = getLegalMoves(fen);
  if (legalMoves.length === 0) return null;

  let candidateMoves: Move[];

  if (config && isReverseForcedCheckMode(config.variantMode)) {
    // Reverse Blunzinger: bot must avoid checking moves when non-checking exist
    const checkingMoves = getCheckingMoves(fen);
    if (checkingMoves.length > 0) {
      const nonCheckingMoves = getNonCheckingMoves(fen);
      candidateMoves = nonCheckingMoves.length > 0 ? nonCheckingMoves : legalMoves;
    } else {
      candidateMoves = legalMoves;
    }
  } else {
    // Classic / King Hunt variants: bot must pick checking moves when available
    const checkingMoves = getCheckingMoves(fen);
    candidateMoves = checkingMoves.length > 0 ? checkingMoves : legalMoves;
  }

  // King of the Hill: prioritize immediate hill win among candidates
  if (config && isKingOfTheHillEnabled(config)) {
    const hillWinners = candidateMoves.filter((m) => {
      if (m.piece !== 'k') return false;
      return isHillSquare(m.to);
    });
    if (hillWinners.length > 0) {
      return hillWinners[0];
    }
  }

  const kingHunt = config ? isKingHuntVariant(config.variantMode) : false;

  switch (level) {
    case 'easy':
      return selectRandom(candidateMoves);
    case 'medium':
      return selectMedium(candidateMoves, fen, config);
    case 'hard':
      return selectHard(candidateMoves, fen, kingHunt, config);
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
  let bestMove = moves[0];

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
      bestMove = move;
    }
  }

  return bestMove;
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
      return -900; // Last mover won – very bad for the current side to move
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
  const file = (sq as string).charCodeAt(0) - 97; // a=0 … h=7
  const rank = parseInt((sq as string)[1]) - 1;    // 1=0 … 8=7
  const hillCoords = [[3, 3], [3, 4], [4, 3], [4, 4]]; // d4, d5, e4, e5
  let minDist = Infinity;
  for (const [hf, hr] of hillCoords) {
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
