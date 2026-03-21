import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MoveList } from '../components/MoveList';
import type { Move } from 'chess.js';
import type { MissedCheckEntry } from '../core/blunziger/types';

/** Minimal Move stub matching what MoveList uses (only .san is read). */
function move(san: string): Move {
  return { san } as Move;
}

describe('MoveList – missed-check sausage icon', () => {
  it('should not show sausage icon when there are no missed checks', () => {
    render(<MoveList moves={[move('e4'), move('e5')]} />);
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
        moves={[move('d3'), move('e6')]}
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
        moves={[move('d3')]}
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
        moves={[move('d3')]}
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
        moves={[move('Qh5'), move('e6')]}
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
        moves={[move('d3'), move('e6'), move('a3'), move('d5')]}
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
        moves={[move('e4'), move('d5')]}
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
        moves={[move('e4'), move('d5'), move('Nf3')]}
        missedChecks={missedChecks}
      />,
    );
    expect(screen.getByTitle('Missed a possible check')).toBeInTheDocument();
  });
});
