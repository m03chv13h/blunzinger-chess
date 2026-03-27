import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AnalyseSection } from '../components/AnalyseSection';
import type { GameRecord } from '../core/gameRecord';
import type { SimulationRecord } from '../core/gameRecord';
import { DEFAULT_SETUP_CONFIG } from '../core/blunziger/types';
import type { GameSetupConfig, ScoreState } from '../core/blunziger/types';

function makeGameRecord(overrides: Partial<GameRecord> = {}): GameRecord {
  return {
    id: `game-${Date.now()}-${Math.random()}`,
    completedAt: Date.now(),
    config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvh' },
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

describe('AnalyseSection', () => {
  describe('empty state', () => {
    it('shows empty message when no games or simulations', () => {
      render(
        <AnalyseSection games={[]} simulations={[]} onSelectGame={() => {}} />,
      );
      expect(screen.getByText(/No games played yet/)).toBeInTheDocument();
    });
  });

  describe('played games only', () => {
    it('shows Played Games heading when games exist', () => {
      const games = [makeGameRecord()];
      render(
        <AnalyseSection games={games} simulations={[]} onSelectGame={() => {}} />,
      );
      expect(screen.getByText('🎮 Played Games')).toBeInTheDocument();
    });

    it('does not show Simulations heading when no simulations', () => {
      const games = [makeGameRecord()];
      render(
        <AnalyseSection games={games} simulations={[]} onSelectGame={() => {}} />,
      );
      expect(screen.queryByText('🔬 Simulations')).not.toBeInTheDocument();
    });

    it('calls onSelectGame when a played game is clicked', () => {
      const game = makeGameRecord();
      const onSelect = vi.fn();
      render(
        <AnalyseSection games={[game]} simulations={[]} onSelectGame={onSelect} />,
      );
      fireEvent.click(screen.getByText('White wins'));
      expect(onSelect).toHaveBeenCalledWith(game);
    });
  });

  describe('simulations only', () => {
    it('shows Simulations heading when simulations exist', () => {
      const sim = makeSimulationRecord();
      render(
        <AnalyseSection games={[]} simulations={[sim]} onSelectGame={() => {}} />,
      );
      expect(screen.getByText('🔬 Simulations')).toBeInTheDocument();
    });

    it('does not show Played Games heading when no played games', () => {
      const sim = makeSimulationRecord();
      render(
        <AnalyseSection games={[]} simulations={[sim]} onSelectGame={() => {}} />,
      );
      expect(screen.queryByText('🎮 Played Games')).not.toBeInTheDocument();
    });

    it('shows simulation standing info', () => {
      const sim = makeSimulationRecord({
        standing: { whiteWins: 5, blackWins: 3, draws: 2 },
      });
      render(
        <AnalyseSection games={[]} simulations={[sim]} onSelectGame={() => {}} />,
      );
      expect(screen.getByText('W 5')).toBeInTheDocument();
      expect(screen.getByText('B 3')).toBeInTheDocument();
      expect(screen.getByText('D 2')).toBeInTheDocument();
    });

    it('shows game count in simulation item', () => {
      const sim = makeSimulationRecord();
      render(
        <AnalyseSection games={[]} simulations={[sim]} onSelectGame={() => {}} />,
      );
      expect(screen.getByText(/3 games/)).toBeInTheDocument();
    });
  });

  describe('simulation drill-down', () => {
    it('clicking a simulation shows its individual games', () => {
      const sim = makeSimulationRecord();
      render(
        <AnalyseSection games={[]} simulations={[sim]} onSelectGame={() => {}} />,
      );

      // Click on the simulation
      fireEvent.click(screen.getByText(/3 games/));

      // Should show drill-down view
      expect(screen.getByText('🔬 Simulation Games')).toBeInTheDocument();
      expect(screen.getByText('← Back to overview')).toBeInTheDocument();
      // Should show individual games
      expect(screen.getByText('Game #1')).toBeInTheDocument();
      expect(screen.getByText('Game #2')).toBeInTheDocument();
      expect(screen.getByText('Game #3')).toBeInTheDocument();
    });

    it('back button returns to overview', () => {
      const sim = makeSimulationRecord();
      render(
        <AnalyseSection games={[]} simulations={[sim]} onSelectGame={() => {}} />,
      );

      fireEvent.click(screen.getByText(/3 games/));
      expect(screen.getByText('🔬 Simulation Games')).toBeInTheDocument();

      fireEvent.click(screen.getByText('← Back to overview'));
      expect(screen.getByText('📊 Analyse')).toBeInTheDocument();
      expect(screen.queryByText('🔬 Simulation Games')).not.toBeInTheDocument();
    });

    it('clicking a game in drill-down calls onSelectGame', () => {
      const sim = makeSimulationRecord();
      const onSelect = vi.fn();
      render(
        <AnalyseSection games={[]} simulations={[sim]} onSelectGame={onSelect} />,
      );

      fireEvent.click(screen.getByText(/3 games/));
      fireEvent.click(screen.getByText('Game #1'));
      expect(onSelect).toHaveBeenCalledWith(sim.games[0]);
    });
  });

  describe('mixed content', () => {
    it('shows both sections when games and simulations exist', () => {
      const game = makeGameRecord();
      const sim = makeSimulationRecord();
      render(
        <AnalyseSection
          games={[game]}
          simulations={[sim]}
          onSelectGame={() => {}}
        />,
      );
      expect(screen.getByText('🎮 Played Games')).toBeInTheDocument();
      expect(screen.getByText('🔬 Simulations')).toBeInTheDocument();
    });
  });
});
