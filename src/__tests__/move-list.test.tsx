import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MoveList } from '../components/MoveList';
import type { Move, Color } from 'chess.js';
import type { MissedCheckEntry } from '../core/blunziger/types';

/** Minimal Move stub – includes color for column placement. */
function move(san: string, color: Color = (undefined as unknown as Color)): Move {
  return { san, color } as Move;
}

/** White move stub. */
function w(san: string): Move {
  return move(san, 'w');
}

/** Black move stub. */
function b(san: string): Move {
  return move(san, 'b');
}

describe('MoveList – column headers', () => {
  it('should display White and Black column headers', () => {
    render(<MoveList moves={[]} />);
    expect(screen.getByText('White')).toBeInTheDocument();
    expect(screen.getByText('Black')).toBeInTheDocument();
  });

  it('should display # in the header number column', () => {
    render(<MoveList moves={[]} />);
    expect(screen.getByText('#')).toBeInTheDocument();
  });
});

describe('MoveList – extra move column placement', () => {
  it('should place a normal white move in the white column', () => {
    const { container } = render(<MoveList moves={[w('e4')]} />);
    const whiteCell = container.querySelector('.move-pair:not(.move-header) .move-white');
    expect(whiteCell).toHaveTextContent('e4');
  });

  it('should place a normal black move in the black column', () => {
    const { container } = render(<MoveList moves={[w('e4'), b('e5')]} />);
    const blackCell = container.querySelector('.move-pair:not(.move-header) .move-black');
    expect(blackCell).toHaveTextContent('e5');
  });

  it('should place an extra white move in the white column, not black', () => {
    // Sequence: w(e4), b(e5), w(d4) extra white, b(d5)
    const moves = [w('e4'), b('e5'), w('d4'), w('Nf3'), b('d5')];
    const { container } = render(<MoveList moves={moves} />);
    // Row 1: white=e4, black=e5
    // Row 2: white=d4, black=d5 (but d4 comes before Nf3 which is also white)
    // Actually: Row 2: white=d4, Row 3: white=Nf3, black=d5
    const rows = container.querySelectorAll('.move-pair:not(.move-header)');
    expect(rows).toHaveLength(3);
    // Row 1: e4 / e5
    expect(rows[0].querySelector('.move-white')).toHaveTextContent('e4');
    expect(rows[0].querySelector('.move-black')).toHaveTextContent('e5');
    // Row 2: d4 (extra white move) in white column
    expect(rows[1].querySelector('.move-white')).toHaveTextContent('d4');
    // Row 3: Nf3 (extra white move) / d5
    expect(rows[2].querySelector('.move-white')).toHaveTextContent('Nf3');
    expect(rows[2].querySelector('.move-black')).toHaveTextContent('d5');
  });

  it('should place an extra black move in the black column, not white', () => {
    // Sequence: w(e4), b(e5), b(d5) extra black, w(Nf3), b(Nc6)
    const moves = [w('e4'), b('e5'), b('d5'), w('Nf3'), b('Nc6')];
    const { container } = render(<MoveList moves={moves} />);
    const rows = container.querySelectorAll('.move-pair:not(.move-header)');
    expect(rows).toHaveLength(3);
    // Row 1: e4 / e5
    expect(rows[0].querySelector('.move-white')).toHaveTextContent('e4');
    expect(rows[0].querySelector('.move-black')).toHaveTextContent('e5');
    // Row 2: _ / d5 (extra black move in black column)
    expect(rows[1].querySelector('.move-white')).toHaveTextContent('');
    expect(rows[1].querySelector('.move-black')).toHaveTextContent('d5');
    // Row 3: Nf3 / Nc6
    expect(rows[2].querySelector('.move-white')).toHaveTextContent('Nf3');
    expect(rows[2].querySelector('.move-black')).toHaveTextContent('Nc6');
  });

  it('should mark extra moves with ⚡ indicator', () => {
    // w,b,w,w(extra),b – index 3 is extra (same color as index 2)
    const moves = [w('e4'), b('e5'), w('d4'), w('Nf3'), b('d5')];
    render(<MoveList moves={moves} />);
    // Nf3 at index 3 is extra (prev at index 2 is also white)
    const extraLabels = screen.getAllByTitle('Extra move (penalty)');
    expect(extraLabels).toHaveLength(1);
  });
});

