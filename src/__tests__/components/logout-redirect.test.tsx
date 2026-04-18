import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Force connected mode so the welcome screen renders on logout.
vi.mock('../../config/deployMode', () => ({
  DEPLOY_MODE: 'connected',
  isConnectedMode: true,
  isStaticMode: false,
}));

// Mock lobbyService to avoid real network calls during active-game check.
vi.mock('../../services/lobbyService', () => ({
  getActiveRoom: vi.fn().mockResolvedValue({ active: false }),
  createRoom: vi.fn(),
  joinRoom: vi.fn(),
  listRooms: vi.fn().mockResolvedValue({ rooms: [] }),
  joinMatchmaking: vi.fn(),
  cancelMatchmaking: vi.fn(),
}));

// Mutable auth state so we can simulate logout mid-test.
let mockUser: { userId: string; displayName: string; isGuest: boolean; provider: string } | undefined = {
  userId: 'test',
  displayName: 'TestUser',
  isGuest: true,
  provider: 'guest',
};
const mockLogout = vi.fn(() => {
  mockUser = undefined;
});
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    error: null,
    availableProviders: [],
    loginAsGuest: vi.fn(),
    loginWithProvider: vi.fn(),
    logout: mockLogout,
  }),
}));

describe('Logout redirect', () => {
  beforeEach(() => {
    mockUser = { userId: 'test', displayName: 'TestUser', isGuest: true, provider: 'guest' };
    mockLogout.mockClear();
  });

  it('redirects to welcome screen after signing out', async () => {
    const App = (await import('../../App')).default;
    const { rerender } = render(<App />);

    // Should be on the main screen (not welcome) since user is authenticated.
    // The active-game check is async, so wait for the screen to update.
    await waitFor(() => {
      expect(screen.getByText('⚡ Quick Start')).toBeInTheDocument();
    });
    expect(screen.queryByText('▶ Continue as Guest')).not.toBeInTheDocument();

    // Click the Sign out button in the sidebar.
    fireEvent.click(screen.getByText('Sign out'));
    expect(mockLogout).toHaveBeenCalledOnce();

    // Re-render to reflect the updated mock state (user is now undefined).
    rerender(<App />);

    // Should now show the welcome/login screen.
    expect(screen.getByText('▶ Continue as Guest')).toBeInTheDocument();
  });
});
