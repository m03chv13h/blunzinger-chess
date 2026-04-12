/**
 * Atomic Chess rules — pure, stateless functions.
 *
 * This module provides:
 * - Explosion mechanics (capture → blast radius removes pieces)
 * - Atomic legality filtering (kings can't capture, can't explode own king)
 * - Atomic-aware check/non-check move classification
 *
 * Atomic Chess rules enforced:
 * - On any capture, an explosion destroys the capturing piece, captured piece,
 *   and all non-pawn pieces on the 8 surrounding squares
 * - Pawns are immune to adjacency explosions (but not when directly captured)
 * - Kings may never capture (would self-destruct)
 * - A move is illegal if the resulting explosion would destroy the moving side's king
 * - Kings may stand adjacent since kings can never capture each other
 *
 * Zero React or DOM dependencies — designed for server-side reuse.
 */

import { Chess } from 'chess.js';
import type { Move, Color, Square } from './types';
import type { Chess960State } from './chess960';
import { getChess960CastlingMoves } from './chess960';

// ── Constants ────────────────────────────────────────────────────────

const FILES = 'abcdefgh';

/** Relative offsets for the 8 squares surrounding a given square. */
const ADJACENT_OFFSETS: [number, number][] = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

// ── FEN Helpers ──────────────────────────────────────────────────────

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

/**
 * Convert a square (e.g. "e4") to FEN board indices.
 * @returns `[rankIdx, fileIdx]` where rankIdx 0 = rank 8 (top), 7 = rank 1 (bottom).
 */
function squareToIndices(square: Square): [number, number] {
  const file = FILES.indexOf(square[0]);
  const rank = parseInt(square[1], 10);
  const rankIdx = 8 - rank;
  return [rankIdx, file];
}

/**
 * Convert FEN board indices back to a square string.
 * @returns Square string (e.g. "e4"), or null if indices are out of bounds.
 */
function indicesToSquare(rankIdx: number, fileIdx: number): Square | null {
  if (rankIdx < 0 || rankIdx > 7 || fileIdx < 0 || fileIdx > 7) return null;
  const rank = 8 - rankIdx;
  return `${FILES[fileIdx]}${rank}` as Square;
}

// ── Explosion Mechanics ──────────────────────────────────────────────

/** A piece destroyed by an Atomic explosion (for Crazyhouse reserve tracking). */
export interface ExplosionVictim {
  /** Lowercase piece type (p/n/b/r/q). Kings are never included. */
  type: string;
  /** Color of the destroyed piece. */
  color: Color;
}

/**
 * Get the 8 adjacent squares surrounding a capture square.
 *
 * Returns only squares that are within board boundaries (edges/corners
 * will have fewer than 8 neighbors). The capture square itself is NOT
 * included.
 *
 * @param captureSquare - The square where a capture occurred.
 * @returns Array of adjacent squares.
 */
export function getExplosionSquares(captureSquare: Square): Square[] {
  const [rankIdx, fileIdx] = squareToIndices(captureSquare);
  const neighbors: Square[] = [];

  for (const [dr, df] of ADJACENT_OFFSETS) {
    const sq = indicesToSquare(rankIdx + dr, fileIdx + df);
    if (sq) neighbors.push(sq);
  }

  return neighbors;
}

/**
 * Apply an Atomic explosion to a FEN string after chess.js has processed a capture.
 *
 * At this point the capturing piece occupies the destination square (the captured
 * piece is already gone). This function:
 * 1. Removes the capturing piece from the destination square
 * 2. Removes all non-pawn pieces from the 8 adjacent squares
 * 3. Updates castling rights if any rook was destroyed in the explosion
 *
 * All other FEN fields (side to move, en passant, move counters) are preserved.
 *
 * @param fen - FEN after chess.js applied the capture (capturing piece at destination).
 * @param captureSquare - The square where the capture happened.
 * @returns Modified FEN with explosion applied.
 */
