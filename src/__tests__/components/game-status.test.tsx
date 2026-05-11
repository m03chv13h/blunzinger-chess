import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GameStatus } from '../../components/GameStatus';
import { createInitialState } from '../../core/blunziger/engine';
import { DEFAULT_SETUP_CONFIG, buildMatchConfig } from '../../core/blunziger/types';
import type { GameState, MissedCheckEntry, GameSetupConfig } from '../../core/blunziger/types';

function makeConfig(overrides: Partial<GameSetupConfig> = {}): GameSetupConfig {
  return { ...DEFAULT_SETUP_CONFIG, ...overrides };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  const config = buildMatchConfig(makeConfig());
  return {
    ...createInitialState('hvh', config),
    ...overrides,
  };
}

describe('GameStatus – valid-report violation details', () => {
  it('should show violation details with categorized moves when game ends via valid-report', () => {
    const missedChecks: MissedCheckEntry[] = [
      {
        moveIndex: 0,
        violationType: 'missed_check',
        availableMoves: ['Qh5+', 'Bb5+'],
        availableRegularMoves: ['Qh5+', 'Bb5+'],
        availableDropMoves: [],
      },
    ];

    const state = makeState({
      result: { winner: 'b', reason: 'valid-report', detail: 'White missed a forced check.' },
      lastReportFeedback: { valid: true, message: 'Correct! The opponent missed a forced check.' },
      missedChecks,
      pendingViolation: {
        violatingSide: 'w',
        moveIndex: 0,
        fenBeforeMove: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        checkingMoves: [],
        requiredMoves: [],
        reportable: false,
        violationType: 'missed_check',
        severe: false,
      },
    });

    render(<GameStatus state={state} onReport={() => {}} botThinking={false} />);

    const details = screen.getByTestId('violation-details');
    expect(details).toBeInTheDocument();
    expect(details).toHaveTextContent('Normal moves:');
    expect(details).toHaveTextContent('Qh5+, Bb5+');
  });

  it('should show multiple categories (normal moves + piece placement)', () => {
    const missedChecks: MissedCheckEntry[] = [
      {
        moveIndex: 0,
        violationType: 'missed_check',
        availableMoves: ['Nf3+', 'N@d4'],
        availableRegularMoves: ['Nf3+'],
        availableDropMoves: ['N@d4'],
      },
    ];

    const state = makeState({
      result: { winner: 'b', reason: 'valid-report', detail: 'White missed a forced check.' },
      lastReportFeedback: { valid: true, message: 'Correct!' },
      missedChecks,
      pendingViolation: {
        violatingSide: 'w',
        moveIndex: 0,
        fenBeforeMove: 'fen',
        checkingMoves: [],
        requiredMoves: [],
        reportable: false,
        violationType: 'missed_check',
        severe: false,
      },
    });

    render(<GameStatus state={state} onReport={() => {}} botThinking={false} />);

    const details = screen.getByTestId('violation-details');
    expect(details).toHaveTextContent('Normal moves:');
    expect(details).toHaveTextContent('Nf3+');
    expect(details).toHaveTextContent('Piece placement:');
    expect(details).toHaveTextContent('N@d4');
  });

  it('should show piece removal category for removal violations', () => {
    const missedChecks: MissedCheckEntry[] = [
      {
        moveIndex: 0,
        violationType: 'missed_check_removal',
        availableMoves: ['e2', 'd2'],
        availableRemovalSquares: ['e2', 'd2'],
      },
    ];

    const state = makeState({
      result: { winner: 'b', reason: 'valid-report', detail: 'White missed a removal.' },
      lastReportFeedback: { valid: true, message: 'Correct!' },
      missedChecks,
      pendingViolation: {
        violatingSide: 'w',
        moveIndex: 0,
        fenBeforeMove: 'fen',
        checkingMoves: [],
        requiredMoves: [],
        reportable: false,
        violationType: 'missed_check_removal',
        severe: false,
      },
    });

    render(<GameStatus state={state} onReport={() => {}} botThinking={false} />);

    const details = screen.getByTestId('violation-details');
    expect(details).toHaveTextContent('Piece removal:');
    expect(details).toHaveTextContent('e2, d2');
  });

  it('should show "Additional move" label when isAdditionalMove is true', () => {
    const missedChecks: MissedCheckEntry[] = [
      {
        moveIndex: 0,
        violationType: 'missed_check',
        availableMoves: ['Bb4+'],
        availableRegularMoves: ['Bb4+'],
        availableDropMoves: [],
        isAdditionalMove: true,
      },
    ];

    const state = makeState({
      result: { winner: 'b', reason: 'valid-report', detail: 'White missed a check.' },
      lastReportFeedback: { valid: true, message: 'Correct!' },
      missedChecks,
      pendingViolation: {
        violatingSide: 'w',
        moveIndex: 0,
        fenBeforeMove: 'fen',
        checkingMoves: [],
        requiredMoves: [],
        reportable: false,
        violationType: 'missed_check',
        severe: false,
      },
    });

    render(<GameStatus state={state} onReport={() => {}} botThinking={false} />);

    const details = screen.getByTestId('violation-details');
    expect(details).toHaveTextContent('Additional move:');
    expect(details).toHaveTextContent('Bb4+');
  });

  it('should fall back to flat list for entries without categorized fields', () => {
    const missedChecks: MissedCheckEntry[] = [
      {
        moveIndex: 0,
        violationType: 'missed_check',
        availableMoves: ['Qh5+', 'Bb5+'],
      },
    ];

    const state = makeState({
      result: { winner: 'b', reason: 'valid-report', detail: 'White missed a forced check.' },
      lastReportFeedback: { valid: true, message: 'Correct!' },
      missedChecks,
      pendingViolation: {
        violatingSide: 'w',
        moveIndex: 0,
        fenBeforeMove: 'fen',
        checkingMoves: [],
        requiredMoves: [],
        reportable: false,
        violationType: 'missed_check',
        severe: false,
      },
    });

    render(<GameStatus state={state} onReport={() => {}} botThinking={false} />);

    const details = screen.getByTestId('violation-details');
    expect(details).toHaveTextContent('Available moves:');
    expect(details).toHaveTextContent('Qh5+, Bb5+');
  });

  it('should NOT show violation details for non-valid-report results', () => {
    const state = makeState({
      result: { winner: 'w', reason: 'checkmate' },
    });

    render(<GameStatus state={state} onReport={() => {}} botThinking={false} />);

    expect(screen.queryByTestId('violation-details')).not.toBeInTheDocument();
  });

  it('should NOT show violation details when missedChecks is empty', () => {
    const state = makeState({
      result: { winner: 'b', reason: 'valid-report', detail: 'White missed a check.' },
      lastReportFeedback: { valid: true, message: 'Correct!' },
      missedChecks: [],
    });

    render(<GameStatus state={state} onReport={() => {}} botThinking={false} />);

    expect(screen.queryByTestId('violation-details')).not.toBeInTheDocument();
  });
});

