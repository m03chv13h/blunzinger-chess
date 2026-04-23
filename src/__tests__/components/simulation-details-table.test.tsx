import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SimulationDetailsTable } from '../../components/SimulationDetailsTable';
import { DEFAULT_SETUP_CONFIG } from '../../core/blunziger/types';
import type { GameSetupConfig } from '../../core/blunziger/types';

function makeConfig(overrides: Partial<GameSetupConfig> = {}): GameSetupConfig {
  return {
    ...DEFAULT_SETUP_CONFIG,
    mode: 'botvbot',
    botDifficulty: 'easy',
    botDifficultyWhite: 'easy',
    botDifficultyBlack: 'easy',
    ...overrides,
  };
}

describe('SimulationDetailsTable', () => {
  it('renders the heading', () => {
    render(<SimulationDetailsTable config={makeConfig()} />);
    expect(screen.getByText('Game Details')).toBeInTheDocument();
  });

  it('shows variant mode', () => {
    render(<SimulationDetailsTable config={makeConfig()} />);
    expect(screen.getByText('Variant Mode')).toBeInTheDocument();
    expect(screen.getByText('Classic Blunzinger')).toBeInTheDocument();
  });

  it('shows game type', () => {
    render(<SimulationDetailsTable config={makeConfig()} />);
    expect(screen.getByText('Game Type')).toBeInTheDocument();
    expect(screen.getByText('Report Incorrectness')).toBeInTheDocument();
  });

  it('shows penalty game type', () => {
    render(<SimulationDetailsTable config={makeConfig({ gameType: 'penalty_on_miss' })} />);
    expect(screen.getByText('Penalty on Miss')).toBeInTheDocument();
  });

  it('shows bot difficulty for white and black', () => {
    render(<SimulationDetailsTable config={makeConfig({ botDifficultyWhite: 'hard', botDifficultyBlack: 'medium' })} />);
    expect(screen.getByText('Bot Difficulty (White)')).toBeInTheDocument();
    expect(screen.getByText('Hard')).toBeInTheDocument();
    expect(screen.getByText('Bot Difficulty (Black)')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('shows engine names', () => {
    render(<SimulationDetailsTable config={makeConfig()} />);
    expect(screen.getByText('Engine (White)')).toBeInTheDocument();
    expect(screen.getByText('Engine (Black)')).toBeInTheDocument();
  });

  it('shows overlays as off by default', () => {
    render(<SimulationDetailsTable config={makeConfig()} />);
    expect(screen.getByText('King of the Hill')).toBeInTheDocument();
    expect(screen.getByText('Double Check Pressure')).toBeInTheDocument();
    expect(screen.getByText('Crazyhouse')).toBeInTheDocument();
    expect(screen.getByText('Chess960')).toBeInTheDocument();
    expect(screen.getByText('Atomic Chess')).toBeInTheDocument();
    // All should show 'Off' by default
    const offValues = screen.getAllByText('Off');
    expect(offValues.length).toBeGreaterThanOrEqual(5);
  });

  it('shows overlay as on when enabled', () => {
    render(<SimulationDetailsTable config={makeConfig({ enableKingOfTheHill: true })} />);
    const onValues = screen.getAllByText('On');
    expect(onValues.length).toBeGreaterThanOrEqual(1);
  });

  it('shows clock as off when disabled', () => {
    render(<SimulationDetailsTable config={makeConfig()} />);
    expect(screen.getByText('Clock')).toBeInTheDocument();
    // Clock value should be 'Off'
    const offValues = screen.getAllByText('Off');
    expect(offValues.length).toBeGreaterThanOrEqual(1);
  });

  it('shows clock time when enabled', () => {
    render(<SimulationDetailsTable config={makeConfig({ enableClock: true, initialTimeMs: 300000 })} />);
    expect(screen.getByText('05:00')).toBeInTheDocument();
  });

  it('shows increment when clock is enabled and increment > 0', () => {
    render(<SimulationDetailsTable config={makeConfig({ enableClock: true, incrementMs: 5000 })} />);
    expect(screen.getByText('Increment')).toBeInTheDocument();
    expect(screen.getByText('00:05')).toBeInTheDocument();
  });

  it('hides increment when clock is disabled', () => {
    render(<SimulationDetailsTable config={makeConfig({ enableClock: false, incrementMs: 5000 })} />);
    expect(screen.queryByText('Increment')).not.toBeInTheDocument();
  });

  it('shows decrement when clock is enabled and decrement > 0', () => {
    render(<SimulationDetailsTable config={makeConfig({ enableClock: true, decrementMs: 3000 })} />);
    expect(screen.getByText('Decrement')).toBeInTheDocument();
    expect(screen.getByText('00:03')).toBeInTheDocument();
  });

  it('shows invalid report threshold for report game type', () => {
    render(<SimulationDetailsTable config={makeConfig({ invalidReportLossThreshold: 3 })} />);
    expect(screen.getByText('Invalid Report Threshold')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('hides invalid report threshold for penalty game type', () => {
    render(<SimulationDetailsTable config={makeConfig({ gameType: 'penalty_on_miss' })} />);
    expect(screen.queryByText('Invalid Report Threshold')).not.toBeInTheDocument();
  });

  it('shows penalties when penalty game type with active penalties', () => {
    render(<SimulationDetailsTable config={makeConfig({
      gameType: 'penalty_on_miss',
      enableAdditionalMovePenalty: true,
      additionalMoveCount: 2,
      enablePieceRemovalPenalty: true,
      pieceRemovalCount: 1,
    })} />);
    expect(screen.getByText('Penalties')).toBeInTheDocument();
    expect(screen.getByText('Additional move: 2, Piece removal: 1')).toBeInTheDocument();
  });

  it('shows ply limit for king hunt move limit variant', () => {
    render(<SimulationDetailsTable config={makeConfig({
      variantMode: 'classic_king_hunt_move_limit',
      kingHuntPlyLimit: 50,
    })} />);
    expect(screen.getByText('Ply Limit')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('shows given check target for king hunt check limit variant', () => {
    render(<SimulationDetailsTable config={makeConfig({
      variantMode: 'classic_king_hunt_given_check_limit',
      kingHuntGivenCheckTarget: 10,
    })} />);
    expect(screen.getByText('Given Check Target')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('shows reverse blunzinger variant', () => {
    render(<SimulationDetailsTable config={makeConfig({ variantMode: 'reverse_blunzinger' })} />);
    expect(screen.getByText('Reverse Blunzinger')).toBeInTheDocument();
  });
});
