import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GameSummaryPanel } from '../components/GameSummaryPanel';
import type { GameSetupConfig } from '../core/blunziger/types';
import { DEFAULT_SETUP_CONFIG } from '../core/blunziger/types';

function makeConfig(overrides: Partial<GameSetupConfig> = {}): GameSetupConfig {
  return { ...DEFAULT_SETUP_CONFIG, ...overrides };
}

describe('GameSummaryPanel', () => {
  it('renders all overlay rows with defaults (all off)', () => {
    render(<GameSummaryPanel config={makeConfig()} />);
    expect(screen.getByText('King of the Hill')).toBeInTheDocument();
    expect(screen.getByText('Clock')).toBeInTheDocument();
    expect(screen.getByText('Double Check Pressure')).toBeInTheDocument();
    expect(screen.getByText('Crazyhouse')).toBeInTheDocument();
  });

  it('shows Clock as Off when disabled', () => {
    render(<GameSummaryPanel config={makeConfig({ enableClock: false })} />);
    const clockItem = screen.getByText('Clock').closest('.summary-item')!;
    expect(clockItem).toHaveTextContent('Off');
  });

  it('shows Clock time when enabled', () => {
    render(
      <GameSummaryPanel
        config={makeConfig({
          enableClock: true,
          initialTimeMs: 5 * 60 * 1000,
        })}
      />,
    );
    const clockItem = screen.getByText('Clock').closest('.summary-item')!;
    expect(clockItem).toHaveTextContent('05:00');
  });

  it('shows Increment when clock enabled and incrementMs > 0', () => {
    render(
      <GameSummaryPanel
        config={makeConfig({
          enableClock: true,
          initialTimeMs: 5 * 60 * 1000,
          incrementMs: 3000,
        })}
      />,
    );
    expect(screen.getByText('Increment')).toBeInTheDocument();
    const incItem = screen.getByText('Increment').closest('.summary-item')!;
    expect(incItem).toHaveTextContent('00:03');
  });

  it('hides Increment when incrementMs is 0', () => {
    render(
      <GameSummaryPanel
        config={makeConfig({
          enableClock: true,
          initialTimeMs: 5 * 60 * 1000,
          incrementMs: 0,
        })}
      />,
    );
    expect(screen.queryByText('Increment')).not.toBeInTheDocument();
  });

  it('hides Increment when clock is disabled', () => {
    render(
      <GameSummaryPanel
        config={makeConfig({
          enableClock: false,
          incrementMs: 3000,
        })}
      />,
    );
    expect(screen.queryByText('Increment')).not.toBeInTheDocument();
  });

  it('shows Decrement when clock enabled and decrementMs > 0', () => {
    render(
      <GameSummaryPanel
        config={makeConfig({
          enableClock: true,
          initialTimeMs: 5 * 60 * 1000,
          decrementMs: 5000,
        })}
      />,
    );
    expect(screen.getByText('Decrement')).toBeInTheDocument();
    const decItem = screen.getByText('Decrement').closest('.summary-item')!;
    expect(decItem).toHaveTextContent('00:05');
  });

  it('hides Decrement when decrementMs is 0', () => {
    render(
      <GameSummaryPanel
        config={makeConfig({
          enableClock: true,
          initialTimeMs: 5 * 60 * 1000,
          decrementMs: 0,
        })}
      />,
    );
    expect(screen.queryByText('Decrement')).not.toBeInTheDocument();
  });

  it('hides Decrement when clock is disabled', () => {
    render(
      <GameSummaryPanel
        config={makeConfig({
          enableClock: false,
          decrementMs: 5000,
        })}
      />,
    );
    expect(screen.queryByText('Decrement')).not.toBeInTheDocument();
  });

  it('shows Crazyhouse On when enabled', () => {
    render(<GameSummaryPanel config={makeConfig({ enableCrazyhouse: true })} />);
    const item = screen.getByText('Crazyhouse').closest('.summary-item')!;
    expect(item).toHaveTextContent('On');
  });

  it('shows Crazyhouse Off when disabled', () => {
    render(<GameSummaryPanel config={makeConfig({ enableCrazyhouse: false })} />);
    const item = screen.getByText('Crazyhouse').closest('.summary-item')!;
    expect(item).toHaveTextContent('Off');
  });

  it('shows all clock details together', () => {
    render(
      <GameSummaryPanel
        config={makeConfig({
          enableClock: true,
          initialTimeMs: 10 * 60 * 1000,
          incrementMs: 5000,
          decrementMs: 2000,
        })}
      />,
    );
    const clockItem = screen.getByText('Clock').closest('.summary-item')!;
    expect(clockItem).toHaveTextContent('10:00');
    const incItem = screen.getByText('Increment').closest('.summary-item')!;
    expect(incItem).toHaveTextContent('00:05');
    const decItem = screen.getByText('Decrement').closest('.summary-item')!;
    expect(decItem).toHaveTextContent('00:02');
  });
});
