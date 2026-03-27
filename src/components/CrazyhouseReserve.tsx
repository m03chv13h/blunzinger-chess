import { useCallback } from 'react';
import type { Color, CrazyhousePieceType, PlayerReserve } from '../core/blunziger/types';
import './CrazyhouseReserve.css';

const PIECE_UNICODE: Record<string, Record<CrazyhousePieceType, string>> = {
  w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕' },
  b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' },
};

const PIECE_TYPES: CrazyhousePieceType[] = ['q', 'r', 'b', 'n', 'p'];

interface CrazyhouseReserveProps {
  side: Color;
  reserve: PlayerReserve;
  interactive: boolean;
  selectedPiece: CrazyhousePieceType | null;
  onSelectPiece: (piece: CrazyhousePieceType | null) => void;
}

export function CrazyhouseReserve({
  side,
  reserve,
  interactive,
  selectedPiece,
  onSelectPiece,
}: CrazyhouseReserveProps) {
  const handleClick = useCallback(
    (piece: CrazyhousePieceType) => {
      if (!interactive) return;
      if (reserve[piece] <= 0) return;
      if (selectedPiece === piece) {
        onSelectPiece(null);
      } else {
        onSelectPiece(piece);
      }
    },
    [interactive, reserve, selectedPiece, onSelectPiece],
  );

  const label = side === 'w' ? 'W' : 'B';

  return (
    <div className={`crazyhouse-reserve ${side === 'w' ? 'crazyhouse-reserve-white' : 'crazyhouse-reserve-black'}`}>
      <span className="crazyhouse-reserve-label">{label}:</span>
      {PIECE_TYPES.map((pt) => {
        const count = reserve[pt];
        const isEmpty = count <= 0;
        const isSelected = selectedPiece === pt;
        const isClickable = interactive && count > 0;
        return (
          <span
            key={pt}
            className={`reserve-piece${isEmpty ? ' empty' : ''}${isClickable ? ' clickable' : ''}${isSelected ? ' selected' : ''}`}
            onClick={() => handleClick(pt)}
            title={isEmpty ? `${pt.toUpperCase()} (none)` : `${pt.toUpperCase()} (×${count})`}
          >
            {PIECE_UNICODE[side][pt]}
            {count > 1 && <span className="reserve-count">{count}</span>}
          </span>
        );
      })}
    </div>
  );
}

interface CrazyhouseReservesProps {
  whiteReserve: PlayerReserve;
  blackReserve: PlayerReserve;
  interactive: boolean;
  activeSide: Color;
  selectedDropPiece: CrazyhousePieceType | null;
  onSelectDropPiece: (piece: CrazyhousePieceType | null) => void;
  flipped?: boolean;
}

export function CrazyhouseReserves({
  whiteReserve,
  blackReserve,
  interactive,
  activeSide,
  selectedDropPiece,
  onSelectDropPiece,
  flipped,
}: CrazyhouseReservesProps) {
  const topSide = flipped ? 'w' : 'b';
  const bottomSide = flipped ? 'b' : 'w';

  return (
    <div className="crazyhouse-reserves-container">
      <CrazyhouseReserve
        side={topSide}
        reserve={topSide === 'w' ? whiteReserve : blackReserve}
        interactive={interactive && activeSide === topSide}
        selectedPiece={activeSide === topSide ? selectedDropPiece : null}
        onSelectPiece={onSelectDropPiece}
      />
      <CrazyhouseReserve
        side={bottomSide}
        reserve={bottomSide === 'w' ? whiteReserve : blackReserve}
        interactive={interactive && activeSide === bottomSide}
        selectedPiece={activeSide === bottomSide ? selectedDropPiece : null}
        onSelectPiece={onSelectDropPiece}
      />
    </div>
  );
}
