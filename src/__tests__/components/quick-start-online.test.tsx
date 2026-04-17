import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QuickStartScreen } from '../../components/QuickStartScreen';

// ── Connected mode tests ─────────────────────────────────────────────

describe('QuickStartScreen (connected mode, online checkbox)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('shows Play Online checkbox when HvH is selected in connected mode', async () => {
    vi.doMock('../../config/deployMode', () => ({
      DEPLOY_MODE: 'connected',
      isConnectedMode: true,
      isStaticMode: false,
    }));
    const { QuickStartScreen: QS } = await import('../../components/QuickStartScreen');
    const onStartGame = vi.fn();
    render(<QS onStartGame={onStartGame} />);

    expect(screen.getByLabelText(/Play Online/i)).toBeInTheDocument();
  });

  it('hides Play Online checkbox when mode is not HvH', async () => {
    vi.doMock('../../config/deployMode', () => ({
      DEPLOY_MODE: 'connected',
      isConnectedMode: true,
      isStaticMode: false,
    }));
    const { QuickStartScreen: QS } = await import('../../components/QuickStartScreen');
    const onStartGame = vi.fn();
    render(<QS onStartGame={onStartGame} />);

    // Switch to hvbot mode
    fireEvent.change(screen.getByLabelText(/Player Mode/i), { target: { value: 'hvbot' } });
    expect(screen.queryByLabelText(/Play Online/i)).not.toBeInTheDocument();
  });

  it('passes isOnline=true when online checkbox is checked and HvH is selected', async () => {
    vi.doMock('../../config/deployMode', () => ({
      DEPLOY_MODE: 'connected',
      isConnectedMode: true,
      isStaticMode: false,
    }));
    const { QuickStartScreen: QS } = await import('../../components/QuickStartScreen');
    const onStartGame = vi.fn();
    render(<QS onStartGame={onStartGame} />);

    // Online checkbox should be checked by default in connected mode
    const checkbox = screen.getByLabelText(/Play Online/i) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    fireEvent.click(screen.getByText('▶ Start Game'));
    expect(onStartGame).toHaveBeenCalledWith(expect.any(Object), true);
  });

  it('passes isOnline=undefined when online checkbox is unchecked', async () => {
    vi.doMock('../../config/deployMode', () => ({
      DEPLOY_MODE: 'connected',
      isConnectedMode: true,
      isStaticMode: false,
    }));
    const { QuickStartScreen: QS } = await import('../../components/QuickStartScreen');
    const onStartGame = vi.fn();
    render(<QS onStartGame={onStartGame} />);

    // Uncheck the online checkbox
    const checkbox = screen.getByLabelText(/Play Online/i) as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);

    fireEvent.click(screen.getByText('▶ Start Game'));
    expect(onStartGame).toHaveBeenCalledWith(expect.any(Object), undefined);
  });
});

// ── Static mode tests ────────────────────────────────────────────────

describe('QuickStartScreen (static mode)', () => {
  it('does not show Play Online checkbox in static mode', () => {
    // Default is static mode
    const onStartGame = vi.fn();
    render(<QuickStartScreen onStartGame={onStartGame} />);

    expect(screen.queryByLabelText(/Play Online/i)).not.toBeInTheDocument();
  });

  it('passes undefined isOnline in static mode', () => {
    const onStartGame = vi.fn();
    render(<QuickStartScreen onStartGame={onStartGame} />);

    fireEvent.click(screen.getByText('▶ Start Game'));
    expect(onStartGame).toHaveBeenCalledWith(expect.any(Object), undefined);
  });
});
