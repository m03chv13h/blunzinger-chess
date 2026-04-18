import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OnlineGameScreen } from '../../components/OnlineGameScreen';
import { createInitialState } from '../../core/blunziger/engine';
import { DEFAULT_SETUP_CONFIG, buildMatchConfig } from '../../core/blunziger/types';
import type { GameState, GameSetupConfig } from '../../core/blunziger/types';
import type { GameHubCallbacks } from '../../hooks/useGameHub';

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

let capturedCallbacks: GameHubCallbacks = {};

vi.mock('../../hooks/useGameHub', () => ({
  useGameHub: (callbacks: GameHubCallbacks) => {
    capturedCallbacks = callbacks;
    return mockHub;
  },
}));

vi.mock('../../hooks/useEvaluation', () => ({
  useEvaluation: () => null,
}));

let mockGameState: GameState;
const mockSetResult = vi.fn();

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
    setResult: mockSetResult,
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

  it('shows adjusted feedback when opponent reported incorrectly', () => {
    const originalMessage = 'Wrong! There was no violation to report. (White: 1/3 invalid reports)';
    mockGameState = makeGameState({
      lastReportFeedback: { valid: false, message: originalMessage },
      violationReports: [{ moveIndex: 0, reportingSide: 'w', valid: false }],
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

    // Non-reporting player should see a perspective-appropriate message
    expect(screen.queryByText(originalMessage)).not.toBeInTheDocument();
    expect(screen.getByText('Your opponent reported incorrectly.')).toBeInTheDocument();
  });

  it('does not adjust feedback when the player themselves reported incorrectly', () => {
    const originalMessage = 'Wrong! There was no violation to report. (Black: 1/3 invalid reports)';
    mockGameState = makeGameState({
      lastReportFeedback: { valid: false, message: originalMessage },
      violationReports: [{ moveIndex: 0, reportingSide: 'b', valid: false }],
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

    // Reporter should see the original feedback message
    expect(screen.getByText(originalMessage)).toBeInTheDocument();
  });

  it('shows adjusted feedback when opponent hits invalid report threshold', () => {
    const originalMessage = 'Wrong! There was no violation to report. White loses due to reaching the invalid report threshold.';
    mockGameState = makeGameState({
      lastReportFeedback: { valid: false, message: originalMessage },
      result: { winner: 'b', reason: 'invalid-report-threshold', detail: 'White made 3 invalid report(s), reaching the threshold of 3.' },
      violationReports: [
        { moveIndex: 0, reportingSide: 'w', valid: false },
        { moveIndex: 1, reportingSide: 'w', valid: false },
        { moveIndex: 2, reportingSide: 'w', valid: false },
      ],
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
    expect(screen.getByText('Your opponent reported incorrectly.')).toBeInTheDocument();
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

describe('OnlineGameScreen – resignation and draw via GameOver event', () => {
  beforeEach(() => {
    mockSetResult.mockClear();
    capturedCallbacks = {};
  });

  it('sets resignation result when white resigns', () => {
    mockGameState = makeGameState();

    render(
      <OnlineGameScreen
        config={reportConfig}
        roomCode="TEST"
        playerColor="b"
        opponentName="Opponent"
        onLeaveGame={vi.fn()}
      />,
    );

    // Simulate the server sending a GameOver event for resignation
    act(() => {
      capturedCallbacks.onGameOver?.({ reason: 'resignation', resigningSide: 'white' });
    });

    expect(mockSetResult).toHaveBeenCalledWith({
      winner: 'b',
      reason: 'resignation',
    });
  });

  it('sets resignation result when black resigns', () => {
    mockGameState = makeGameState();

    render(
      <OnlineGameScreen
        config={reportConfig}
        roomCode="TEST"
        playerColor="w"
        opponentName="Opponent"
        onLeaveGame={vi.fn()}
      />,
    );

    act(() => {
      capturedCallbacks.onGameOver?.({ reason: 'resignation', resigningSide: 'black' });
    });

    expect(mockSetResult).toHaveBeenCalledWith({
      winner: 'w',
      reason: 'resignation',
    });
  });

  it('sets draw result when draw is agreed', () => {
    mockGameState = makeGameState();

    render(
      <OnlineGameScreen
        config={reportConfig}
        roomCode="TEST"
        playerColor="w"
        opponentName="Opponent"
        onLeaveGame={vi.fn()}
      />,
    );

    act(() => {
      capturedCallbacks.onGameOver?.({ reason: 'draw', detail: 'Draw by agreement' });
    });

    expect(mockSetResult).toHaveBeenCalledWith({
      winner: 'draw',
      reason: 'draw',
      detail: 'Draw by agreement',
    });
  });

  it('ignores unknown GameOver reasons', () => {
    mockGameState = makeGameState();

    render(
      <OnlineGameScreen
        config={reportConfig}
        roomCode="TEST"
        playerColor="w"
        opponentName="Opponent"
        onLeaveGame={vi.fn()}
      />,
    );

    act(() => {
      capturedCallbacks.onGameOver?.({ reason: 'unknown_reason' });
    });

    expect(mockSetResult).not.toHaveBeenCalled();
  });
});

describe('OnlineGameScreen – disconnection handling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSetResult.mockClear();
    capturedCallbacks = {};
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows disconnect countdown banner when opponent disconnects with timeout', () => {
    mockGameState = makeGameState();

    render(
      <OnlineGameScreen
        config={reportConfig}
        roomCode="TEST"
        playerColor="w"
        opponentName="Opponent"
        onLeaveGame={vi.fn()}
      />,
    );

    act(() => {
      capturedCallbacks.onOpponentDisconnected?.({ userId: 'opp-id', timeoutSeconds: 20 });
    });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('20s')).toBeInTheDocument();
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  it('counts down the disconnect timer each second', () => {
    mockGameState = makeGameState();

    render(
      <OnlineGameScreen
        config={reportConfig}
        roomCode="TEST"
        playerColor="w"
        opponentName="Opponent"
        onLeaveGame={vi.fn()}
      />,
    );

    act(() => {
      capturedCallbacks.onOpponentDisconnected?.({ userId: 'opp-id', timeoutSeconds: 20 });
    });

    expect(screen.getByText('20s')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByText('17s')).toBeInTheDocument();
  });

  it('clears disconnect countdown when opponent reconnects via OpponentReconnected', () => {
    mockGameState = makeGameState();

    render(
      <OnlineGameScreen
        config={reportConfig}
        roomCode="TEST"
        playerColor="w"
        opponentName="Opponent"
        onLeaveGame={vi.fn()}
      />,
    );

    act(() => {
      capturedCallbacks.onOpponentDisconnected?.({ userId: 'opp-id', timeoutSeconds: 20 });
    });

    expect(screen.getByRole('alert')).toBeInTheDocument();

    act(() => {
      capturedCallbacks.onOpponentReconnected?.({ userId: 'opp-id' });
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('clears disconnect countdown when opponent reconnects via PlayerJoined', () => {
    mockGameState = makeGameState();

    render(
      <OnlineGameScreen
        config={reportConfig}
        roomCode="TEST"
        playerColor="w"
        opponentName="Opponent"
        onLeaveGame={vi.fn()}
      />,
    );

    act(() => {
      capturedCallbacks.onOpponentDisconnected?.({ userId: 'opp-id', timeoutSeconds: 20 });
    });

    expect(screen.getByRole('alert')).toBeInTheDocument();

    act(() => {
      capturedCallbacks.onPlayerJoined?.({
        userId: 'opp-id',
        roomCode: 'TEST',
        status: 'Playing',
        gameState: null,
      });
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('sets disconnection result when GameOver with disconnection reason is received', () => {
    mockGameState = makeGameState();

    render(
      <OnlineGameScreen
        config={reportConfig}
        roomCode="TEST"
        playerColor="w"
        opponentName="Opponent"
        onLeaveGame={vi.fn()}
      />,
    );

    act(() => {
      capturedCallbacks.onGameOver?.({
        reason: 'disconnection',
        disconnectedSide: 'black',
        detail: 'Black disconnected and did not reconnect within 20 seconds.',
      });
    });

    expect(mockSetResult).toHaveBeenCalledWith({
      winner: 'w',
      reason: 'disconnection',
      detail: 'Black disconnected and did not reconnect within 20 seconds.',
    });
  });

  it('sets disconnection result for white disconnect (black wins)', () => {
    mockGameState = makeGameState();

    render(
      <OnlineGameScreen
        config={reportConfig}
        roomCode="TEST"
        playerColor="b"
        opponentName="Opponent"
        onLeaveGame={vi.fn()}
      />,
    );

    act(() => {
      capturedCallbacks.onGameOver?.({
        reason: 'disconnection',
        disconnectedSide: 'white',
        detail: 'White disconnected and did not reconnect within 20 seconds.',
      });
    });

    expect(mockSetResult).toHaveBeenCalledWith({
      winner: 'b',
      reason: 'disconnection',
      detail: 'White disconnected and did not reconnect within 20 seconds.',
    });
  });

  it('does not show countdown banner when no timeoutSeconds provided', () => {
    mockGameState = makeGameState();

    render(
      <OnlineGameScreen
        config={reportConfig}
        roomCode="TEST"
        playerColor="w"
        opponentName="Opponent"
        onLeaveGame={vi.fn()}
      />,
    );

    act(() => {
      capturedCallbacks.onOpponentDisconnected?.({ userId: 'opp-id', timeoutSeconds: 0 });
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });
});
