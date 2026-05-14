import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SimulationsOverviewSection } from '../../components/SimulationsOverviewSection';
import type { SimulationListItem } from '../../services/simulationService';
import type { SimulationRecord } from '../../core/gameRecord';
import type { GameRecord } from '../../core/gameRecord';
import { DEFAULT_SETUP_CONFIG } from '../../core/blunzinger/types';
import type { ScoreState } from '../../core/blunzinger/types';

function makeRemoteItem(overrides: Partial<SimulationListItem> = {}): SimulationListItem {
  const config = { ...DEFAULT_SETUP_CONFIG, mode: 'botvbot' as const };
  return {
    id: `sim-${Date.now()}-${Math.random()}`,
    configJson: JSON.stringify(config),
    gameCount: 10,
    completedGames: 10,
    whiteWins: 5,
    blackWins: 3,
    draws: 2,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    status: 'completed',
    ...overrides,
  };
}

function makeGameRecord(): GameRecord {
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
  };
}

function makeLocalSimulation(overrides: Partial<SimulationRecord> = {}): SimulationRecord {
  return {
    id: `sim-local-${Date.now()}-${Math.random()}`,
    completedAt: Date.now(),
    config: { ...DEFAULT_SETUP_CONFIG, mode: 'botvbot', botDifficulty: 'easy' },
    games: [makeGameRecord(), makeGameRecord()],
    standing: { whiteWins: 1, blackWins: 0, draws: 1 },
    ...overrides,
  };
}

