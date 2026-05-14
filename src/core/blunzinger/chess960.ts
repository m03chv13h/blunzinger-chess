/**
 * Chess960 (Fischer Random Chess) starting-position generation and castling support.
 *
 * This module provides:
 * - Deterministic Chess960 position generation from an index (0-959)
 * - Random Chess960 index generation
 * - Chess960 castling move generation and application
 * - Castling state management
 *
 * Chess960 rules enforced:
 * - Bishops on opposite-colored squares
 * - King between the two rooks
 * - White and Black have mirrored back ranks
 * - Pawns on standard starting squares
 */

import { Chess } from 'chess.js';
import type { Move, Color, Square } from './types';

// ── Chess960 State ───────────────────────────────────────────────────

/** Tracks Chess960 castling eligibility across the game. */
export interface Chess960State {
  /** Chess960 position index (0-959). Position 518 = standard chess. */
  positionIndex: number;
  /** Original king file (0-7, same for both sides due to mirroring). */
  kingFile: number;
  /** Original queenside rook file (left of king, smaller index). */
  queenSideRookFile: number;
  /** Original kingside rook file (right of king, larger index). */
  kingSideRookFile: number;
  /** Remaining castling rights. */
  castling: {
    whiteKingSide: boolean;
    whiteQueenSide: boolean;
    blackKingSide: boolean;
    blackQueenSide: boolean;
  };
}

// ── Position Generation ──────────────────────────────────────────────

/**
 * Knight placement table: maps index 0-9 to positions within 5 remaining squares.
 * C(5,2) = 10 combinations.
 */
const KNIGHT_TABLE: [number, number][] = [
  [0, 1], [0, 2], [0, 3], [0, 4],
  [1, 2], [1, 3], [1, 4],
  [2, 3], [2, 4],
  [3, 4],
];

/**
 * Generate the back-rank piece placement for a Chess960 position index.
 *
 * Uses Scharnagl's numbering (SP-ID 0-959):
 * 1. Dark-square bishop (files b, d, f, h)
 * 2. Light-square bishop (files a, c, e, g)
 * 3. Queen on one of 6 remaining squares
 * 4. Two knights placed using C(5,2) encoding
 * 5. Remaining 3 squares filled as Rook-King-Rook (left to right)
 *
 * @param index Chess960 position index (0-959)
 * @returns Array of 8 piece characters (lowercase: r, n, b, q, k)
 */
export function generateChess960BackRank(index: number): string[] {
  if (index < 0 || index > 959) {
    throw new Error(`Chess960 index must be 0-959, got ${index}`);
  }

  let n = index;
  const rank: (string | null)[] = [null, null, null, null, null, null, null, null];

  // 1. Dark-square bishop (files b=1, d=3, f=5, h=7)
  const darkSquares = [1, 3, 5, 7];
  const b1 = n % 4;
  n = Math.floor(n / 4);
  rank[darkSquares[b1]] = 'b';

  // 2. Light-square bishop (files a=0, c=2, e=4, g=6)
  const lightSquares = [0, 2, 4, 6];
  const b2 = n % 4;
  n = Math.floor(n / 4);
  rank[lightSquares[b2]] = 'b';

  // 3. Queen on one of 6 remaining squares
  const q = n % 6;
  n = Math.floor(n / 6);
  const emptyForQueen = rank.map((p, i) => (p === null ? i : -1)).filter((i) => i >= 0);
  rank[emptyForQueen[q]] = 'q';

  // 4. Knights using C(5,2) table
  const kn = n; // 0-9
  const emptyForKnights = rank.map((p, i) => (p === null ? i : -1)).filter((i) => i >= 0);
  const [kn1, kn2] = KNIGHT_TABLE[kn];
  rank[emptyForKnights[kn1]] = 'n';
  rank[emptyForKnights[kn2]] = 'n';

  // 5. Remaining 3 squares: Rook-King-Rook (left to right)
  const emptyFinal = rank.map((p, i) => (p === null ? i : -1)).filter((i) => i >= 0);
  rank[emptyFinal[0]] = 'r';
  rank[emptyFinal[1]] = 'k';
  rank[emptyFinal[2]] = 'r';

  return rank as string[];
}

