import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FenDisplay } from '../components/FenDisplay';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('FenDisplay', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders the FEN string in a read-only input', () => {
    render(<FenDisplay fen={STARTING_FEN} />);
    const input = screen.getByRole('textbox', { name: /fen string/i });
    expect(input).toHaveValue(STARTING_FEN);
    expect(input).toHaveAttribute('readOnly');
  });

  it('displays the FEN label', () => {
    render(<FenDisplay fen={STARTING_FEN} />);
    expect(screen.getByText('FEN')).toBeInTheDocument();
  });

  it('renders a copy button', () => {
    render(<FenDisplay fen={STARTING_FEN} />);
    expect(screen.getByRole('button', { name: /copy fen/i })).toBeInTheDocument();
  });

  it('copies the FEN to clipboard when the copy button is clicked', () => {
    render(<FenDisplay fen={STARTING_FEN} />);
    const btn = screen.getByRole('button', { name: /copy fen/i });
    fireEvent.click(btn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(STARTING_FEN);
  });

  it('updates when the fen prop changes', () => {
    const newFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const { rerender } = render(<FenDisplay fen={STARTING_FEN} />);
    const input = screen.getByRole('textbox', { name: /fen string/i });
    expect(input).toHaveValue(STARTING_FEN);

    rerender(<FenDisplay fen={newFen} />);
    expect(input).toHaveValue(newFen);
  });

  it('has an aria-label on the container', () => {
    render(<FenDisplay fen={STARTING_FEN} />);
    expect(screen.getByLabelText('Current FEN')).toBeInTheDocument();
  });
});
