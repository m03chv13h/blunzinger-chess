import { Chess } from 'chess.js';
import type { Move, BotLevel, VariantConfig } from '../core/blunziger/types';
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
 * 1. Filter moves allowed by the current mode
 * 2. Look for immediate winning moves (KOTH hill)
 * 3. Apply mode-specific priorities (King Hunter → prefer checks)
 * 4. Use heuristic/engine selection among remaining candidates
 */
export function selectBotMove(fen: string, level: BotLevel, config?: VariantConfig): Move | null {
  const legalMoves = getLegalMoves(fen);
  if (legalMoves.length === 0) return null;

  let candidateMoves: Move[];

  if (config?.reverseForcedCheck) {
    // Reverse Blunziger: bot must avoid checking moves when non-checking exist
    const checkingMoves = getCheckingMoves(fen);
    if (checkingMoves.length > 0) {
      const nonCheckingMoves = getNonCheckingMoves(fen);
      candidateMoves = nonCheckingMoves.length > 0 ? nonCheckingMoves : legalMoves;
    } else {
      candidateMoves = legalMoves;
    }
  } else if (config?.enableBlunziger !== false) {
    // Standard / Double Check Pressure: bot must pick checking moves when available
    const checkingMoves = getCheckingMoves(fen);
    candidateMoves = checkingMoves.length > 0 ? checkingMoves : legalMoves;
  } else {
    candidateMoves = legalMoves;
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

  switch (level) {
    case 'easy':
      return selectRandom(candidateMoves);
    case 'medium':
      return selectMedium(candidateMoves, fen, config);
    case 'hard':
      return selectHard(candidateMoves, fen, config);
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
function selectMedium(moves: Move[], fen: string, config?: VariantConfig): Move {
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
function selectHard(moves: Move[], fen: string, config?: VariantConfig): Move {
  let bestScore = -Infinity;
  let bestMove = moves[0];

  const kingHunter = config?.scoringMode === 'checks_count';

  for (const move of moves) {
    const chess = new Chess(fen);
    chess.move(move.san);
    let score = -minimax(chess, 2, -Infinity, Infinity, false);
    // King Hunter bonus for checks
    if (kingHunter && chess.inCheck()) {
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
): number {
  if (depth === 0 || chess.isGameOver()) {
    return evaluatePosition(chess);
  }

  const moves = chess.moves({ verbose: true });

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      chess.move(move.san);
      const score = minimax(chess, depth - 1, alpha, beta, false);
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
      const score = minimax(chess, depth - 1, alpha, beta, true);
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
function evaluatePosition(chess: Chess): number {
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
      }
    }
  }

  return score;
}

/**
 * Score a move for heuristic ordering.
 */
function scoreMove(move: Move, fen: string, config?: VariantConfig): number {
  let score = 0;

  // King of the Hill: king reaching center is extremely valuable
  if (config && isKingOfTheHillEnabled(config) && move.piece === 'k' && isHillSquare(move.to)) {
    score += 1000;
  }

  // Captures are good
  if (move.captured) {
    score += PIECE_VALUES[move.captured] * 10;
  }

  // Checks are good (especially in King Hunter)
  const chess = new Chess(fen);
  chess.move(move.san);
  if (chess.inCheck()) {
    score += config?.scoringMode === 'checks_count' ? 20 : 5;
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