export function applyExplosionToFen(fen: string, captureSquare: Square): string {
  const parts = fen.split(' ');
  const ranks = parts[0].split('/');

  // Track rooks destroyed for castling rights updates
  const destroyedRooks: { square: Square; piece: string }[] = [];

  // Helper: remove a piece at the given board indices
  function removePiece(rankIdx: number, fileIdx: number): void {
    const chars = expandFenRank(ranks[rankIdx]);
    const piece = chars[fileIdx];
    if (piece !== '1') {
      const sq = indicesToSquare(rankIdx, fileIdx)!;
      if (piece.toLowerCase() === 'r') {
        destroyedRooks.push({ square: sq, piece });
      }
      chars[fileIdx] = '1';
      ranks[rankIdx] = compressFenRank(chars);
    }
  }

  // 1. Remove the capturing piece from the destination square
  const [captRankIdx, captFileIdx] = squareToIndices(captureSquare);
  removePiece(captRankIdx, captFileIdx);

  // 2. Remove all non-pawn pieces from the 8 adjacent squares
  for (const [dr, df] of ADJACENT_OFFSETS) {
    const nr = captRankIdx + dr;
    const nf = captFileIdx + df;
    if (nr < 0 || nr > 7 || nf < 0 || nf > 7) continue;

    const chars = expandFenRank(ranks[nr]);
    const piece = chars[nf];
    // Skip empty squares and pawns (pawns are immune to adjacency explosions)
    if (piece === '1' || piece === 'p' || piece === 'P') continue;

    removePiece(nr, nf);
  }

  parts[0] = ranks.join('/');

  // 3. Update castling rights if any rook was destroyed
  if (destroyedRooks.length > 0) {
    parts[2] = updateCastlingRightsForDestroyedRooks(parts[2], destroyedRooks);
  }

  return parts.join(' ');
}

/**
 * Get all pieces that will be destroyed by an Atomic explosion.
 *
 * Given the FEN after chess.js has processed the capture (capturing piece
 * occupies the destination square, captured piece is already gone), this
 * returns every piece that the explosion will remove:
 *   1. The capturing piece at the destination square
 *   2. All non-pawn pieces on the 8 adjacent squares
 *
 * Kings are excluded (they cannot end up in a Crazyhouse reserve).
 * The directly captured piece is NOT included (it was already removed by
 * chess.js and should be handled separately via the standard Crazyhouse
 * capture logic).
 *
 * @param fenAfterCapture - FEN after chess.js applied the capture move.
 * @param captureSquare - The square where the capture happened.
 * @returns Array of explosion victims with their piece type and color.
 */
export function getExplosionVictims(
  fenAfterCapture: string,
  captureSquare: Square,
): ExplosionVictim[] {
  const boardPart = fenAfterCapture.split(' ')[0];
  const ranks = boardPart.split('/');
  const victims: ExplosionVictim[] = [];

  // 1. The capturing piece at the destination square
  const [captRankIdx, captFileIdx] = squareToIndices(captureSquare);
  const captChars = expandFenRank(ranks[captRankIdx]);
  const captPiece = captChars[captFileIdx];
  if (captPiece !== '1') {
    const color: Color = captPiece === captPiece.toUpperCase() ? 'w' : 'b';
    const type = captPiece.toLowerCase();
    if (type !== 'k') {
      victims.push({ type, color });
    }
  }

  // 2. Non-pawn pieces on the 8 adjacent squares
  for (const [dr, df] of ADJACENT_OFFSETS) {
    const nr = captRankIdx + dr;
    const nf = captFileIdx + df;
    if (nr < 0 || nr > 7 || nf < 0 || nf > 7) continue;

    const chars = expandFenRank(ranks[nr]);
    const piece = chars[nf];
    // Skip empty squares and pawns (immune to adjacency explosions)
    if (piece === '1' || piece === 'p' || piece === 'P') continue;

    const color: Color = piece === piece.toUpperCase() ? 'w' : 'b';
    const type = piece.toLowerCase();
    if (type !== 'k') {
      victims.push({ type, color });
    }
  }

  return victims;
}

/**
 * Update the FEN castling field after rooks have been destroyed by an explosion.
 *
 * Standard FEN uses K/Q/k/q for castling rights. This removes rights for any
 * rook that was on its home square (a1/h1 for white, a8/h8 for black).
 */
function updateCastlingRightsForDestroyedRooks(
  castlingField: string,
  destroyedRooks: { square: Square; piece: string }[],
): string {
  let result = castlingField;
  for (const { square, piece } of destroyedRooks) {
    if (piece === 'R') {
      // White rook
      if (square === 'h1') result = result.replace('K', '');
      if (square === 'a1') result = result.replace('Q', '');
    } else if (piece === 'r') {
      // Black rook
      if (square === 'h8') result = result.replace('k', '');
      if (square === 'a8') result = result.replace('q', '');
    }
  }
  return result || '-';
}