describe('GameStatus – report button disabled state', () => {
  function makeReportState(overrides: Partial<GameState> = {}): GameState {
    const config = buildMatchConfig(makeConfig({ gameType: 'report_incorrectness', enableGspritzt: true }));
    return {
      ...createInitialState('hvh', config),
      ...overrides,
    };
  }

  it('disables Report Violation button when canReport is false', () => {
    const state = makeReportState();
    render(<GameStatus state={state} onReport={vi.fn()} canReport={false} botThinking={false} />);

    const btn = screen.getByText('🚨 Report Violation');
    expect(btn).toBeDisabled();
  });

  it('enables Report Violation button when canReport is true', () => {
    const state = makeReportState();
    render(<GameStatus state={state} onReport={vi.fn()} canReport={true} botThinking={false} />);

    const btn = screen.getByText('🚨 Report Violation');
    expect(btn).not.toBeDisabled();
  });

  it('disables G\'spritzt button when canReportGspritzt is false', () => {
    const state = makeReportState();
    render(
      <GameStatus state={state} onReport={vi.fn()} onReportGspritzt={vi.fn()} canReportGspritzt={false} botThinking={false} />,
    );

    const btn = screen.getByText(/Report Blunzinger G/);
    expect(btn).toBeDisabled();
  });

  it('enables G\'spritzt button when canReportGspritzt is true', () => {
    const state = makeReportState();
    render(
      <GameStatus state={state} onReport={vi.fn()} onReportGspritzt={vi.fn()} canReportGspritzt={true} botThinking={false} />,
    );

    const btn = screen.getByText(/Report Blunzinger G/);
    expect(btn).not.toBeDisabled();
  });

  it('buttons are enabled by default when canReport props are not provided', () => {
    const state = makeReportState();
    render(
      <GameStatus state={state} onReport={vi.fn()} onReportGspritzt={vi.fn()} botThinking={false} />,
    );

    const reportBtn = screen.getByText('🚨 Report Violation');
    const gspritztBtn = screen.getByText(/Report Blunzinger G/);
    expect(reportBtn).not.toBeDisabled();
    expect(gspritztBtn).not.toBeDisabled();
  });
});
