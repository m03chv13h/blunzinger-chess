import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CrazyhouseReserve, CrazyhouseReserves } from '../components/CrazyhouseReserve';
import { Chessboard } from '../components/Chessboard';
import type { PlayerReserve, Square } from '../core/blunziger/types';
import { EMPTY_RESERVE } from '../core/blunziger/types';

const RESERVE_WITH_KNIGHT: PlayerReserve = { ...EMPTY_RESERVE, n: 1 };
const RESERVE_WITH_PIECES: PlayerReserve = { p: 2, n: 1, b: 0, r: 1, q: 0 };
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('CrazyhouseReserve drag-and-drop', () => {
  it('sets draggable=true on clickable (available) reserve pieces', () => {
    render(
      <CrazyhouseReserve
        side="w"
        reserve={RESERVE_WITH_PIECES}
        interactive={true}
        selectedPiece={null}
        onSelectPiece={() => {}}
      />,
    );
    // Knight has count 1 → clickable → draggable
    const knight = screen.getByTitle('N (×1)');
    expect(knight).toHaveAttribute('draggable', 'true');

    // Pawn has count 2 → clickable → draggable
    const pawn = screen.getByTitle('P (×2)');
    expect(pawn).toHaveAttribute('draggable', 'true');

    // Bishop has count 0 → empty → not draggable
    const bishop = screen.getByTitle('B (none)');
    expect(bishop).not.toHaveAttribute('draggable', 'true');
  });

  it('does not set draggable when not interactive', () => {
    render(
      <CrazyhouseReserve
        side="w"
        reserve={RESERVE_WITH_KNIGHT}
        interactive={false}
        selectedPiece={null}
        onSelectPiece={() => {}}
      />,
    );
    const knight = screen.getByTitle('N (×1)');
    expect(knight).not.toHaveAttribute('draggable', 'true');
  });

  it('calls onDragStartPiece with piece type on dragStart', () => {
    const onDragStart = vi.fn();
    render(
      <CrazyhouseReserve
        side="w"
        reserve={RESERVE_WITH_KNIGHT}
        interactive={true}
        selectedPiece={null}
        onSelectPiece={() => {}}
        onDragStartPiece={onDragStart}
      />,
    );
    const knight = screen.getByTitle('N (×1)');
    const dataTransfer = {
      setData: vi.fn(),
      effectAllowed: '',
    };
    fireEvent.dragStart(knight, { dataTransfer });
    expect(onDragStart).toHaveBeenCalledWith('n');
    expect(dataTransfer.setData).toHaveBeenCalledWith('application/x-crazyhouse-piece', 'n');
    expect(dataTransfer.effectAllowed).toBe('move');
  });

  it('calls onDragEndPiece on dragEnd', () => {
    const onDragEnd = vi.fn();
    render(
      <CrazyhouseReserve
        side="w"
        reserve={RESERVE_WITH_KNIGHT}
        interactive={true}
        selectedPiece={null}
        onSelectPiece={() => {}}
        onDragEndPiece={onDragEnd}
      />,
    );
    const knight = screen.getByTitle('N (×1)');
    fireEvent.dragEnd(knight);
    expect(onDragEnd).toHaveBeenCalled();
  });

  it('click-to-select still works alongside drag', () => {
    const onSelect = vi.fn();
    render(
      <CrazyhouseReserve
        side="w"
        reserve={RESERVE_WITH_KNIGHT}
        interactive={true}
        selectedPiece={null}
        onSelectPiece={onSelect}
        onDragStartPiece={() => {}}
        onDragEndPiece={() => {}}
      />,
    );
    const knight = screen.getByTitle('N (×1)');
    fireEvent.click(knight);
    expect(onSelect).toHaveBeenCalledWith('n');
  });
});

