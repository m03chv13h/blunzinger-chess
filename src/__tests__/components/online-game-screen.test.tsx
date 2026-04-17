import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OnlineGameScreen } from '../../components/OnlineGameScreen';
import { createInitialState } from '../../core/blunziger/engine';
import { DEFAULT_SETUP_CONFIG, buildMatchConfig } from '../../core/blunziger/types';
import type { GameState, GameSetupConfig } from '../../core/blunziger/types';

// ── Mocks ────────────────────────────────────────────────────────────

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  const config = buildMatchConfig({ ...DEFAULT_SETUP_CONFIG, gameType: 'report_incorrectness' });
  return {
    ...createInitialState('hvh', config),
    ...overrides,
  };
}

const mockHub = {
  connected: true,
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  joinRoom: vi.fn().mockResolvedValue(undefined),
  leaveRoom: vi.fn().mockResolvedValue(undefined),
  sendMove: vi.fn().mockResolvedValue(undefined),
  sendDropMove: vi.fn().mockResolvedValue(undefined),
  sendReport: vi.fn().mockResolvedValue(undefined),
  sendPieceRemoval: vi.fn().mockResolvedValue(undefined),
  resignGame: vi.fn().mockResolvedValue(undefined),
  offerDraw: vi.fn().mockResolvedValue(undefined),
  acceptDraw: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../../hooks/useGameHub', () => ({
  useGameHub: () => mockHub,
}));

vi.mock('../../hooks/useEvaluation', () => ({
  useEvaluation: () => null,
}));

let mockGameState: GameState;

vi.mock('../../hooks/useGame', () => ({
  useGame: () => ({
    state: mockGameState,
    makeMove: vi.fn(() => false),
    makeDropMove: vi.fn(() => false),
    getDropSquares: vi.fn(() => []),
    report: vi.fn(),
    resetGame: vi.fn(),
    canReportNow: false,
    legalMovesFrom: vi.fn(() => []),
    isPlayerTurn: false,
    botThinking: false,
    paused: false,
    setPaused: vi.fn(),
    moveDelay: 500,
    setMoveDelay: vi.fn(),
    clockWhiteMs: 0,
    clockBlackMs: 0,
    selectPieceForRemoval: vi.fn(() => false),
    pendingPieceRemoval: false,
    removableSquares: [],
    loadGameForReview: vi.fn(),
  }),
}));

// ── Tests ────────────────────────────────────────────────────────────

const reportConfig: GameSetupConfig = {
  ...DEFAULT_SETUP_CONFIG,
  gameType: 'report_incorrectness',
};

describe('OnlineGameScreen – perspective-aware report feedback', () => {
  it('shows original feedback message when the player won via valid report', () => {
    const originalMessage = 'Correct! The opponent missed a forced check.';
    mockGameState = makeGameState({
      result: { winner: 'b', reason: 'valid-report', detail: 'White missed a forced check.' },
      lastReportFeedback: { valid: true, message: originalMessage },
    });

    render(
      <OnlineGameScreen
        config={reportConfig}
        roomCode="TEST"
        playerColor="b"
        opponentName="Opponent"
        onLeaveGame={vi.fn()}
      />,
    );

    // Winner (black) should see the original reporter message
    expect(screen.getByText(originalMessage)).toBeInTheDocument();
  });

  it('shows perspective-adjusted feedback when the player lost via valid report', () => {
    const originalMessage = 'Correct! The opponent missed a forced check.';
    mockGameState = makeGameState({
      result: { winner: 'b', reason: 'valid-report', detail: 'White missed a forced check.' },
      lastReportFeedback: { valid: true, message: originalMessage },
    });

    render(
      <OnlineGameScreen
        config={reportConfig}
        roomCode="TEST"
        playerColor="w"
        opponentName="Opponent"
        onLeaveGame={vi.fn()}
      />,
    );

    // Loser (white, the violator) should NOT see the reporter's message
    expect(screen.queryByText(originalMessage)).not.toBeInTheDocument();
    // Instead they should see a perspective-appropriate message
    expect(screen.getByText('Your opponent correctly reported a rule violation.')).toBeInTheDocument();
  });

  it('does not adjust feedback for invalid reports', () => {
    const originalMessage = 'Wrong! There was no violation to report. (White: 1/3 invalid reports)';
    mockGameState = makeGameState({
      lastReportFeedback: { valid: false, message: originalMessage },
    });

    render(
      <OnlineGameScreen
        config={reportConfig}
        roomCode="TEST"
        playerColor="b"
        opponentName="Opponent"
        onLeaveGame={vi.fn()}
      />,
    );

    // Invalid report feedback should remain unchanged
    expect(screen.getByText(originalMessage)).toBeInTheDocument();
  });

  it('shows adjusted feedback for reverse mode valid report when player lost', () => {
    const originalMessage = 'Correct! The opponent gave check when they should have avoided it.';
    mockGameState = makeGameState({
      result: { winner: 'w', reason: 'valid-report', detail: 'Black gave check when alternatives existed.' },
      lastReportFeedback: { valid: true, message: originalMessage },
    });

    render(
      <OnlineGameScreen
        config={reportConfig}
        roomCode="TEST"
        playerColor="b"
        opponentName="Opponent"
        onLeaveGame={vi.fn()}
      />,
    );

    expect(screen.queryByText(originalMessage)).not.toBeInTheDocument();
    expect(screen.getByText('Your opponent correctly reported a rule violation.')).toBeInTheDocument();
  });
});