/**
 * Get the king and rook files from a Chess960 back rank.
 */
export function getChess960PieceFiles(backRank: string[]): {
  kingFile: number;
  queenSideRookFile: number;
  kingSideRookFile: number;
} {
  const kingFile = backRank.indexOf('k');
  const rookFiles = backRank
    .map((p, i) => (p === 'r' ? i : -1))
    .filter((i) => i >= 0);

  return {
    kingFile,
    queenSideRookFile: Math.min(...rookFiles),
    kingSideRookFile: Math.max(...rookFiles),
  };
}

/**
 * Generate a full FEN string for a Chess960 position.
 *
 * Castling rights are set to '-' because chess.js does not support Chess960
 * castling natively. The app tracks castling via Chess960State instead.
 */
export function chess960IndexToFen(index: number): string {
  const backRank = generateChess960BackRank(index);
  const whiteRank = backRank.map((p) => p.toUpperCase()).join('');
  const blackRank = backRank.join('');

  return `${blackRank}/pppppppp/8/8/8/8/PPPPPPPP/${whiteRank} w - - 0 1`;
}

/** Generate a random Chess960 position index (0-959). */
export function getRandomChess960Index(): number {
  return Math.floor(Math.random() * 960);
}

/**
 * Create the initial Chess960 state for a given position index.
 */
export function createChess960State(index: number): Chess960State {
  const backRank = generateChess960BackRank(index);
  const { kingFile, queenSideRookFile, kingSideRookFile } = getChess960PieceFiles(backRank);

  return {
    positionIndex: index,
    kingFile,
    queenSideRookFile,
    kingSideRookFile,
    castling: {
      whiteKingSide: true,
      whiteQueenSide: true,
      blackKingSide: true,
      blackQueenSide: true,
    },
  };
}

// ── FEN Manipulation ─────────────────────────────────────────────────

const FILES = 'abcdefgh';

/** Expand a FEN rank string (e.g. "rnbqkbnr") into 8 individual characters. */
function expandFenRank(rank: string): string[] {
  const result: string[] = [];
  for (const ch of rank) {
    const n = parseInt(ch, 10);
    if (!isNaN(n)) {
      for (let i = 0; i < n; i++) result.push('1');
    } else {
      result.push(ch);
    }
  }
  return result;
}

/** Compress an 8-char rank array back to FEN rank notation. */
function compressFenRank(chars: string[]): string {
  let result = '';
  let emptyCount = 0;
  for (const ch of chars) {
    if (ch === '1') {
      emptyCount++;
    } else {
      if (emptyCount > 0) {
        result += String(emptyCount);
        emptyCount = 0;
      }
      result += ch;
    }
  }
  if (emptyCount > 0) result += String(emptyCount);
  return result;
}

// ── Castling Move Generation ─────────────────────────────────────────

/**
 * Check whether a specific square is attacked by the given color.
 */
function isSquareAttacked(fen: string, square: Square, byColor: Color): boolean {
  const chess = new Chess(fen);
  return chess.isAttacked(square, byColor);
}

/**
 * Get the FEN rank index (0-7, top to bottom) for a color.
 */
function backRankIndex(side: Color): number {
  return side === 'w' ? 7 : 0;
}

/** Get the back rank number ('1' for white, '8' for black). */
function backRankNumber(side: Color): string {
  return side === 'w' ? '1' : '8';
}

/**
 * Generate legal Chess960 castling moves for the given position.
 *
 * A castling move is legal when:
 * 1. The king and the relevant rook have not moved
 * 2. All squares between the king's start and target (inclusive) are vacant
 *    or occupied only by the castling king/rook
 * 3. All squares between the rook's start and target (inclusive) are vacant
 *    or occupied only by the castling king/rook
 * 4. The king does not start in check
 * 5. The king does not pass through or land on a square attacked by the opponent
 */