describe('SimulationsOverviewSection', () => {
  describe('empty state', () => {
    it('shows empty message when no simulations', () => {
      render(<SimulationsOverviewSection />);
      expect(screen.getByText('📋 Your Simulations')).toBeInTheDocument();
      expect(screen.getByText(/No simulations yet/)).toBeInTheDocument();
    });

    it('shows empty message with empty remote list', () => {
      render(<SimulationsOverviewSection remoteSimulations={[]} />);
      expect(screen.getByText(/No simulations yet/)).toBeInTheDocument();
    });

    it('shows empty message with empty local list', () => {
      render(<SimulationsOverviewSection localSimulations={[]} />);
      expect(screen.getByText(/No simulations yet/)).toBeInTheDocument();
    });
  });

  describe('remote simulations (connected mode)', () => {
    it('displays completed simulation item', () => {
      const item = makeRemoteItem();
      render(<SimulationsOverviewSection remoteSimulations={[item]} />);
      expect(screen.getByText('Classic Blunzinger')).toBeInTheDocument();
      expect(screen.getByText('W 5')).toBeInTheDocument();
      expect(screen.getByText('B 3')).toBeInTheDocument();
      expect(screen.getByText('D 2')).toBeInTheDocument();
      expect(screen.getByText(/10\/10 games/)).toBeInTheDocument();
    });

    it('displays running simulation with spinner and status', () => {
      const item = makeRemoteItem({
        status: 'running',
        completedGames: 3,
        gameCount: 10,
        completedAt: undefined,
      });
      render(<SimulationsOverviewSection remoteSimulations={[item]} />);
      expect(screen.getByText(/3\/10 games/)).toBeInTheDocument();
      expect(screen.getByText(/Running/)).toBeInTheDocument();
      expect(screen.getByTitle('Running')).toBeInTheDocument();
    });

    it('shows loading indicator', () => {
      render(<SimulationsOverviewSection remoteSimulations={[]} loading={true} />);
      expect(screen.getByText('Loading simulations…')).toBeInTheDocument();
    });

    it('shows error message', () => {
      render(
        <SimulationsOverviewSection
          remoteSimulations={[makeRemoteItem()]}
          error="Failed to load"
        />,
      );
      expect(screen.getByText('Failed to load')).toBeInTheDocument();
    });

    it('calls onSelectSimulation when clicking an item', () => {
      const item = makeRemoteItem({ id: 'test-sim-id' });
      const onSelect = vi.fn();
      render(
        <SimulationsOverviewSection
          remoteSimulations={[item]}
          onSelectSimulation={onSelect}
        />,
      );
      fireEvent.click(screen.getByText('Classic Blunzinger'));
      expect(onSelect).toHaveBeenCalledWith('test-sim-id');
    });

    it('shows multiple simulations', () => {
      const items = [
        makeRemoteItem({ id: 'sim-1', whiteWins: 7, blackWins: 2, draws: 1 }),
        makeRemoteItem({ id: 'sim-2', whiteWins: 3, blackWins: 5, draws: 2 }),
      ];
      render(<SimulationsOverviewSection remoteSimulations={items} />);
      expect(screen.getByText('W 7')).toBeInTheDocument();
      expect(screen.getByText('W 3')).toBeInTheDocument();
    });
  });

  describe('local simulations (static mode)', () => {
    it('displays local simulation records', () => {
      const sim = makeLocalSimulation();
      render(<SimulationsOverviewSection localSimulations={[sim]} />);
      expect(screen.getByText('Classic Blunzinger')).toBeInTheDocument();
      expect(screen.getByText('W 1')).toBeInTheDocument();
      expect(screen.getByText('D 1')).toBeInTheDocument();
      expect(screen.getByText(/2\/2 games/)).toBeInTheDocument();
    });
  });

  describe('pagination', () => {
    it('shows pagination when total exceeds page size', () => {
      const item = makeRemoteItem();
      render(
        <SimulationsOverviewSection
          remoteSimulations={[item]}
          page={1}
          total={30}
          pageSize={20}
          onPageChange={() => {}}
        />,
      );
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
      expect(screen.getByText('← Prev')).toBeDisabled();
      expect(screen.getByText('Next →')).not.toBeDisabled();
    });

    it('calls onPageChange when clicking Next', () => {
      const onPageChange = vi.fn();
      const item = makeRemoteItem();
      render(
        <SimulationsOverviewSection
          remoteSimulations={[item]}
          page={1}
          total={30}
          pageSize={20}
          onPageChange={onPageChange}
        />,
      );
      fireEvent.click(screen.getByText('Next →'));
      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('does not show pagination when total fits in one page', () => {
      const item = makeRemoteItem();
      render(
        <SimulationsOverviewSection
          remoteSimulations={[item]}
          page={1}
          total={5}
          pageSize={20}
          onPageChange={() => {}}
        />,
      );
      expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
    });
  });

  describe('details toggle', () => {
    it('shows info toggle button for each simulation', () => {
      const item = makeRemoteItem();
      render(<SimulationsOverviewSection remoteSimulations={[item]} />);
      expect(screen.getByTitle('Show details')).toBeInTheDocument();
    });

    it('expands details when info toggle is clicked', () => {
      const item = makeRemoteItem();
      render(<SimulationsOverviewSection remoteSimulations={[item]} />);
      expect(screen.queryByText('Game Details')).not.toBeInTheDocument();
      fireEvent.click(screen.getByTitle('Show details'));
      expect(screen.getByText('Game Details')).toBeInTheDocument();
    });

    it('collapses details when info toggle is clicked again', () => {
      const item = makeRemoteItem();
      render(<SimulationsOverviewSection remoteSimulations={[item]} />);
      fireEvent.click(screen.getByTitle('Show details'));
      expect(screen.getByText('Game Details')).toBeInTheDocument();
      fireEvent.click(screen.getByTitle('Hide details'));
      expect(screen.queryByText('Game Details')).not.toBeInTheDocument();
    });

    it('does not trigger onSelectSimulation when toggling details', () => {
      const item = makeRemoteItem({ id: 'sim-toggle' });
      const onSelect = vi.fn();
      render(
        <SimulationsOverviewSection
          remoteSimulations={[item]}
          onSelectSimulation={onSelect}
        />,
      );
      fireEvent.click(screen.getByTitle('Show details'));
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('shows config details in expanded panel', () => {
      const item = makeRemoteItem();
      render(<SimulationsOverviewSection remoteSimulations={[item]} />);
      fireEvent.click(screen.getByTitle('Show details'));
      expect(screen.getByText('Variant Mode')).toBeInTheDocument();
      expect(screen.getByText('Game Type')).toBeInTheDocument();
      expect(screen.getByText('Bot Difficulty (White)')).toBeInTheDocument();
    });

    it('can expand multiple simulations independently', () => {
      const items = [
        makeRemoteItem({ id: 'sim-a', whiteWins: 7, blackWins: 2, draws: 1 }),
        makeRemoteItem({ id: 'sim-b', whiteWins: 3, blackWins: 5, draws: 2 }),
      ];
      render(<SimulationsOverviewSection remoteSimulations={items} />);
      const toggleButtons = screen.getAllByTitle('Show details');
      expect(toggleButtons).toHaveLength(2);
      fireEvent.click(toggleButtons[0]);
      expect(screen.getAllByText('Game Details')).toHaveLength(1);
      fireEvent.click(toggleButtons[1]);
      expect(screen.getAllByText('Game Details')).toHaveLength(2);
    });

    it('works with local simulations', () => {
      const sim = makeLocalSimulation();
      render(<SimulationsOverviewSection localSimulations={[sim]} />);
      fireEvent.click(screen.getByTitle('Show details'));
      expect(screen.getByText('Game Details')).toBeInTheDocument();
    });

    it('sets aria-expanded attribute correctly', () => {
      const item = makeRemoteItem();
      render(<SimulationsOverviewSection remoteSimulations={[item]} />);
      const toggle = screen.getByTitle('Show details');
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(toggle);
      expect(screen.getByTitle('Hide details')).toHaveAttribute('aria-expanded', 'true');
    });
  });
});