describe('CrazyhouseReserves drag-and-drop', () => {
  it('passes drag callbacks to active side reserve only', () => {
    const onDragStart = vi.fn();
    const onDragEnd = vi.fn();
    render(
      <CrazyhouseReserves
        whiteReserve={RESERVE_WITH_KNIGHT}
        blackReserve={RESERVE_WITH_KNIGHT}
        interactive={true}
        activeSide="w"
        selectedDropPiece={null}
        onSelectDropPiece={() => {}}
        onDragStartPiece={onDragStart}
        onDragEndPiece={onDragEnd}
      />,
    );
    // White knight should be draggable (active side)
    const allKnights = screen.getAllByTitle('N (×1)');
    // First is black (top), second is white (bottom) in default non-flipped layout
    const blackKnight = allKnights[0];
    const whiteKnight = allKnights[1];

    // White knight is interactive (active) → draggable
    expect(whiteKnight).toHaveAttribute('draggable', 'true');
    // Black knight is not interactive (inactive) → not draggable
    expect(blackKnight).not.toHaveAttribute('draggable', 'true');

    // Drag white knight triggers callback
    fireEvent.dragStart(whiteKnight, {
      dataTransfer: { setData: vi.fn(), effectAllowed: '' },
    });
    expect(onDragStart).toHaveBeenCalledWith('n');

    // Drag black knight does not trigger callback (onDragStartPiece not passed)
    onDragStart.mockClear();
    fireEvent.dragStart(blackKnight, {
      dataTransfer: { setData: vi.fn(), effectAllowed: '' },
    });
    expect(onDragStart).not.toHaveBeenCalled();
  });
});

describe('Chessboard drop handling', () => {
  const noop = () => false;
  const noMoves = () => [] as Square[];

  it('prevents default on dragOver for drop-target squares', () => {
    render(
      <Chessboard
        fen={START_FEN}
        onMove={noop}
        legalMovesFrom={noMoves}
        interactive={true}
        dropSquares={['d4' as Square]}
        onDropSquareClick={noop}
        onReserveDrop={noop}
      />,
    );
    const d4 = screen.getByLabelText('d4');
    const dragOverEvent = new Event('dragover', { bubbles: true, cancelable: true });
    Object.defineProperty(dragOverEvent, 'dataTransfer', {
      value: { dropEffect: '' },
    });
    d4.dispatchEvent(dragOverEvent);
    expect(dragOverEvent.defaultPrevented).toBe(true);
  });

  it('does not prevent default on dragOver for non-drop-target squares', () => {
    render(
      <Chessboard
        fen={START_FEN}
        onMove={noop}
        legalMovesFrom={noMoves}
        interactive={true}
        dropSquares={['d4' as Square]}
        onDropSquareClick={noop}
        onReserveDrop={noop}
      />,
    );
    // e5 is not in dropSquares
    const e5 = screen.getByLabelText('e5');
    const dragOverEvent = new Event('dragover', { bubbles: true, cancelable: true });
    Object.defineProperty(dragOverEvent, 'dataTransfer', {
      value: { dropEffect: '' },
    });
    e5.dispatchEvent(dragOverEvent);
    expect(dragOverEvent.defaultPrevented).toBe(false);
  });

  it('calls onReserveDrop with piece and square on drop', () => {
    const onReserveDrop = vi.fn().mockReturnValue(true);
    render(
      <Chessboard
        fen={START_FEN}
        onMove={noop}
        legalMovesFrom={noMoves}
        interactive={true}
        dropSquares={['d4' as Square]}
        onReserveDrop={onReserveDrop}
      />,
    );
    const d4 = screen.getByLabelText('d4');
    fireEvent.drop(d4, {
      dataTransfer: {
        getData: (type: string) =>
          type === 'application/x-crazyhouse-piece' ? 'n' : '',
      },
    });
    expect(onReserveDrop).toHaveBeenCalledWith('n', 'd4');
  });

  it('does not call onReserveDrop when no piece data in transfer', () => {
    const onReserveDrop = vi.fn();
    render(
      <Chessboard
        fen={START_FEN}
        onMove={noop}
        legalMovesFrom={noMoves}
        interactive={true}
        dropSquares={['d4' as Square]}
        onReserveDrop={onReserveDrop}
      />,
    );
    const d4 = screen.getByLabelText('d4');
    fireEvent.drop(d4, {
      dataTransfer: {
        getData: () => '',
      },
    });
    expect(onReserveDrop).not.toHaveBeenCalled();
  });
});