// ── King Safety ──────────────────────────────────────────────────────

/**
 * Check whether an explosion at the given capture square would affect a king
 * of the specified color.
 *
 * A king is "in the blast radius" if it occupies the capture square itself
 * or any of the 8 adjacent squares.
 *
 * @param fenBeforeCapture - FEN before the capture is applied.
 * @param captureSquare - The square where the capture occurs.
 * @param kingColor - The color of the king to check.
 * @returns True if the king would be in the explosion blast radius.
 */
export function wouldExplodeKing(
  fenBeforeCapture: string,
  captureSquare: Square,
  kingColor: Color,
): boolean {
  const kingChar = kingColor === 'w' ? 'K' : 'k';
  const boardPart = fenBeforeCapture.split(' ')[0];
  const ranks = boardPart.split('/');

  // Check the capture square itself
  const [captRankIdx, captFileIdx] = squareToIndices(captureSquare);
  const captChars = expandFenRank(ranks[captRankIdx]);
  if (captChars[captFileIdx] === kingChar) return true;

  // Check the 8 adjacent squares
  for (const [dr, df] of ADJACENT_OFFSETS) {
    const nr = captRankIdx + dr;
    const nf = captFileIdx + df;
    if (nr < 0 || nr > 7 || nf < 0 || nf > 7) continue;

    const chars = expandFenRank(ranks[nr]);
    if (chars[nf] === kingChar) return true;
  }

  return false;
}

// ── Move Legality ────────────────────────────────────────────────────

/**
 * Check whether a capture from → to is legal under Atomic rules.
 *
 * A capture is illegal if:
 * - The piece at `from` is a king (kings can never capture in Atomic)
 * - The capture would explode the moving side's own king
 *
 * @param fenBeforeMove - FEN before the move is made.
 * @param from - Origin square of the capturing piece.
 * @param to - Destination square (where capture occurs).
 * @param movingSide - The color making the capture.
 * @returns True if the capture is legal under Atomic rules.
 */
export function isAtomicCaptureLegal(
  fenBeforeMove: string,
  from: Square,
  to: Square,
  movingSide: Color,
): boolean {
  // Kings can never capture in Atomic Chess
  const chess = new Chess(fenBeforeMove);
  const piece = chess.get(from);
  if (piece && piece.type === 'k') return false;

  // Check if the explosion would destroy the moving side's own king
  if (wouldExplodeKing(fenBeforeMove, to, movingSide)) return false;

  return true;
}

/**
 * Simple utility to check whether a king of the given color exists in the FEN.
 *
 * @param fen - FEN string to inspect.
 * @param color - The king color to look for.
 * @returns True if a king of that color is present on the board.
 */
export function fenHasKing(fen: string, color: Color): boolean {
  const boardPart = fen.split(' ')[0];
  const kingChar = color === 'w' ? 'K' : 'k';
  return boardPart.includes(kingChar);
}

// ── Move Generation ──────────────────────────────────────────────────

/**
 * Determine whether a chess.js move is a capture.
 * The `flags` field uses 'c' for standard captures and 'e' for en passant.
 */
function isCapture(move: Move): boolean {
  return move.flags.includes('c') || move.flags.includes('e');
}

/**
 * Get all legal moves filtered for Atomic Chess rules.
 *
 * Starting from standard legal moves (including Chess960 castling if applicable),
 * this filters out:
 * - King captures (king moving to a square with an enemy piece)
 * - Any capture that would explode the moving side's own king
 *
 * Non-capture moves (including king moves that don't capture) are kept as-is.
 *
 * @param fen - Current position FEN.
 * @param chess960 - Optional Chess960 state for castling.
 * @returns Array of Atomic-legal moves.
 */
export function getAtomicLegalMoves(fen: string, chess960?: Chess960State | null): Move[] {
  const chess = new Chess(fen);
  const side = chess.turn() as Color;
  const standardMoves = chess.moves({ verbose: true });

  // Add Chess960 castling moves if applicable
  const allMoves = chess960
    ? [...standardMoves, ...getChess960CastlingMoves(fen, chess960)]
    : standardMoves;

  return allMoves.filter((move) => {
    if (!isCapture(move)) return true;

    // Kings can never capture in Atomic
    if (move.piece === 'k') return false;

    // Reject captures that would explode our own king
    if (wouldExplodeKing(fen, move.to, side)) return false;

    return true;
  });
}

