import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WelcomeScreen } from '../../components/WelcomeScreen';
import type { OAuthProvider } from '../../services/authService';

// Force connected mode so the App-level tests see the welcome screen.
vi.mock('../../config/deployMode', () => ({
  DEPLOY_MODE: 'connected',
  isConnectedMode: true,
  isStaticMode: false,
}));

// Mock useAuth so the App-level tests in this file show the welcome screen (no user).
const mockLoginAsGuest = vi.fn();
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: undefined,
    loading: false,
    error: null,
    availableProviders: [],
    loginAsGuest: mockLoginAsGuest,
    loginWithProvider: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe('WelcomeScreen', () => {
  const defaultProps = {
    availableProviders: [] as OAuthProvider[],
    loading: false,
    error: null,
    onLoginWithProvider: vi.fn(),
    onContinueAsGuest: vi.fn(),
  };

  it('renders the title and subtitle', () => {
    render(<WelcomeScreen {...defaultProps} />);
    expect(screen.getByText('Blunziger Chess')).toBeInTheDocument();
    expect(screen.getByText('A chess variant where every check counts.')).toBeInTheDocument();
  });

  it('renders Continue as Guest button', () => {
    render(<WelcomeScreen {...defaultProps} />);
    expect(screen.getByText('▶ Continue as Guest')).toBeInTheDocument();
  });

  it('calls onContinueAsGuest when clicking the guest button', () => {
    const onGuest = vi.fn();
    render(<WelcomeScreen {...defaultProps} onContinueAsGuest={onGuest} />);
    fireEvent.click(screen.getByText('▶ Continue as Guest'));
    expect(onGuest).toHaveBeenCalledOnce();
  });

  it('renders OAuth provider buttons when available', () => {
    render(
      <WelcomeScreen
        {...defaultProps}
        availableProviders={['Google', 'GitHub']}
      />,
    );
    expect(screen.getByRole('button', { name: /Sign in with Google/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign in with GitHub/ })).toBeInTheDocument();
  });

  it('calls onLoginWithProvider with the correct provider', () => {
    const onLogin = vi.fn();
    render(
      <WelcomeScreen
        {...defaultProps}
        availableProviders={['GitHub']}
        onLoginWithProvider={onLogin}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Sign in with GitHub/ }));
    expect(onLogin).toHaveBeenCalledWith('GitHub');
  });

  it('does not render OAuth buttons when no providers are available', () => {
    render(<WelcomeScreen {...defaultProps} availableProviders={[]} />);
    expect(screen.queryByText('Sign in to play online')).not.toBeInTheDocument();
    expect(screen.queryByText('or')).not.toBeInTheDocument();
  });

  it('shows the divider when providers are available', () => {
    render(
      <WelcomeScreen {...defaultProps} availableProviders={['Google']} />,
    );
    expect(screen.getByText('or')).toBeInTheDocument();
  });

  it('disables buttons when loading', () => {
    render(
      <WelcomeScreen
        {...defaultProps}
        loading={true}
        availableProviders={['Google']}
      />,
    );
    expect(screen.getByText('▶ Continue as Guest')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Sign in with Google/ })).toBeDisabled();
  });

  it('shows loading message when loading', () => {
    render(<WelcomeScreen {...defaultProps} loading={true} />);
    expect(screen.getByText('Signing in…')).toBeInTheDocument();
  });

  it('shows error message', () => {
    render(<WelcomeScreen {...defaultProps} error="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('does not show error when there is none', () => {
    render(<WelcomeScreen {...defaultProps} error={null} />);
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });
});

describe('App starts on welcome screen', () => {
  it('shows the welcome screen on first load', async () => {
    const App = (await import('../../App')).default;
    render(<App />);
    expect(screen.getByText('Blunziger Chess')).toBeInTheDocument();
    expect(screen.getByText('▶ Continue as Guest')).toBeInTheDocument();
  });

  it('navigates to quick-start after clicking Continue as Guest', async () => {
    const App = (await import('../../App')).default;
    render(<App />);
    fireEvent.click(screen.getByText('▶ Continue as Guest'));
    expect(screen.getByText('⚡ Quick Start')).toBeInTheDocument();
  });

  it('calls loginAsGuest when clicking Continue as Guest', async () => {
    mockLoginAsGuest.mockClear();
    const App = (await import('../../App')).default;
    render(<App />);
    fireEvent.click(screen.getByText('▶ Continue as Guest'));
    expect(mockLoginAsGuest).toHaveBeenCalledOnce();
  });
});
