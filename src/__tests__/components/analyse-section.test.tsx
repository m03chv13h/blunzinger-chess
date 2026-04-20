import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AnalyseSection } from '../../components/AnalyseSection';
import type { GameRecord } from '../../core/gameRecord';
import type { SimulationRecord } from '../../core/gameRecord';
import { DEFAULT_SETUP_CONFIG } from '../../core/blunziger/types';
import type { GameSetupConfig, ScoreState } from '../../core/blunziger/types';

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
    it('shows empty message when no simulations', () => {
      render(
        <AnalyseSection games={[]} simulations={[]} onSelectGame={() => {}} onStartAnalysis={() => {}} />,
      );
      expect(screen.getByText(/No simulations yet/)).toBeInTheDocument();
    });
  });

  describe('simulations only', () => {
    it('shows Simulations heading when simulations exist', () => {
      const sim = makeSimulationRecord();
      render(
        <AnalyseSection games={[]} simulations={[sim]} onSelectGame={() => {}} onStartAnalysis={() => {}} />,
      );
      expect(screen.getByText('🔬 Simulations')).toBeInTheDocument();
    });

    it('does not show Played Games heading when no played games', () => {
      const sim = makeSimulationRecord();
      render(
        <AnalyseSection games={[]} simulations={[sim]} onSelectGame={() => {}} onStartAnalysis={() => {}} />,
      );
      expect(screen.queryByText('🎮 Played Games')).not.toBeInTheDocument();
    });

    it('shows simulation standing info', () => {
      const sim = makeSimulationRecord({
        standing: { whiteWins: 5, blackWins: 3, draws: 2 },
      });
      render(
        <AnalyseSection games={[]} simulations={[sim]} onSelectGame={() => {}} onStartAnalysis={() => {}} />,
      );
      expect(screen.getByText('W 5')).toBeInTheDocument();
      expect(screen.getByText('B 3')).toBeInTheDocument();
      expect(screen.getByText('D 2')).toBeInTheDocument();
    });

    it('shows game count in simulation item', () => {
      const sim = makeSimulationRecord();
      render(
        <AnalyseSection games={[]} simulations={[sim]} onSelectGame={() => {}} onStartAnalysis={() => {}} />,
      );
      expect(screen.getByText(/3 games/)).toBeInTheDocument();
    });
  });

  describe('simulation drill-down', () => {
    it('clicking a simulation shows its individual games', () => {
      const sim = makeSimulationRecord();
      render(
        <AnalyseSection games={[]} simulations={[sim]} onSelectGame={() => {}} onStartAnalysis={() => {}} />,
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
        <AnalyseSection games={[]} simulations={[sim]} onSelectGame={() => {}} onStartAnalysis={() => {}} />,
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
        <AnalyseSection games={[]} simulations={[sim]} onSelectGame={onSelect} onStartAnalysis={() => {}} />,
      );

      fireEvent.click(screen.getByText(/3 games/));
      fireEvent.click(screen.getByText('Game #1'));
      expect(onSelect).toHaveBeenCalledWith(sim.games[0]);
    });
  });

  describe('mixed content', () => {
    it('shows simulations section when simulations exist (played games now in Games section)', () => {
      const game = makeGameRecord();
      const sim = makeSimulationRecord();
      render(
        <AnalyseSection
          games={[game]}
          simulations={[sim]}
          onSelectGame={() => {}} onStartAnalysis={() => {}}
        />,
      );
      expect(screen.queryByText('🎮 Played Games')).not.toBeInTheDocument();
      expect(screen.getByText('🔬 Simulations')).toBeInTheDocument();
    });
  });
});