export function getChess960CastlingMoves(
  fen: string,
  state: Chess960State,
): Move[] {
  const moves: Move[] = [];
  const chess = new Chess(fen);
  const side = chess.turn() as Color;
  const opponent: Color = side === 'w' ? 'b' : 'w';
  const rankNum = backRankNumber(side);

  const canKingSide = side === 'w' ? state.castling.whiteKingSide : state.castling.blackKingSide;
  const canQueenSide = side === 'w' ? state.castling.whiteQueenSide : state.castling.blackQueenSide;

  if (!canKingSide && !canQueenSide) return moves;

  const kingFrom = state.kingFile;
  const kingFromSq = `${FILES[kingFrom]}${rankNum}` as Square;

  // King must not be in check
  if (isSquareAttacked(fen, kingFromSq, opponent)) return moves;

  // Parse the board to check occupancy
  const parts = fen.split(' ');
  const ranks = parts[0].split('/');
  const rankIdx = backRankIndex(side);
  const rankChars = expandFenRank(ranks[rankIdx]);

  // Helper: check if a square on the back rank is empty or is one of the castling pieces
  function isVacantOrCastling(file: number, castlingKingFile: number, castlingRookFile: number): boolean {
    if (file === castlingKingFile || file === castlingRookFile) return true;
    return rankChars[file] === '1';
  }

  // Kingside castling: king → g-file (6), rook → f-file (5)
  if (canKingSide) {
    const rookFrom = state.kingSideRookFile;
    const rookFromSq = `${FILES[rookFrom]}${rankNum}` as Square;
    const kingTarget = 6; // g-file
    const rookTarget = 5; // f-file

    // Verify rook is still at its original square
    const rookPiece = chess.get(rookFromSq);
    const rookPresent = rookPiece && rookPiece.type === 'r' && rookPiece.color === side;

    if (rookPresent) {
      // Check all squares between king start/target and rook start/target are vacant
      const minFile = Math.min(kingFrom, kingTarget, rookFrom, rookTarget);
      const maxFile = Math.max(kingFrom, kingTarget, rookFrom, rookTarget);
      let pathClear = true;
      for (let f = minFile; f <= maxFile; f++) {
        if (!isVacantOrCastling(f, kingFrom, rookFrom)) {
          pathClear = false;
          break;
        }
      }

      // King must not pass through or land on attacked square
      if (pathClear) {
        const kingMinFile = Math.min(kingFrom, kingTarget);
        const kingMaxFile = Math.max(kingFrom, kingTarget);
        let kingPathSafe = true;
        for (let f = kingMinFile; f <= kingMaxFile; f++) {
          const sq = `${FILES[f]}${rankNum}` as Square;
          if (isSquareAttacked(fen, sq, opponent)) {
            kingPathSafe = false;
            break;
          }
        }

        if (kingPathSafe) {
          const kingToSq = `${FILES[kingTarget]}${rankNum}` as Square;
          const afterFen = applyCastleToFen(fen, side, kingFrom, rookFrom, kingTarget, rookTarget);
          moves.push(createCastlingMove(fen, afterFen, side, kingFromSq, kingToSq, true));
        }
      }
    }
  }

  // Queenside castling: king → c-file (2), rook → d-file (3)
  if (canQueenSide) {
    const rookFrom = state.queenSideRookFile;
    const rookFromSq = `${FILES[rookFrom]}${rankNum}` as Square;
    const kingTarget = 2; // c-file
    const rookTarget = 3; // d-file

    // Verify rook is still at its original square
    const rookPiece = chess.get(rookFromSq);
    const rookPresent = rookPiece && rookPiece.type === 'r' && rookPiece.color === side;

    if (rookPresent) {
      const minFile = Math.min(kingFrom, kingTarget, rookFrom, rookTarget);
      const maxFile = Math.max(kingFrom, kingTarget, rookFrom, rookTarget);
      let pathClear = true;
      for (let f = minFile; f <= maxFile; f++) {
        if (!isVacantOrCastling(f, kingFrom, rookFrom)) {
          pathClear = false;
          break;
        }
      }

      if (pathClear) {
        const kingMinFile = Math.min(kingFrom, kingTarget);
        const kingMaxFile = Math.max(kingFrom, kingTarget);
        let kingPathSafe = true;
        for (let f = kingMinFile; f <= kingMaxFile; f++) {
          const sq = `${FILES[f]}${rankNum}` as Square;
          if (isSquareAttacked(fen, sq, opponent)) {
            kingPathSafe = false;
            break;
          }
        }

        if (kingPathSafe) {
          const kingToSq = `${FILES[kingTarget]}${rankNum}` as Square;
          const afterFen = applyCastleToFen(fen, side, kingFrom, rookFrom, kingTarget, rookTarget);
          moves.push(createCastlingMove(fen, afterFen, side, kingFromSq, kingToSq, false));
        }
      }
    }
  }

  return moves;
}

