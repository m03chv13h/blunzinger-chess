import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock useAuth with an authenticated user.
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { userId: 'test', displayName: 'Test', isGuest: true, provider: 'guest' },
    loading: false,
    error: null,
    availableProviders: [],
    loginAsGuest: vi.fn(),
    loginWithProvider: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe('URL navigation', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('sets hash to #/quick-start on initial render', async () => {
    const App = (await import('../../App')).default;
    render(<App />);
    expect(window.location.hash).toBe('#/quick-start');
  });

  it('updates hash when navigating to Rules', async () => {
    const App = (await import('../../App')).default;
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Rules/i }));
    expect(window.location.hash).toBe('#/rules');
  });

  it('updates hash when navigating to New Game', async () => {
    const App = (await import('../../App')).default;
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /New Game/i }));
    expect(window.location.hash).toBe('#/new-game');
  });

  it('updates hash when navigating to Analyse', async () => {
    const App = (await import('../../App')).default;
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Analyse/i }));
    expect(window.location.hash).toBe('#/analyse');
  });

  it('updates hash when navigating to Simulate', async () => {
    const App = (await import('../../App')).default;
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Simulate/i }));
    expect(window.location.hash).toBe('#/simulate');
  });

  it('updates hash when navigating to Games', async () => {
    const App = (await import('../../App')).default;
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Games/i }));
    expect(window.location.hash).toBe('#/games');
  });

  it('restores screen from hash on initial render', async () => {
    window.location.hash = '#/rules';
    const App = (await import('../../App')).default;
    render(<App />);
    expect(screen.getByText('📖 Rules')).toBeInTheDocument();
  });

  it('restores New Game screen from hash', async () => {
    window.location.hash = '#/new-game';
    const App = (await import('../../App')).default;
    render(<App />);
    expect(screen.getByText('♟ New Game Setup')).toBeInTheDocument();
  });

  it('restores Simulate screen from hash', async () => {
    window.location.hash = '#/simulate';
    const App = (await import('../../App')).default;
    render(<App />);
    expect(screen.getByText('🔬 Simulation Setup')).toBeInTheDocument();
  });
});
