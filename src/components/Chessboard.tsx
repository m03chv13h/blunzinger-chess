import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Chess } from 'chess.js';
import type { Square, Color, CrazyhousePieceType } from '../core/blunziger/types';
import type { PreMove } from '../hooks/usePreMoves';
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
      if (col >= 8) break;
      if (ch >= '1' && ch <= '8') {
        const empty = parseInt(ch, 10);
        for (let i = 0; i < empty && col < 8; i++) { row.push(null); col++; }
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
      if (!sq || sq.length < 2) return null;
      const file = sq.charCodeAt(0) - 'a'.charCodeAt(0);
      const rank = 8 - parseInt(sq[1]);
      if (isNaN(rank) || rank < 0 || rank >= 8 || file < 0 || file >= 8) return null;
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

/** Describes the most recent move for slide animation. */
export interface MoveAnimationInfo {
  from: Square;
  to: Square;
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
  /** Last move info for slide animation (from/to). */
  moveAnimation?: MoveAnimationInfo | null;
  /** Crazyhouse: square where a piece was just dropped (triggers drop-in animation). */
  dropAnimation?: Square | null;
  /** Atomic: squares affected by the last explosion (triggers explosion animation). */
  explosionSquares?: Square[];
  /** Premove: squares involved in queued premoves (highlighted distinctly). */
  premoveSquares?: Square[];
  /** Premove: the player's color — enables premove piece selection when not that player's turn. */
  premoveColor?: Color;
  /** Premove: callback to queue a premove (from, to, promotion). */
  onPreMove?: (from: Square, to: Square, promotion?: string) => void;
  /** Premove: full premove queue for showing ghost pieces at destinations. */
  preMoves?: PreMove[];
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
  moveAnimation,
  dropAnimation,
  explosionSquares,
  premoveSquares,
  premoveColor,
  onPreMove,
  preMoves,
}: ChessboardProps) {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [highlightedMoves, setHighlightedMoves] = useState<Square[]>([]);
  const [promotionData, setPromotionData] = useState<{ from: Square; to: Square } | null>(null);

  // ── Animation state ──
  // Track a generation counter to re-trigger CSS animations when the same
  // move type occurs consecutively on the same square.
  const animGenRef = useRef(0);
  const prevMoveRef = useRef<MoveAnimationInfo | null | undefined>(undefined);
  const prevDropRef = useRef<Square | null | undefined>(undefined);
  const prevExplosionRef = useRef<Square[] | undefined>(undefined);

  if (
    moveAnimation !== prevMoveRef.current ||
    dropAnimation !== prevDropRef.current ||
    explosionSquares !== prevExplosionRef.current
  ) {
    animGenRef.current += 1;
    prevMoveRef.current = moveAnimation;
    prevDropRef.current = dropAnimation;
    prevExplosionRef.current = explosionSquares;
  }

  // Active explosion squares (cleared after animation duration)
  const [activeExplosion, setActiveExplosion] = useState<Square[]>([]);
  const explosionGenRef = useRef(0);

  useEffect(() => {
    if (explosionSquares && explosionSquares.length > 0) {
      setActiveExplosion(explosionSquares);
      const gen = ++explosionGenRef.current;
      const timer = setTimeout(() => {
        if (explosionGenRef.current === gen) setActiveExplosion([]);
      }, 400);
      return () => clearTimeout(timer);
    } else {
      setActiveExplosion([]);
    }
  }, [explosionSquares]);

  const chess = createBoardView(fen);
  const board = chess.board();

  // ── Premove ghost pieces ──
  // Compute a map of squares to ghost pieces (pieces shown at premove destinations)
  // and a set of squares where original pieces should be dimmed (premove sources).
  const premoveGhosts = useMemo(() => {
    if (!preMoves || preMoves.length === 0) return { ghosts: new Map<string, string>(), dimmed: new Set<string>() };

    const ghosts = new Map<string, string>(); // square → pieceKey (e.g. "wN")
    const dimmed = new Set<string>(); // squares whose pieces are "leaving"

    // Track piece positions through the premove chain
    // pieceAt: maps square → pieceKey after applying premoves sequentially
    const pieceAt = new Map<string, string>();

    for (const pm of preMoves) {
      // Determine what piece is at the "from" square considering previous premoves in chain
      let pieceKey: string | undefined;
      if (pieceAt.has(pm.from)) {
        pieceKey = pieceAt.get(pm.from)!;
        pieceAt.delete(pm.from);
      } else {
        // Look up from the actual board
        const file = pm.from.charCodeAt(0) - 'a'.charCodeAt(0);
        const rank = 8 - parseInt(pm.from[1]);
        if (rank >= 0 && rank < 8 && file >= 0 && file < 8) {
          const cell = board[rank][file];
          if (cell) {
            pieceKey = `${cell.color}${cell.type.toUpperCase()}`;
          }
        }
      }

      if (pieceKey) {
        // Handle promotion: override the piece type
        if (pm.promotion) {
          const color = pieceKey[0];
          pieceKey = `${color}${pm.promotion.toUpperCase()}`;
        }
        pieceAt.set(pm.to, pieceKey);
        dimmed.add(pm.from);
      }
    }

    // Convert final positions to ghosts map
    for (const [sq, pk] of pieceAt) {
      ghosts.set(sq, pk);
    }

    return { ghosts, dimmed };
  }, [preMoves, board]);

  const displayRanks = flipped ? [...RANKS].reverse() : RANKS;
  const displayFiles = flipped ? [...FILES].reverse() : FILES;

  const handleSquareClick = useCallback(
    (square: Square) => {
      if (promotionData) return;

      // Premove mode: when board is not interactive but premove is enabled
      const canQueuePremove = !interactive && !!premoveColor && !!onPreMove;
      if (!interactive && !canQueuePremove) return;

      // Handle piece removal selection (normal mode only)
      if (interactive && pendingPieceRemoval && removableSquares && onPieceRemoval) {
        if (removableSquares.includes(square)) {
          onPieceRemoval(square);
        }
        return;
      }

      // Handle crazyhouse drop (normal mode only)
      if (interactive && dropSquares && dropSquares.length > 0 && onDropSquareClick) {
        if (dropSquares.includes(square)) {
          onDropSquareClick(square);
          return;
        }
        // Click on non-drop square: fall through to allow normal piece selection
      }

      if (canQueuePremove) {
        // Premove interaction
        if (selectedSquare) {
          const piece = chess.get(selectedSquare);
          // Check for pawn promotion premove
          if (
            piece &&
            piece.type === 'p' &&
            ((piece.color === 'w' && square[1] === '8') ||
              (piece.color === 'b' && square[1] === '1'))
          ) {
            setPromotionData({ from: selectedSquare, to: square });
            setSelectedSquare(null);
            setHighlightedMoves([]);
            return;
          }
          // Queue the premove
          onPreMove(selectedSquare, square);
          setSelectedSquare(null);
          setHighlightedMoves([]);
          // If clicked on own piece, re-select it for the next premove
          const clickedPiece = chess.get(square);
          if (clickedPiece && clickedPiece.color === premoveColor && square !== selectedSquare) {
            setSelectedSquare(square);
          }
        } else {
          const piece = chess.get(square);
          if (piece && piece.color === premoveColor) {
            setSelectedSquare(square);
            setHighlightedMoves([]);
          }
        }
        return;
      }

      // Normal interactive mode
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
    [selectedSquare, chess, interactive, onMove, legalMovesFrom, promotionData, pendingPieceRemoval, removableSquares, onPieceRemoval, dropSquares, onDropSquareClick, premoveColor, onPreMove],
  );

  const handlePromotion = useCallback(
    (piece: string) => {
      if (promotionData) {
        // In premove mode, queue the promotion as a premove
        if (!interactive && premoveColor && onPreMove) {
          onPreMove(promotionData.from, promotionData.to, piece);
        } else {
          onMove(promotionData.from, promotionData.to, piece);
        }
        setPromotionData(null);
      }
    },
    [promotionData, onMove, interactive, premoveColor, onPreMove],
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
            const isPremove = premoveSquares?.includes(square);

            const pieceKey = piece ? `${piece.color}${piece.type.toUpperCase()}` : '';
            const isPremoveDimmed = premoveGhosts.dimmed.has(square);
            const ghostPieceKey = premoveGhosts.ghosts.get(square);

            // ── Animation computations ──
            const isMoveTarget = moveAnimation && moveAnimation.to === square;
            const isDropAnimTarget = dropAnimation === square;
            const isExplosionTarget = activeExplosion.includes(square);

            // Compute slide offset for move animation (translate from source to destination)
            let slideStyle: React.CSSProperties | undefined;
            if (isMoveTarget && piece) {
              const fromFile = FILES.indexOf(moveAnimation.from[0]);
              const fromRank = parseInt(moveAnimation.from[1]);
              const toFile = FILES.indexOf(square[0]);
              const toRank = parseInt(square[1]);
              const fileDelta = fromFile - toFile;
              const rankDelta = toRank - fromRank;
              // Flip direction when board is flipped
              const dx = flipped ? -fileDelta : fileDelta;
              const dy = flipped ? -rankDelta : rankDelta;
              slideStyle = {
                '--slide-x': `${dx * 100}%`,
                '--slide-y': `${dy * 100}%`,
              } as React.CSSProperties;
            }

            // Use animGenRef to force re-trigger of animations
            const animKey = (isMoveTarget || isDropAnimTarget) ? `${square}-${animGenRef.current}` : square;

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
                  isExplosionTarget ? 'explosion' : '',
                  isPremove ? 'premove' : '',
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
                  <span
                    key={animKey}
                    className={[
                      'piece',
                      piece.color === 'w' ? 'white-piece' : 'black-piece',
                      isMoveTarget ? 'piece-slide' : '',
                      isDropAnimTarget ? 'piece-drop' : '',
                      isPremoveDimmed ? 'piece-premove-dimmed' : '',
                    ].join(' ')}
                    style={slideStyle}
                  >
                    {PIECE_UNICODE[pieceKey]}
                  </span>
                )}
                {ghostPieceKey && (
                  <span
                    className={[
                      'piece',
                      'piece-premove-ghost',
                      ghostPieceKey[0] === 'w' ? 'white-piece' : 'black-piece',
                    ].join(' ')}
                  >
                    {PIECE_UNICODE[ghostPieceKey]}
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
