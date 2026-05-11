import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OnlineScreen } from '../../components/OnlineScreen';

// Force connected mode for all online-screen tests.
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
  createRoom: vi.fn(),
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
  mockLobby.rooms = [];
  mockLobby.loading = false;
  mockLobby.error = null;
  mockLobby.activeRoom = null;
  mockLobby.matchmaking = false;
  mockHub.connected = true;
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Tests ────────────────────────────────────────────────────────────

describe('OnlineScreen (unauthenticated)', () => {
  it('shows sign-in prompt when not authenticated', () => {
    render(<OnlineScreen authenticated={false} />);
    expect(screen.getByText(/Lobby \(join online Game\)/)).toBeInTheDocument();
    expect(screen.getByText(/Sign in to play online/)).toBeInTheDocument();
  });

  it('does not show join controls when unauthenticated', () => {
    render(<OnlineScreen authenticated={false} />);
    expect(screen.queryByText('Join a Room')).not.toBeInTheDocument();
  });
});

describe('OnlineScreen (authenticated, lobby view)', () => {
  it('renders join room section and open rooms', () => {
    render(<OnlineScreen authenticated={true} />);
    expect(screen.getByText('Join a Room')).toBeInTheDocument();
    expect(screen.getByText('Open Rooms')).toBeInTheDocument();
  });

  it('does not render create room section', () => {
    render(<OnlineScreen authenticated={true} />);
    expect(screen.queryByText('Create a Room')).not.toBeInTheDocument();
    expect(screen.queryByText('➕ Create Room')).not.toBeInTheDocument();
  });

  it('shows connection status', () => {
    render(<OnlineScreen authenticated={true} />);
    expect(screen.getByText('Connected to server')).toBeInTheDocument();
  });

  it('shows disconnected status when hub is not connected', () => {
    mockHub.connected = false;
    render(<OnlineScreen authenticated={true} />);
    expect(screen.getByText('Connecting…')).toBeInTheDocument();
  });

  it('has a room code input field', () => {
    render(<OnlineScreen authenticated={true} />);
    expect(screen.getByLabelText('Room code')).toBeInTheDocument();
  });

  it('disables join button when input is empty', () => {
    render(<OnlineScreen authenticated={true} />);
    expect(screen.getByRole('button', { name: 'Join' })).toBeDisabled();
  });

  it('enables join button when code is entered', () => {
    render(<OnlineScreen authenticated={true} />);
    fireEvent.change(screen.getByLabelText('Room code'), { target: { value: 'ABC' } });
    expect(screen.getByRole('button', { name: 'Join' })).toBeEnabled();
  });

  it('calls joinRoom when join button is clicked', () => {
    mockLobby.joinRoom.mockResolvedValue({ roomId: 'r2', code: 'XYZ' });
    render(<OnlineScreen authenticated={true} />);
    fireEvent.change(screen.getByLabelText('Room code'), { target: { value: 'xyz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(mockLobby.joinRoom).toHaveBeenCalledWith('XYZ');
  });

  it('shows empty room list message', () => {
    render(<OnlineScreen authenticated={true} />);
    expect(screen.getByText('No open rooms available.')).toBeInTheDocument();
  });

  it('renders rooms in the list', () => {
    mockLobby.rooms = [
      { id: 'r1', code: 'ABC', matchConfig: '{}', createdAt: '2024-01-01', hostName: 'Alice' },
      { id: 'r2', code: 'DEF', matchConfig: '{}', createdAt: '2024-01-02', hostName: 'Bob' },
    ];
    render(<OnlineScreen authenticated={true} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('ABC')).toBeInTheDocument();
    expect(screen.getByText('DEF')).toBeInTheDocument();
  });

  it('calls refreshRooms on mount', () => {
    render(<OnlineScreen authenticated={true} />);
    expect(mockLobby.refreshRooms).toHaveBeenCalled();
  });

  it('auto-refreshes rooms every 5 seconds', () => {
    vi.useFakeTimers();
    render(<OnlineScreen authenticated={true} />);
    // Called once on mount.
    expect(mockLobby.refreshRooms).toHaveBeenCalledTimes(1);
    // Advance by 5 seconds – should trigger a second call.
    vi.advanceTimersByTime(5000);
    expect(mockLobby.refreshRooms).toHaveBeenCalledTimes(2);
    // Advance another 5 seconds – third call.
    vi.advanceTimersByTime(5000);
    expect(mockLobby.refreshRooms).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it('stops auto-refresh on unmount', () => {
    vi.useFakeTimers();
    const { unmount } = render(<OnlineScreen authenticated={true} />);
    expect(mockLobby.refreshRooms).toHaveBeenCalledTimes(1);
    unmount();
    vi.advanceTimersByTime(10000);
    // No additional calls after unmount.
    expect(mockLobby.refreshRooms).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('shows error message when present', () => {
    mockLobby.error = 'Room not found';
    render(<OnlineScreen authenticated={true} />);
    expect(screen.getByText('Room not found')).toBeInTheDocument();
  });
});

describe('OnlineScreen (active room)', () => {
  beforeEach(() => {
    mockLobby.activeRoom = { roomId: 'r1', code: 'ABC123' };
  });

  it('shows the room code when active', () => {
    render(<OnlineScreen authenticated={true} />);
    expect(screen.getByText('ABC123')).toBeInTheDocument();
  });

  it('shows waiting message', () => {
    render(<OnlineScreen authenticated={true} />);
    expect(screen.getByText(/Waiting for opponent/)).toBeInTheDocument();
  });

  it('shows leave room button', () => {
    render(<OnlineScreen authenticated={true} />);
    expect(screen.getByText('Leave Room')).toBeInTheDocument();
  });

  it('calls leaveRoom and clearActiveRoom when leaving', async () => {
    render(<OnlineScreen authenticated={true} />);
    fireEvent.click(screen.getByText('Leave Room'));
    expect(mockHub.leaveRoom).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockLobby.clearActiveRoom).toHaveBeenCalled();
    });
  });
});
