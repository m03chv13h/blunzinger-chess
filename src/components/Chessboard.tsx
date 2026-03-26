import { useState, useCallback } from 'react';
import { Chess } from 'chess.js';
import type { Square } from '../core/blunziger/types';
import './Chessboard.css';

const PIECE_UNICODE: Record<string, string> = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

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
}: ChessboardProps) {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [highlightedMoves, setHighlightedMoves] = useState<Square[]>([]);
  const [promotionData, setPromotionData] = useState<{ from: Square; to: Square } | null>(null);

  const chess = new Chess(fen);
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

  const lastMove = chess.history({ verbose: true });
  const lastMoveObj = lastMove.length > 0 ? lastMove[lastMove.length - 1] : null;

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