/**
 * Apply a castling operation to a FEN string (pure function).
 * Moves king and rook to their target files and switches the side to move.
 */
function applyCastleToFen(
  fen: string,
  side: Color,
  kingFromFile: number,
  rookFromFile: number,
  kingTargetFile: number,
  rookTargetFile: number,
): string {
  const parts = fen.split(' ');
  const ranks = parts[0].split('/');
  const rankIdx = backRankIndex(side);
  const rankChars = expandFenRank(ranks[rankIdx]);

  // Clear king and rook from their original positions
  rankChars[kingFromFile] = '1';
  rankChars[rookFromFile] = '1';

  // Place king and rook at their target positions
  rankChars[kingTargetFile] = side === 'w' ? 'K' : 'k';
  rankChars[rookTargetFile] = side === 'w' ? 'R' : 'r';

  ranks[rankIdx] = compressFenRank(rankChars);
  parts[0] = ranks.join('/');

  // Switch side to move
  parts[1] = side === 'w' ? 'b' : 'w';

  // Clear en passant
  parts[3] = '-';

  // Increment half-move clock
  parts[4] = String(parseInt(parts[4], 10) + 1);

  // Increment full-move number after black's move
  if (side === 'b') {
    parts[5] = String(parseInt(parts[5], 10) + 1);
  }

  return parts.join(' ');
}

/**
 * Create a Move object for a castling operation.
 */
function createCastlingMove(
  beforeFen: string,
  afterFen: string,
  side: Color,
  from: Square,
  to: Square,
  kingSide: boolean,
): Move {
  const san = kingSide ? 'O-O' : 'O-O-O';
  return {
    color: side,
    from,
    to,
    piece: 'k',
    flags: kingSide ? 'k' : 'q',
    san,
    lan: `${from}${to}`,
    before: beforeFen,
    after: afterFen,
  } as Move;
}

// ── Castling State Updates ───────────────────────────────────────────

/**
 * Update Chess960 castling state after a regular move.
 *
 * Castling rights are lost when:
 * - The king moves from its original square
 * - A rook moves from its original square
 * - A rook is captured on its original square
 */
