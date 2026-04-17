import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OnlineLobbyScreen } from '../../components/OnlineLobbyScreen';
import { DEFAULT_SETUP_CONFIG } from '../../core/blunziger/types';

// Force connected mode for lobby tests.
vi.mock('../../config/deployMode', () => ({
  DEPLOY_MODE: 'connected',
  isConnectedMode: true,
  isStaticMode: false,
}));

// ── Mocks ────────────────────────────────────────────────────────────

const mockLobby = {
  rooms: [] as Array<{ id: string; code: string; matchConfig: string; createdAt: string; hostName: string }>,
  loading: false,
  error: null as string | null,
  activeRoom: null as { roomId: string; code: string } | null,
  matchmaking: false,
  refreshRooms: vi.fn(),
  createRoom: vi.fn().mockResolvedValue({ roomId: 'r1', code: 'TEST42' }),
  joinRoom: vi.fn(),
  joinMatchmaking: vi.fn(),
  cancelMatchmaking: vi.fn(),
  clearActiveRoom: vi.fn(),
};

const mockHub = {
  connected: true,
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  joinRoom: vi.fn().mockResolvedValue(undefined),
  leaveRoom: vi.fn().mockResolvedValue(undefined),
  makeMove: vi.fn().mockResolvedValue(undefined),
  makeDropMove: vi.fn().mockResolvedValue(undefined),
  reportViolation: vi.fn().mockResolvedValue(undefined),
  selectPieceForRemoval: vi.fn().mockResolvedValue(undefined),
  resignGame: vi.fn().mockResolvedValue(undefined),
  offerDraw: vi.fn().mockResolvedValue(undefined),
  acceptDraw: vi.fn().mockResolvedValue(undefined),
  sendMove: vi.fn().mockResolvedValue(undefined),
  sendDropMove: vi.fn().mockResolvedValue(undefined),
  sendReport: vi.fn().mockResolvedValue(undefined),
  sendPieceRemoval: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../../hooks/useLobby', () => ({
  useLobby: () => mockLobby,
}));

vi.mock('../../hooks/useGameHub', () => ({
  useGameHub: () => mockHub,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockLobby.loading = false;
  mockLobby.error = null;
  mockLobby.activeRoom = null;
  mockHub.connected = true;
});

// ── Tests ────────────────────────────────────────────────────────────

describe('OnlineLobbyScreen', () => {
  const config = { ...DEFAULT_SETUP_CONFIG };
  const onGameReady = vi.fn();
  const onCancel = vi.fn();

  it('renders the heading and waiting message', () => {
    render(
      <OnlineLobbyScreen
        config={config}
        authenticated={true}
        onGameReady={onGameReady}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText('🌐 Online Game')).toBeInTheDocument();
    expect(screen.getByText(/Waiting for an opponent/)).toBeInTheDocument();
  });

  it('shows connection status', () => {
    render(
      <OnlineLobbyScreen
        config={config}
        authenticated={true}
        onGameReady={onGameReady}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText('Connected to server')).toBeInTheDocument();
  });

  it('shows disconnected status when hub is not connected', () => {
    mockHub.connected = false;
    render(
      <OnlineLobbyScreen
        config={config}
        authenticated={true}
        onGameReady={onGameReady}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText('Connecting…')).toBeInTheDocument();
  });

  it('calls createRoom on mount when authenticated', () => {
    render(
      <OnlineLobbyScreen
        config={config}
        authenticated={true}
        onGameReady={onGameReady}
        onCancel={onCancel}
      />,
    );
    expect(mockLobby.createRoom).toHaveBeenCalledWith(JSON.stringify(config));
  });

  it('does not call createRoom when not authenticated', () => {
    render(
      <OnlineLobbyScreen
        config={config}
        authenticated={false}
        onGameReady={onGameReady}
        onCancel={onCancel}
      />,
    );
    expect(mockLobby.createRoom).not.toHaveBeenCalled();
  });

  it('has a cancel button that calls onCancel', async () => {
    render(
      <OnlineLobbyScreen
        config={config}
        authenticated={true}
        onGameReady={onGameReady}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByText('← Cancel'));
    // handleCancel is async — wait for it to complete
    await vi.waitFor(() => {
      expect(onCancel).toHaveBeenCalled();
    });
  });

  it('shows error when lobby has error', () => {
    mockLobby.error = 'Connection failed';
    render(
      <OnlineLobbyScreen
        config={config}
        authenticated={true}
        onGameReady={onGameReady}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });
});