// ── Explosion-Aware Check Detection ──────────────────────────────────

/**
 * Check whether a capture move would explode the opponent's king.
 *
 * The opponent's king is destroyed if it sits on the capture square itself
 * or on any of the 8 adjacent squares.
 *
 * @param fenBeforeMove - FEN before the move (side to move makes the capture).
 * @param move - A capture move to test.
 * @returns True if the explosion would destroy the opponent's king.
 */
export function doesAtomicMoveExplodeOpponentKing(
  fenBeforeMove: string,
  move: Move,
): boolean {
  const chess = new Chess(fenBeforeMove);
  const side = chess.turn() as Color;
  const opponentColor: Color = side === 'w' ? 'b' : 'w';

  return wouldExplodeKing(fenBeforeMove, move.to, opponentColor);
}

/**
 * Check whether a move gives check under Atomic rules.
 *
 * For non-capture moves: uses standard chess.js check detection on the post-move FEN.
 *
 * For capture moves:
 * 1. If the explosion kills the opponent's king → true (immediate win).
 * 2. Otherwise, apply the explosion to the post-capture FEN and check if the
 *    resulting position places the opponent in check.
 *
 * @param fenBeforeMove - FEN before the move.
 * @param move - The move to test (must be legal under Atomic rules).
 * @returns True if the move gives check or explodes the opponent's king.
 */
export function doesAtomicMoveGiveCheck(
  fenBeforeMove: string,
  move: Move,
): boolean {
  if (!isCapture(move)) {
    // Non-capture: use the pre-computed after FEN for check detection.
    // This handles both standard moves and Chess960 castling (whose after
    // FEN is set by createCastlingMove and can't be replayed via chess.js).
    try {
      const postChess = new Chess(move.after);
      return postChess.inCheck();
    } catch {
      return false;
    }
  }

  // Capture: check if explosion kills the opponent's king
  const chess = new Chess(fenBeforeMove);
  const side = chess.turn() as Color;
  const opponentColor: Color = side === 'w' ? 'b' : 'w';

  if (wouldExplodeKing(fenBeforeMove, move.to, opponentColor)) {
    return true;
  }

  // Apply explosion to the post-capture FEN and check for standard check
  const postCaptureFen = move.after;
  const postExplosionFen = applyExplosionToFen(postCaptureFen, move.to);

  // Verify the opponent's king still exists after the explosion
  if (!fenHasKing(postExplosionFen, opponentColor)) return true;

  // Test if the remaining pieces give check on the post-explosion board
  try {
    const postChess = new Chess(postExplosionFen);
    return postChess.inCheck();
  } catch {
    // If the FEN is invalid after explosion (e.g. missing king), not a check
    return false;
  }
}

// ── Checking / Non-Checking Move Classification ──────────────────────

/**
 * Get all Atomic-legal moves that give check or explode the opponent's king.
 *
 * A move is considered "checking" if:
 * - It gives standard check on the post-move/post-explosion board, or
 * - It is a capture whose explosion destroys the opponent's king (immediate win)
 *
 * Chess960 castling moves that give check are also included.
 *
 * @param fen - Current position FEN.
 * @param chess960 - Optional Chess960 state for castling.
 * @returns Array of Atomic-legal checking moves.
 */
export function getAtomicCheckingMoves(
  fen: string,
  chess960?: Chess960State | null,
): Move[] {
  return getAtomicLegalMoves(fen, chess960).filter((move) =>
    doesAtomicMoveGiveCheck(fen, move),
  );
}

/**
 * Get all Atomic-legal moves that do NOT give check and do NOT explode
 * the opponent's king.
 *
 * This is the complement of {@link getAtomicCheckingMoves} within
 * {@link getAtomicLegalMoves}.
 *
 * @param fen - Current position FEN.
 * @param chess960 - Optional Chess960 state for castling.
 * @returns Array of Atomic-legal non-checking moves.
 */
export function getAtomicNonCheckingMoves(
  fen: string,
  chess960?: Chess960State | null,
): Move[] {
  return getAtomicLegalMoves(fen, chess960).filter(
    (move) => !doesAtomicMoveGiveCheck(fen, move),
  );
}
