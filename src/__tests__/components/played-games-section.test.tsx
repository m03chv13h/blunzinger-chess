import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PlayedGamesSection } from '../../components/PlayedGamesSection';
import type { GameRecord } from '../../core/gameRecord';
import { DEFAULT_SETUP_CONFIG } from '../../core/blunziger/types';
import type { ScoreState } from '../../core/blunziger/types';

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

describe('PlayedGamesSection', () => {
  describe('empty state', () => {
    it('shows empty message when no games', () => {
      render(
        <PlayedGamesSection games={[]} onAnalyseGame={() => {}} />,
      );
      expect(screen.getByText(/No games played yet/)).toBeInTheDocument();
    });

    it('shows the section title', () => {
      render(
        <PlayedGamesSection games={[]} onAnalyseGame={() => {}} />,
      );
      expect(screen.getByText('🎮 Played Games')).toBeInTheDocument();
    });

    it('always shows the timeline even with no games', () => {
      render(
        <PlayedGamesSection games={[]} onAnalyseGame={() => {}} />,
      );
      expect(screen.getByText('Activity (last year)')).toBeInTheDocument();
      expect(screen.getByText('No activity yet')).toBeInTheDocument();
    });
  });

  describe('with games', () => {
    it('shows game result and reason', () => {
      const game = makeGameRecord({ result: { winner: 'b', reason: 'checkmate' } });
      render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} />,
      );
      // hvh mode has no user perspective – shows factual result only
      expect(screen.getByText('Black wins')).toBeInTheDocument();
      expect(screen.getByText(/checkmate/)).toBeInTheDocument();
    });

    it('shows MiniBoard thumbnail', () => {
      const game = makeGameRecord();
      render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} />,
      );
      expect(screen.getByLabelText('Board thumbnail')).toBeInTheDocument();
    });

    it('shows Analyse button for each game', () => {
      const game = makeGameRecord();
      render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} />,
      );
      expect(screen.getByText('📊 Analyse')).toBeInTheDocument();
    });

    it('calls onAnalyseGame when Analyse button is clicked', () => {
      const game = makeGameRecord();
      const onAnalyse = vi.fn();
      render(
        <PlayedGamesSection games={[game]} onAnalyseGame={onAnalyse} />,
      );
      fireEvent.click(screen.getByText('📊 Analyse'));
      expect(onAnalyse).toHaveBeenCalledWith(game);
    });

    it('shows game variant and type info', () => {
      const game = makeGameRecord();
      render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} />,
      );
      expect(screen.getByText(/20 moves/)).toBeInTheDocument();
    });

    it('shows timeline when games exist', () => {
      const game = makeGameRecord();
      render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} />,
      );
      expect(screen.getByText('Activity (last year)')).toBeInTheDocument();
    });

    it('renders botvbot games as neutral (white) segment regardless of outcome', () => {
      const game = makeGameRecord({
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'botvbot' },
        result: { winner: 'w', reason: 'checkmate' },
      });
      const { container } = render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} />,
      );
      const neutralSegment = container.querySelector('.timeline-neutral');
      expect(neutralSegment).toBeInTheDocument();
      // No win/loss segments for botvbot
      expect(container.querySelector('.timeline-win')).not.toBeInTheDocument();
      expect(container.querySelector('.timeline-loss')).not.toBeInTheDocument();
    });

    it('renders botvbot black win as neutral segment too', () => {
      const game = makeGameRecord({
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'botvbot' },
        result: { winner: 'b', reason: 'checkmate' },
      });
      const { container } = render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} />,
      );
      const neutralSegment = container.querySelector('.timeline-neutral');
      expect(neutralSegment).toBeInTheDocument();
      // No win/loss segments for botvbot
      expect(container.querySelector('.timeline-win')).not.toBeInTheDocument();
      expect(container.querySelector('.timeline-loss')).not.toBeInTheDocument();
    });

    it('renders hvh games as neutral (white) segment', () => {
      const whiteWin = makeGameRecord({
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvh' },
        result: { winner: 'w', reason: 'checkmate' },
      });
      const blackWin = makeGameRecord({
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvh' },
        result: { winner: 'b', reason: 'checkmate' },
      });
      const draw = makeGameRecord({
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvh' },
        result: { winner: 'draw', reason: 'stalemate' },
      });
      const { container } = render(
        <PlayedGamesSection games={[whiteWin, blackWin, draw]} onAnalyseGame={() => {}} />,
      );
      // All hvh games should be neutral (white)
      expect(container.querySelector('.timeline-neutral')).toBeInTheDocument();
      // Should NOT have user-perspective win/loss segments
      expect(container.querySelector('.timeline-win')).not.toBeInTheDocument();
      expect(container.querySelector('.timeline-loss')).not.toBeInTheDocument();
      // No draw segment either since hvh draws are also neutral
      expect(container.querySelector('.timeline-draw')).not.toBeInTheDocument();
    });

    it('renders hvbot games as win/loss segments (not neutral)', () => {
      const game = makeGameRecord({
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvbot', botSide: 'b' },
        result: { winner: 'w', reason: 'checkmate' },
      });
      const { container } = render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} />,
      );
      expect(container.querySelector('.timeline-win')).toBeInTheDocument();
      expect(container.querySelector('.timeline-neutral')).not.toBeInTheDocument();
    });

    it('clicking a timeline bar scrolls the corresponding date group into view', () => {
      const today = new Date();
      const todayKey = today.toISOString().split('T')[0];
      const game = makeGameRecord({ completedAt: today.getTime() });

      const originalScrollIntoView = Element.prototype.scrollIntoView;
      const scrollIntoViewMock = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoViewMock;

      try {
        const { container } = render(
          <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} />,
        );

        // Click the timeline bar
        const bar = container.querySelector('.timeline-bar-wrapper');
        expect(bar).not.toBeNull();
        fireEvent.click(bar!);

        // Should have called scrollIntoView on the date group
        expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });

        // Verify data-date attribute exists on the date group
        const dateGroup = container.querySelector(`[data-date="${todayKey}"]`);
        expect(dateGroup).toBeInTheDocument();
      } finally {
        Element.prototype.scrollIntoView = originalScrollIntoView;
      }
    });

    it('date groups have data-date attributes for scroll targeting', () => {
      const today = new Date();
      const todayKey = today.toISOString().split('T')[0];
      const game = makeGameRecord({ completedAt: today.getTime() });

      const { container } = render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} />,
      );

      const dateGroup = container.querySelector(`[data-date="${todayKey}"]`);
      expect(dateGroup).toBeInTheDocument();
      expect(dateGroup?.classList.contains('games-date-group')).toBe(true);
    });
  });

  describe('expandable details', () => {
    it('shows Details button', () => {
      const game = makeGameRecord();
      render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} />,
      );
      expect(screen.getByText('▾ Details')).toBeInTheDocument();
    });

    it('expands to show game settings when Details is clicked', () => {
      const game = makeGameRecord();
      render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} />,
      );
      fireEvent.click(screen.getByText('▾ Details'));
      expect(screen.getByText('Mode:')).toBeInTheDocument();
      expect(screen.getByText('Variant:')).toBeInTheDocument();
      expect(screen.getByText('Game Type:')).toBeInTheDocument();
    });

    it('collapses when Less is clicked', () => {
      const game = makeGameRecord();
      render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} />,
      );
      fireEvent.click(screen.getByText('▾ Details'));
      expect(screen.getByText('▴ Less')).toBeInTheDocument();
      fireEvent.click(screen.getByText('▴ Less'));
      expect(screen.queryByText('Mode:')).not.toBeInTheDocument();
    });
  });

  describe('user outcome visibility', () => {
    it('shows Victory with win class for hvbot game won by user', () => {
      const game = makeGameRecord({
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvbot', botSide: 'b' },
        result: { winner: 'w', reason: 'checkmate' },
      });
      const { container } = render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} />,
      );
      expect(screen.getByText('Victory')).toBeInTheDocument();
      expect(container.querySelector('.game-card--win')).toBeInTheDocument();
    });

    it('shows Defeat with loss class for hvbot game lost by user', () => {
      const game = makeGameRecord({
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvbot', botSide: 'b' },
        result: { winner: 'b', reason: 'checkmate' },
      });
      const { container } = render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} />,
      );
      expect(screen.getByText('Defeat')).toBeInTheDocument();
      expect(container.querySelector('.game-card--loss')).toBeInTheDocument();
    });

    it('shows Draw with draw class for drawn game', () => {
      const game = makeGameRecord({
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvbot', botSide: 'b' },
        result: { winner: 'draw', reason: 'stalemate' },
      });
      const { container } = render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} />,
      );
      expect(screen.getByText('Draw')).toBeInTheDocument();
      expect(container.querySelector('.game-card--draw')).toBeInTheDocument();
    });

    it('shows Victory when user plays black and wins (botSide=w)', () => {
      const game = makeGameRecord({
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvbot', botSide: 'w' },
        result: { winner: 'b', reason: 'checkmate' },
      });
      render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} />,
      );
      expect(screen.getByText('Victory')).toBeInTheDocument();
    });

    it('shows no outcome class for botvbot (spectator mode)', () => {
      const game = makeGameRecord({
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'botvbot' },
        result: { winner: 'w', reason: 'checkmate' },
      });
      const { container } = render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} />,
      );
      expect(container.querySelector('.game-card--win')).not.toBeInTheDocument();
      expect(container.querySelector('.game-card--loss')).not.toBeInTheDocument();
      // Should show standard result label instead
      expect(screen.getByText('White wins')).toBeInTheDocument();
    });

    it('shows no outcome class for hvh (spectator mode)', () => {
      const game = makeGameRecord({
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvh' },
        result: { winner: 'w', reason: 'checkmate' },
      });
      const { container } = render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} />,
      );
      expect(container.querySelector('.game-card--win')).not.toBeInTheDocument();
      expect(container.querySelector('.game-card--loss')).not.toBeInTheDocument();
      // Should show standard result label instead of Victory/Defeat
      expect(screen.getByText('White wins')).toBeInTheDocument();
    });
  });

  describe('grouping', () => {
    it('groups games by date', () => {
      const today = new Date();
      const todayKey = today.toISOString().split('T')[0];
      const game1 = makeGameRecord({ completedAt: today.getTime() });
      const game2 = makeGameRecord({ completedAt: today.getTime() - 1000 });
      render(
        <PlayedGamesSection games={[game1, game2]} onAnalyseGame={() => {}} />,
      );
      // Should show the formatted date heading
      const formattedDate = new Date(todayKey + 'T00:00:00').toLocaleDateString(undefined, {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      });
      expect(screen.getByText(formattedDate)).toBeInTheDocument();
    });

    it('groups dates by month', () => {
      const today = new Date();
      const game = makeGameRecord({ completedAt: today.getTime() });
      render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} />,
      );
      const formattedMonth = new Date(today.toISOString().slice(0, 7) + '-01T00:00:00').toLocaleDateString(undefined, {
        month: 'long', year: 'numeric',
      });
      expect(screen.getByText(formattedMonth)).toBeInTheDocument();
    });
  });
});