export function updateChess960CastlingState(
  state: Chess960State,
  side: Color,
  from: Square,
  to: Square,
  captured: boolean,
): Chess960State {
  const whiteRank = '1';
  const blackRank = '8';
  const newCastling = { ...state.castling };
  let changed = false;

  // Check if the moving piece is a king or rook from its original square
  const fromFile = FILES.indexOf(from[0]);
  const fromRank = from[1];

  // King moved
  if (fromFile === state.kingFile) {
    if (fromRank === whiteRank && side === 'w') {
      if (newCastling.whiteKingSide || newCastling.whiteQueenSide) {
        newCastling.whiteKingSide = false;
        newCastling.whiteQueenSide = false;
        changed = true;
      }
    }
    if (fromRank === blackRank && side === 'b') {
      if (newCastling.blackKingSide || newCastling.blackQueenSide) {
        newCastling.blackKingSide = false;
        newCastling.blackQueenSide = false;
        changed = true;
      }
    }
  }

  // Rook moved from original square
  if (fromFile === state.kingSideRookFile) {
    if (fromRank === whiteRank && side === 'w' && newCastling.whiteKingSide) {
      newCastling.whiteKingSide = false;
      changed = true;
    }
    if (fromRank === blackRank && side === 'b' && newCastling.blackKingSide) {
      newCastling.blackKingSide = false;
      changed = true;
    }
  }
  if (fromFile === state.queenSideRookFile) {
    if (fromRank === whiteRank && side === 'w' && newCastling.whiteQueenSide) {
      newCastling.whiteQueenSide = false;
      changed = true;
    }
    if (fromRank === blackRank && side === 'b' && newCastling.blackQueenSide) {
      newCastling.blackQueenSide = false;
      changed = true;
    }
  }

  // Rook captured on original square (opponent's rook)
  if (captured) {
    const toFile = FILES.indexOf(to[0]);
    const toRank = to[1];
    const capturedSide: Color = side === 'w' ? 'b' : 'w';

    if (toFile === state.kingSideRookFile) {
      if (toRank === whiteRank && capturedSide === 'w' && newCastling.whiteKingSide) {
        newCastling.whiteKingSide = false;
        changed = true;
      }
      if (toRank === blackRank && capturedSide === 'b' && newCastling.blackKingSide) {
        newCastling.blackKingSide = false;
        changed = true;
      }
    }
    if (toFile === state.queenSideRookFile) {
      if (toRank === whiteRank && capturedSide === 'w' && newCastling.whiteQueenSide) {
        newCastling.whiteQueenSide = false;
        changed = true;
      }
      if (toRank === blackRank && capturedSide === 'b' && newCastling.blackQueenSide) {
        newCastling.blackQueenSide = false;
        changed = true;
      }
    }
  }

  return changed ? { ...state, castling: newCastling } : state;
}

/**
 * Update Chess960 castling state after castling is performed.
 * Removes both castling rights for the side that castled.
 */
export function updateChess960StateAfterCastle(
  state: Chess960State,
  side: Color,
): Chess960State {
  const newCastling = { ...state.castling };
  if (side === 'w') {
    newCastling.whiteKingSide = false;
    newCastling.whiteQueenSide = false;
  } else {
    newCastling.blackKingSide = false;
    newCastling.blackQueenSide = false;
  }
  return { ...state, castling: newCastling };
}

// ── Castling Move Detection ──────────────────────────────────────────

/**
 * Identify whether a from/to pair represents a Chess960 castling move.
 * Returns the castling type ('kingSide' | 'queenSide') or null if not castling.
 */
export function identifyChess960Castling(
  chess960: Chess960State,
  side: Color,
  from: Square,
  to: Square,
): 'kingSide' | 'queenSide' | null {
  const rankNum = backRankNumber(side);
  const fromFile = FILES.indexOf(from[0]);
  const toFile = FILES.indexOf(to[0]);

  // The "from" square must be the king's original square on the correct rank
  if (fromFile !== chess960.kingFile || from[1] !== rankNum) return null;

  // Both from and to must be on the same (back) rank for castling
  if (to[1] !== rankNum) return null;

  // Kingside: king moves to g-file
  if (toFile === 6) return 'kingSide';
  // Queenside: king moves to c-file
  if (toFile === 2) return 'queenSide';

  return null;
}

/**
 * Check whether a Chess960 castling move gives check to the opponent.
 */
export function doesCastlingGiveCheck(afterFen: string): boolean {
  const chess = new Chess(afterFen);
  return chess.inCheck();
}
