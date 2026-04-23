import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SimulationDetailView } from '../../components/SimulationDetailView';
import type { GameRecord, SimulationRecord } from '../../core/gameRecord';
import { DEFAULT_SETUP_CONFIG } from '../../core/blunziger/types';
import type { GameSetupConfig, ScoreState } from '../../core/blunziger/types';

function makeGameRecord(overrides: Partial<GameRecord> = {}): GameRecord {
  return {
    id: `game-${Date.now()}-${Math.random()}`,
    completedAt: Date.now(),
    config: { ...DEFAULT_SETUP_CONFIG, mode: 'botvbot' },
    result: { winner: 'w', reason: 'checkmate' },
    finalFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    moveCount: 20,
    scores: { w: 0, b: 0 } as ScoreState,
    positionHistory: [],
    moveHistory: [],
    violationReports: [],
    missedChecks: [],
    pieceRemovals: [],
    timeReductions: [],
    ...overrides,
  };
}

function makeSimulationRecord(overrides: Partial<SimulationRecord> = {}): SimulationRecord {
  const config: GameSetupConfig = {
    ...DEFAULT_SETUP_CONFIG,
    mode: 'botvbot',
    botDifficulty: 'easy',
  };
  const games = [
    makeGameRecord({ id: 'sim-g1', config: { ...config }, result: { winner: 'w', reason: 'checkmate' } }),
    makeGameRecord({ id: 'sim-g2', config: { ...config }, result: { winner: 'b', reason: 'checkmate' } }),
    makeGameRecord({ id: 'sim-g3', config: { ...config }, result: { winner: 'draw', reason: 'draw', detail: 'Stalemate' } }),
  ];
  return {
    id: `sim-${Date.now()}`,
    completedAt: Date.now(),
    config,
    games,
    standing: { whiteWins: 1, blackWins: 1, draws: 1 },
    ...overrides,
  };
}

describe('SimulationDetailView', () => {
  it('shows simulation games heading', () => {
    const sim = makeSimulationRecord();
    render(
      <SimulationDetailView simulation={sim} onSelectGame={() => {}} onBack={() => {}} />,
    );
    expect(screen.getByText('🔬 Simulation Games')).toBeInTheDocument();
  });

  it('shows back button', () => {
    const sim = makeSimulationRecord();
    render(
      <SimulationDetailView simulation={sim} onSelectGame={() => {}} onBack={() => {}} />,
    );
    expect(screen.getByText('← Back to Simulations')).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', () => {
    const sim = makeSimulationRecord();
    const onBack = vi.fn();
    render(
      <SimulationDetailView simulation={sim} onSelectGame={() => {}} onBack={onBack} />,
    );
    fireEvent.click(screen.getByText('← Back to Simulations'));
    expect(onBack).toHaveBeenCalled();
  });

  it('shows config summary tags', () => {
    const sim = makeSimulationRecord();
    render(
      <SimulationDetailView simulation={sim} onSelectGame={() => {}} onBack={() => {}} />,
    );
    expect(screen.getByText('Game Details')).toBeInTheDocument();
    // Variant label appears in details table and per-game entries
    const variantLabels = screen.getAllByText('Classic Blunzinger');
    expect(variantLabels.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Report Incorrectness')).toBeInTheDocument();
  });

  it('shows standing info', () => {
    const sim = makeSimulationRecord({
      standing: { whiteWins: 5, blackWins: 3, draws: 2 },
    });
    render(
      <SimulationDetailView simulation={sim} onSelectGame={() => {}} onBack={() => {}} />,
    );
    expect(screen.getByText('W 5 · B 3 · D 2')).toBeInTheDocument();
  });

  it('shows game count', () => {
    const sim = makeSimulationRecord();
    render(
      <SimulationDetailView simulation={sim} onSelectGame={() => {}} onBack={() => {}} />,
    );
    expect(screen.getByText(/3 games/)).toBeInTheDocument();
  });

  it('shows individual games', () => {
    const sim = makeSimulationRecord();
    render(
      <SimulationDetailView simulation={sim} onSelectGame={() => {}} onBack={() => {}} />,
    );
    expect(screen.getByText('Game #1')).toBeInTheDocument();
    expect(screen.getByText('Game #2')).toBeInTheDocument();
    expect(screen.getByText('Game #3')).toBeInTheDocument();
  });

  it('calls onSelectGame when clicking a game', () => {
    const sim = makeSimulationRecord();
    const onSelect = vi.fn();
    render(
      <SimulationDetailView simulation={sim} onSelectGame={onSelect} onBack={() => {}} />,
    );
    fireEvent.click(screen.getByText('Game #1'));
    expect(onSelect).toHaveBeenCalledWith(sim.games[0]);
  });

  it('shows move count for each game', () => {
    const sim = makeSimulationRecord();
    render(
      <SimulationDetailView simulation={sim} onSelectGame={() => {}} onBack={() => {}} />,
    );
    const moveLabels = screen.getAllByText('20 moves');
    expect(moveLabels.length).toBe(3);
  });
});
