import { useState, useCallback } from 'react';
import { Chess } from 'chess.js';
import type { Square, CrazyhousePieceType } from '../core/blunziger/types';
import './Chessboard.css';

const PIECE_UNICODE: Record<string, string> = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

const FEN_PIECE_MAP: Record<string, { type: string; color: 'w' | 'b' }> = {
  K: { type: 'k', color: 'w' }, Q: { type: 'q', color: 'w' },
  R: { type: 'r', color: 'w' }, B: { type: 'b', color: 'w' },
  N: { type: 'n', color: 'w' }, P: { type: 'p', color: 'w' },
  k: { type: 'k', color: 'b' }, q: { type: 'q', color: 'b' },
  r: { type: 'r', color: 'b' }, b: { type: 'b', color: 'b' },
  n: { type: 'n', color: 'b' }, p: { type: 'p', color: 'b' },
};

interface BoardCell {
  type: string;
  color: 'w' | 'b';
  square: string;
}

/**
 * Minimal board interface that mirrors the subset of Chess we use for rendering.
 * Used as a fallback when chess.js rejects a FEN (e.g. Atomic explosion removes a king).
 */
interface BoardView {
  board: () => (BoardCell | null)[][];
  get: (sq: string) => BoardCell | null;
  turn: () => 'w' | 'b';
  lastMove: { from: string; to: string } | null;
}

function parseFenToBoard(fen: string): BoardView {
  const parts = fen.split(' ');
  const rows = parts[0].split('/');
  const activeColor = (parts[1] === 'b' ? 'b' : 'w') as 'w' | 'b';
  const grid: (BoardCell | null)[][] = [];

  for (let r = 0; r < 8; r++) {
    const row: (BoardCell | null)[] = [];
    const rowStr = rows[r] ?? '';
    let col = 0;
    for (const ch of rowStr) {
      if (ch >= '1' && ch <= '8') {
        const empty = parseInt(ch, 10);
        for (let i = 0; i < empty; i++) { row.push(null); col++; }
      } else {
        const mapped = FEN_PIECE_MAP[ch];
        if (mapped) {
          const sq = `${FILES[col]}${8 - r}`;
          row.push({ ...mapped, square: sq });
        } else {
          row.push(null);
        }
        col++;
      }
    }
    while (row.length < 8) row.push(null);
    grid.push(row);
  }

  return {
    board: () => grid,
    get: (sq: string) => {
      const file = sq.charCodeAt(0) - 'a'.charCodeAt(0);
      const rank = 8 - parseInt(sq[1]);
      if (rank < 0 || rank >= 8 || file < 0 || file >= 8) return null;
      return grid[rank][file];
    },
    turn: () => activeColor,
    lastMove: null,
  };
}

function createBoardView(fen: string): BoardView {
  try {
    const chess = new Chess(fen);
    const hist = chess.history({ verbose: true });
    const last = hist.length > 0 ? hist[hist.length - 1] : null;
    return {
      board: () => chess.board(),
      get: (sq: string) => {
        const p = chess.get(sq as Square);
        return p ? { type: p.type, color: p.color, square: sq } : null;
      },
      turn: () => chess.turn(),
      lastMove: last ? { from: last.from, to: last.to } : null,
    };
  } catch {
    return parseFenToBoard(fen);
  }
}

interface ChessboardProps {
  fen: string;
  onMove: (from: Square, to: Square, promotion?: string) => boolean;
  legalMovesFrom: (square: Square) => Square[];
  interactive: boolean;
  flipped?: boolean;
  pendingPieceRemoval?: boolean;
  removableSquares?: Square[];
  onPieceRemoval?: (square: Square) => boolean;
  bestMoveHintFrom?: Square | null;
  bestMoveHintTo?: Square | null;
  /** Crazyhouse: squares where a drop is legal (shown when a reserve piece is selected). */
  dropSquares?: Square[];
  /** Crazyhouse: handler when a drop square is clicked. */
  onDropSquareClick?: (square: Square) => boolean;
  /** Crazyhouse: handler when a reserve piece is dropped onto a square via drag-and-drop. */
  onReserveDrop?: (piece: CrazyhousePieceType, square: Square) => boolean;
}