describe('MoveList – missed-check sausage icon', () => {
  it('should not show sausage icon when there are no missed checks', () => {
    render(<MoveList moves={[w('e4'), b('e5')]} />);
    expect(screen.queryByTitle('Missed a possible check')).not.toBeInTheDocument();
    expect(screen.queryByText('🌭')).not.toBeInTheDocument();
  });

  it('should show sausage icon for a missed check once opponent has moved', () => {
    const missedChecks: MissedCheckEntry[] = [
      { moveIndex: 0, violationType: 'missed_check' },
    ];
    // Two moves: white (index 0) missed check, black (index 1) has replied
    render(
      <MoveList
        moves={[w('d3'), b('e6')]}
        missedChecks={missedChecks}
      />,
    );
    expect(screen.getByTitle('Missed a possible check')).toBeInTheDocument();
    expect(screen.getByText('🌭')).toBeInTheDocument();
  });

  it('should NOT show sausage icon before opponent has moved', () => {
    const missedChecks: MissedCheckEntry[] = [
      { moveIndex: 0, violationType: 'missed_check' },
    ];
    // Only one move: white (index 0) just played, black has NOT replied
    render(
      <MoveList
        moves={[w('d3')]}
        missedChecks={missedChecks}
      />,
    );
    expect(screen.queryByTitle('Missed a possible check')).not.toBeInTheDocument();
  });

  it('should show sausage icon before opponent moves if game is over', () => {
    const missedChecks: MissedCheckEntry[] = [
      { moveIndex: 0, violationType: 'missed_check' },
    ];
    // Only one move, but game is over
    render(
      <MoveList
        moves={[w('d3')]}
        missedChecks={missedChecks}
        gameOver={true}
      />,
    );
    expect(screen.getByTitle('Missed a possible check')).toBeInTheDocument();
  });

  it('should show gave_forbidden_check title for reverse mode violations', () => {
    const missedChecks: MissedCheckEntry[] = [
      { moveIndex: 0, violationType: 'gave_forbidden_check' },
    ];
    render(
      <MoveList
        moves={[w('Qh5'), b('e6')]}
        missedChecks={missedChecks}
      />,
    );
    expect(screen.getByTitle('Gave a forbidden check')).toBeInTheDocument();
  });

  it('should show multiple sausage icons for multiple missed checks', () => {
    const missedChecks: MissedCheckEntry[] = [
      { moveIndex: 0, violationType: 'missed_check' },
      { moveIndex: 2, violationType: 'missed_check' },
    ];
    // 4 moves total: white0, black1, white2, black3
    render(
      <MoveList
        moves={[w('d3'), b('e6'), w('a3'), b('d5')]}
        missedChecks={missedChecks}
      />,
    );
    const icons = screen.getAllByText('🌭');
    expect(icons).toHaveLength(2);
  });

  it('should not show sausage icon on black move when black is the last move', () => {
    const missedChecks: MissedCheckEntry[] = [
      { moveIndex: 1, violationType: 'missed_check' },
    ];
    // Two moves: white(0) then black(1) missed check, no move after
    render(
      <MoveList
        moves={[w('e4'), b('d5')]}
        missedChecks={missedChecks}
      />,
    );
    // Black move at index 1, no move at index 2 yet → hidden
    expect(screen.queryByTitle('Missed a possible check')).not.toBeInTheDocument();
  });

  it('should show sausage icon on black move after white replies', () => {
    const missedChecks: MissedCheckEntry[] = [
      { moveIndex: 1, violationType: 'missed_check' },
    ];
    // Three moves: white(0), black(1) missed check, white(2) replied
    render(
      <MoveList
        moves={[w('e4'), b('d5'), w('Nf3')]}
        missedChecks={missedChecks}
      />,
    );
    expect(screen.getByTitle('Missed a possible check')).toBeInTheDocument();
  });
});