export function Chessboard({
  fen,
  onMove,
  legalMovesFrom,
  interactive,
  flipped = false,
  pendingPieceRemoval,
  removableSquares,
  onPieceRemoval,
  bestMoveHintFrom,
  bestMoveHintTo,
  dropSquares,
  onDropSquareClick,
  onReserveDrop,
}: ChessboardProps) {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [highlightedMoves, setHighlightedMoves] = useState<Square[]>([]);
  const [promotionData, setPromotionData] = useState<{ from: Square; to: Square } | null>(null);

  const chess = createBoardView(fen);
  const board = chess.board();

  const displayRanks = flipped ? [...RANKS].reverse() : RANKS;
  const displayFiles = flipped ? [...FILES].reverse() : FILES;

  const handleSquareClick = useCallback(
    (square: Square) => {
      if (!interactive) return;
      if (promotionData) return;

      // Handle piece removal selection
      if (pendingPieceRemoval && removableSquares && onPieceRemoval) {
        if (removableSquares.includes(square)) {
          onPieceRemoval(square);
        }
        return;
      }

      // Handle crazyhouse drop
      if (dropSquares && dropSquares.length > 0 && onDropSquareClick) {
        if (dropSquares.includes(square)) {
          onDropSquareClick(square);
          return;
        }
        // Click on non-drop square: fall through to allow normal piece selection
      }

      if (selectedSquare) {
        // Try to make the move
        const piece = chess.get(selectedSquare);
        // Check for promotion
        if (
          piece &&
          piece.type === 'p' &&
          ((piece.color === 'w' && square[1] === '8') ||
            (piece.color === 'b' && square[1] === '1'))
        ) {
          // Check if this is a legal destination
          const targets = legalMovesFrom(selectedSquare);
          if (targets.includes(square)) {
            setPromotionData({ from: selectedSquare, to: square });
            setSelectedSquare(null);
            setHighlightedMoves([]);
            return;
          }
        }

        const success = onMove(selectedSquare, square);
        setSelectedSquare(null);
        setHighlightedMoves([]);
        if (!success) {
          // If click is on own piece, select it instead
          const clickedPiece = chess.get(square);
          if (clickedPiece && clickedPiece.color === chess.turn()) {
            setSelectedSquare(square);
            setHighlightedMoves(legalMovesFrom(square));
          }
        }
      } else {
        const piece = chess.get(square);
        if (piece && piece.color === chess.turn()) {
          setSelectedSquare(square);
          setHighlightedMoves(legalMovesFrom(square));
        }
      }
    },
    [selectedSquare, chess, interactive, onMove, legalMovesFrom, promotionData, pendingPieceRemoval, removableSquares, onPieceRemoval, dropSquares, onDropSquareClick],
  );

  const handlePromotion = useCallback(
    (piece: string) => {
      if (promotionData) {
        onMove(promotionData.from, promotionData.to, piece);
        setPromotionData(null);
      }
    },
    [promotionData, onMove],
  );

  const lastMoveObj = chess.lastMove;

  return (
    <div className="chessboard-wrapper">
      <div className="chessboard" role="grid" aria-label="Chess board">
        {displayRanks.map((rank, ri) =>
          displayFiles.map((file, fi) => {
            const square = `${file}${rank}` as Square;
            const isLight = (ri + fi) % 2 === 0;
            const piece = board[8 - parseInt(rank)][FILES.indexOf(file)];
            const isSelected = selectedSquare === square;
            const isHighlighted = highlightedMoves.includes(square);
            const isLastMove =
              lastMoveObj && (lastMoveObj.from === square || lastMoveObj.to === square);
            const isRemovalTarget = pendingPieceRemoval && removableSquares?.includes(square);
            const isBestMoveHint = square === bestMoveHintFrom || square === bestMoveHintTo;
            const isDropTarget = dropSquares?.includes(square);

            const pieceKey = piece ? `${piece.color}${piece.type.toUpperCase()}` : '';

            return (
              <div
                key={square}
                className={[
                  'square',
                  isLight ? 'light' : 'dark',
                  isSelected ? 'selected' : '',
                  isHighlighted ? 'highlighted' : '',
                  isLastMove ? 'last-move' : '',
                  isRemovalTarget ? 'removal-target' : '',
                  isBestMoveHint ? 'best-move-hint' : '',
                  isDropTarget ? 'drop-target' : '',
                ].join(' ')}
                data-square={square}
                onClick={() => handleSquareClick(square)}
                onDragOver={(e) => {
                  if (isDropTarget) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }
                }}
                onDrop={(e) => {
                  const piece = e.dataTransfer.getData('application/x-crazyhouse-piece');
                  if (piece && onReserveDrop) {
                    e.preventDefault();
                    onReserveDrop(piece as CrazyhousePieceType, square);
                  }
                }}
                role="gridcell"
                aria-label={square}
              >
                {fi === 0 && <span className="rank-label">{rank}</span>}
                {ri === 7 && <span className="file-label">{file}</span>}
                {piece && (
                  <span className={`piece ${piece.color === 'w' ? 'white-piece' : 'black-piece'}`}>
                    {PIECE_UNICODE[pieceKey]}
                  </span>
                )}
                {isHighlighted && !piece && <span className="move-dot" />}
                {isHighlighted && piece && <span className="capture-ring" />}
                {isDropTarget && !piece && <span className="move-dot drop-dot" />}
              </div>
            );
          }),
        )}
      </div>

      {promotionData && (
        <div className="promotion-overlay">
          <div className="promotion-dialog">
            <p>Promote to:</p>
            <div className="promotion-choices">
              {['q', 'r', 'b', 'n'].map((p) => {
                const color = chess.turn() === 'w' ? 'b' : 'w'; // The pawn that promoted was the opposite turn now
                const key = `${color}${p.toUpperCase()}`;
                return (
                  <button
                    key={p}
                    className="promotion-btn"
                    onClick={() => handlePromotion(p)}
                    aria-label={`Promote to ${p}`}
                  >
                    {PIECE_UNICODE[key]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
