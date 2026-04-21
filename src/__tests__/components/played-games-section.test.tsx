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

  describe('results summary', () => {
    it('shows total results summary with game count', () => {
      const game = makeGameRecord({
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvbot', botSide: 'b' },
        result: { winner: 'w', reason: 'checkmate' },
      });
      render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} />,
      );
      expect(screen.getByText(/Total \(1 game\)/)).toBeInTheDocument();
    });

    it('shows plural game count in total summary', () => {
      const game1 = makeGameRecord({
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvbot', botSide: 'b' },
        result: { winner: 'w', reason: 'checkmate' },
      });
      const game2 = makeGameRecord({
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvbot', botSide: 'b' },
        result: { winner: 'b', reason: 'checkmate' },
      });
      render(
        <PlayedGamesSection games={[game1, game2]} onAnalyseGame={() => {}} />,
      );
      expect(screen.getByText(/Total \(2 games\)/)).toBeInTheDocument();
    });

    it('does not show total summary when there are no games', () => {
      render(
        <PlayedGamesSection games={[]} onAnalyseGame={() => {}} />,
      );
      expect(screen.queryByText(/Total/)).not.toBeInTheDocument();
    });

    it('shows win badge in total summary for hvbot win', () => {
      const game = makeGameRecord({
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvbot', botSide: 'b' },
        result: { winner: 'w', reason: 'checkmate' },
      });
      const { container } = render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} />,
      );
      const totalSection = container.querySelector('.results-summary-total');
      expect(totalSection).toBeInTheDocument();
      expect(totalSection!.querySelector('.results-badge--win')).toBeInTheDocument();
      expect(totalSection!.querySelector('.results-badge--win')!.textContent).toBe('1W');
    });

    it('shows loss and draw badges for mixed results', () => {
      const winGame = makeGameRecord({
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvbot', botSide: 'b' },
        result: { winner: 'w', reason: 'checkmate' },
      });
      const lossGame = makeGameRecord({
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvbot', botSide: 'b' },
        result: { winner: 'b', reason: 'checkmate' },
      });
      const drawGame = makeGameRecord({
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvbot', botSide: 'b' },
        result: { winner: 'draw', reason: 'stalemate' },
      });
      const { container } = render(
        <PlayedGamesSection games={[winGame, lossGame, drawGame]} onAnalyseGame={() => {}} />,
      );
      const totalSection = container.querySelector('.results-summary-total');
      expect(totalSection!.querySelector('.results-badge--win')!.textContent).toBe('1W');
      expect(totalSection!.querySelector('.results-badge--loss')!.textContent).toBe('1L');
      expect(totalSection!.querySelector('.results-badge--draw')!.textContent).toBe('1D');
    });

    it('shows spectated badge for hvh/botvbot games', () => {
      const hvhGame = makeGameRecord({
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvh' },
        result: { winner: 'w', reason: 'checkmate' },
      });
      const botvbotGame = makeGameRecord({
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'botvbot' },
        result: { winner: 'b', reason: 'checkmate' },
      });
      const { container } = render(
        <PlayedGamesSection games={[hvhGame, botvbotGame]} onAnalyseGame={() => {}} />,
      );
      const totalSection = container.querySelector('.results-summary-total');
      expect(totalSection!.querySelector('.results-badge--neutral')!.textContent).toBe('2 spectated');
    });

    it('shows per-month summary badges', () => {
      const game = makeGameRecord({
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvbot', botSide: 'b' },
        result: { winner: 'w', reason: 'checkmate' },
      });
      const { container } = render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} />,
      );
      const monthRow = container.querySelector('.games-month-heading-row');
      expect(monthRow).toBeInTheDocument();
      expect(monthRow!.querySelector('.results-badge--win')).toBeInTheDocument();
    });
  });

  describe('spectated games filter', () => {
    it('shows the include spectated games checkbox', () => {
      render(
        <PlayedGamesSection games={[]} onAnalyseGame={() => {}} />,
      );
      expect(screen.getByLabelText('Include spectated games')).toBeInTheDocument();
    });

    it('checkbox is checked by default', () => {
      render(
        <PlayedGamesSection games={[]} onAnalyseGame={() => {}} />,
      );
      const checkbox = screen.getByLabelText('Include spectated games') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });

    it('shows spectated games when checkbox is checked (default)', () => {
      const hvhGame = makeGameRecord({
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvh' },
        result: { winner: 'w', reason: 'checkmate' },
      });
      const hvbotGame = makeGameRecord({
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvbot', botSide: 'b' },
        result: { winner: 'w', reason: 'checkmate' },
      });
      render(
        <PlayedGamesSection games={[hvhGame, hvbotGame]} onAnalyseGame={() => {}} />,
      );
      expect(screen.getByText(/Total \(2 games\)/)).toBeInTheDocument();
    });

    it('hides spectated games when checkbox is unchecked', () => {
      const hvhGame = makeGameRecord({
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvh' },
        result: { winner: 'w', reason: 'checkmate' },
      });
      const botvbotGame = makeGameRecord({
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'botvbot' },
        result: { winner: 'b', reason: 'checkmate' },
      });
      const hvbotGame = makeGameRecord({
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvbot', botSide: 'b' },
        result: { winner: 'w', reason: 'checkmate' },
      });
      render(
        <PlayedGamesSection games={[hvhGame, botvbotGame, hvbotGame]} onAnalyseGame={() => {}} />,
      );
      // All 3 games visible initially
      expect(screen.getByText(/Total \(3 games\)/)).toBeInTheDocument();

      // Uncheck the filter
      fireEvent.click(screen.getByLabelText('Include spectated games'));

      // Only hvbot game remains
      expect(screen.getByText(/Total \(1 game\)/)).toBeInTheDocument();
    });

    it('shows empty message when all games are spectated and filter is unchecked', () => {
      const hvhGame = makeGameRecord({
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvh' },
        result: { winner: 'w', reason: 'checkmate' },
      });
      render(
        <PlayedGamesSection games={[hvhGame]} onAnalyseGame={() => {}} />,
      );
      // Uncheck the filter
      fireEvent.click(screen.getByLabelText('Include spectated games'));

      // Should show empty message
      expect(screen.getByText(/No games played yet/)).toBeInTheDocument();
    });

    it('re-shows spectated games when checkbox is re-checked', () => {
      const hvhGame = makeGameRecord({
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvh' },
        result: { winner: 'w', reason: 'checkmate' },
      });
      render(
        <PlayedGamesSection games={[hvhGame]} onAnalyseGame={() => {}} />,
      );
      const checkbox = screen.getByLabelText('Include spectated games');

      // Uncheck
      fireEvent.click(checkbox);
      expect(screen.getByText(/No games played yet/)).toBeInTheDocument();

      // Re-check
      fireEvent.click(checkbox);
      expect(screen.getByText(/Total \(1 game\)/)).toBeInTheDocument();
    });
  });

  describe('connection filter (online/offline)', () => {
    it('shows the connection filter buttons', () => {
      render(
        <PlayedGamesSection games={[]} onAnalyseGame={() => {}} />,
      );
      expect(screen.getByRole('radiogroup', { name: 'Connection filter' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: '🌐 All' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: '🟢 Online' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: '📴 Offline' })).toBeInTheDocument();
    });

    it('defaults to "All" (both online and offline)', () => {
      render(
        <PlayedGamesSection games={[]} onAnalyseGame={() => {}} />,
      );
      const allBtn = screen.getByRole('radio', { name: '🌐 All' });
      expect(allBtn.getAttribute('aria-checked')).toBe('true');
    });

    it('shows all games when "All" is selected', () => {
      const onlineGame = makeGameRecord({ isOnline: true });
      const offlineGame = makeGameRecord({ isOnline: false });
      const undefinedGame = makeGameRecord();
      render(
        <PlayedGamesSection games={[onlineGame, offlineGame, undefinedGame]} onAnalyseGame={() => {}} />,
      );
      expect(screen.getByText(/Total \(3 games\)/)).toBeInTheDocument();
    });

    it('shows only online games when "Online" is selected', () => {
      const onlineGame = makeGameRecord({
        isOnline: true,
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvbot', botSide: 'b' },
        result: { winner: 'w', reason: 'checkmate' },
      });
      const offlineGame = makeGameRecord({
        isOnline: false,
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvbot', botSide: 'b' },
        result: { winner: 'b', reason: 'checkmate' },
      });
      render(
        <PlayedGamesSection games={[onlineGame, offlineGame]} onAnalyseGame={() => {}} />,
      );

      // Click "Online" filter
      fireEvent.click(screen.getByRole('radio', { name: '🟢 Online' }));

      // Only online game visible
      expect(screen.getByText(/Total \(1 game\)/)).toBeInTheDocument();
      expect(screen.getByText('Victory')).toBeInTheDocument();
    });

    it('shows only offline games when "Offline" is selected', () => {
      const onlineGame = makeGameRecord({
        isOnline: true,
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvbot', botSide: 'b' },
        result: { winner: 'w', reason: 'checkmate' },
      });
      const offlineGame = makeGameRecord({
        isOnline: false,
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvbot', botSide: 'b' },
        result: { winner: 'b', reason: 'checkmate' },
      });
      render(
        <PlayedGamesSection games={[onlineGame, offlineGame]} onAnalyseGame={() => {}} />,
      );

      // Click "Offline" filter
      fireEvent.click(screen.getByRole('radio', { name: '📴 Offline' }));

      // Only offline game visible
      expect(screen.getByText(/Total \(1 game\)/)).toBeInTheDocument();
      expect(screen.getByText('Defeat')).toBeInTheDocument();
    });

    it('treats games without isOnline as offline', () => {
      const legacyGame = makeGameRecord({
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvbot', botSide: 'b' },
        result: { winner: 'w', reason: 'checkmate' },
      });
      render(
        <PlayedGamesSection games={[legacyGame]} onAnalyseGame={() => {}} />,
      );

      // Click "Online" filter
      fireEvent.click(screen.getByRole('radio', { name: '🟢 Online' }));
      expect(screen.getByText(/No games played yet/)).toBeInTheDocument();

      // Click "Offline" filter — legacy game should appear
      fireEvent.click(screen.getByRole('radio', { name: '📴 Offline' }));
      expect(screen.getByText(/Total \(1 game\)/)).toBeInTheDocument();
    });

    it('shows empty message when filter excludes all games', () => {
      const offlineGame = makeGameRecord({ isOnline: false });
      render(
        <PlayedGamesSection games={[offlineGame]} onAnalyseGame={() => {}} />,
      );

      // Click "Online" filter
      fireEvent.click(screen.getByRole('radio', { name: '🟢 Online' }));
      expect(screen.getByText(/No games played yet/)).toBeInTheDocument();
    });

    it('switching back to "All" shows all games again', () => {
      const onlineGame = makeGameRecord({ isOnline: true });
      const offlineGame = makeGameRecord({ isOnline: false });
      render(
        <PlayedGamesSection games={[onlineGame, offlineGame]} onAnalyseGame={() => {}} />,
      );

      // Filter to online only
      fireEvent.click(screen.getByRole('radio', { name: '🟢 Online' }));
      expect(screen.getByText(/Total \(1 game\)/)).toBeInTheDocument();

      // Switch back to all
      fireEvent.click(screen.getByRole('radio', { name: '🌐 All' }));
      expect(screen.getByText(/Total \(2 games\)/)).toBeInTheDocument();
    });

    it('works together with spectated filter', () => {
      const onlineSpectated = makeGameRecord({
        isOnline: true,
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvh' },
      });
      const onlineActive = makeGameRecord({
        isOnline: true,
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvbot', botSide: 'b' },
        result: { winner: 'w', reason: 'checkmate' },
      });
      const offlineActive = makeGameRecord({
        isOnline: false,
        config: { ...DEFAULT_SETUP_CONFIG, mode: 'hvbot', botSide: 'b' },
        result: { winner: 'b', reason: 'checkmate' },
      });
      render(
        <PlayedGamesSection games={[onlineSpectated, onlineActive, offlineActive]} onAnalyseGame={() => {}} />,
      );

      // Filter to online + uncheck spectated
      fireEvent.click(screen.getByRole('radio', { name: '🟢 Online' }));
      fireEvent.click(screen.getByLabelText('Include spectated games'));

      // Only the online active game remains
      expect(screen.getByText(/Total \(1 game\)/)).toBeInTheDocument();
      expect(screen.getByText('Victory')).toBeInTheDocument();
    });
  });

  describe('remote mode (server-side filtering + pagination)', () => {
    function makeRemoteMode(overrides: Partial<React.ComponentProps<typeof PlayedGamesSection>['remoteMode']> = {}) {
      return {
        page: 1,
        totalGames: 50,
        pageSize: 20,
        loading: false,
        error: null,
        onFilterChange: vi.fn(),
        onPageChange: vi.fn(),
        ...overrides,
      } as NonNullable<React.ComponentProps<typeof PlayedGamesSection>['remoteMode']>;
    }

    it('shows pagination controls when totalGames > pageSize', () => {
      const game = makeGameRecord();
      const remoteMode = makeRemoteMode({ totalGames: 50, pageSize: 20, page: 1 });
      render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} remoteMode={remoteMode} />,
      );
      expect(screen.getByText('← Prev')).toBeInTheDocument();
      expect(screen.getByText('Next →')).toBeInTheDocument();
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    });

    it('does not show pagination when totalGames <= pageSize', () => {
      const game = makeGameRecord();
      const remoteMode = makeRemoteMode({ totalGames: 5, pageSize: 20 });
      render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} remoteMode={remoteMode} />,
      );
      expect(screen.queryByText('← Prev')).not.toBeInTheDocument();
      expect(screen.queryByText('Next →')).not.toBeInTheDocument();
    });

    it('disables Prev button on first page', () => {
      const game = makeGameRecord();
      const remoteMode = makeRemoteMode({ page: 1, totalGames: 50, pageSize: 20 });
      render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} remoteMode={remoteMode} />,
      );
      expect(screen.getByText('← Prev')).toBeDisabled();
      expect(screen.getByText('Next →')).not.toBeDisabled();
    });

    it('disables Next button on last page', () => {
      const game = makeGameRecord();
      const remoteMode = makeRemoteMode({ page: 3, totalGames: 50, pageSize: 20 });
      render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} remoteMode={remoteMode} />,
      );
      expect(screen.getByText('← Prev')).not.toBeDisabled();
      expect(screen.getByText('Next →')).toBeDisabled();
    });

    it('calls onPageChange when Next is clicked', () => {
      const game = makeGameRecord();
      const remoteMode = makeRemoteMode({ page: 1, totalGames: 50, pageSize: 20 });
      render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} remoteMode={remoteMode} />,
      );
      fireEvent.click(screen.getByText('Next →'));
      expect(remoteMode.onPageChange).toHaveBeenCalledWith(2);
    });

    it('calls onPageChange when Prev is clicked', () => {
      const game = makeGameRecord();
      const remoteMode = makeRemoteMode({ page: 2, totalGames: 50, pageSize: 20 });
      render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} remoteMode={remoteMode} />,
      );
      fireEvent.click(screen.getByText('← Prev'));
      expect(remoteMode.onPageChange).toHaveBeenCalledWith(1);
    });

    it('calls onFilterChange when connection filter changes', () => {
      const game = makeGameRecord();
      const remoteMode = makeRemoteMode();
      render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} remoteMode={remoteMode} />,
      );
      fireEvent.click(screen.getByRole('radio', { name: '🟢 Online' }));
      expect(remoteMode.onFilterChange).toHaveBeenCalledWith({
        connectionFilter: 'online',
        includeSpectated: true,
      });
    });

    it('calls onFilterChange when spectated checkbox is toggled', () => {
      const game = makeGameRecord();
      const remoteMode = makeRemoteMode();
      render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} remoteMode={remoteMode} />,
      );
      fireEvent.click(screen.getByLabelText('Include spectated games'));
      expect(remoteMode.onFilterChange).toHaveBeenCalledWith({
        connectionFilter: 'all',
        includeSpectated: false,
      });
    });

    it('does not call onFilterChange on initial render (skips first effect)', () => {
      const game = makeGameRecord();
      const remoteMode = makeRemoteMode();
      render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} remoteMode={remoteMode} />,
      );
      // The initial render should NOT trigger onFilterChange — parent already fetched.
      expect(remoteMode.onFilterChange).not.toHaveBeenCalled();
    });

    it('shows "Showing X of Y" instead of "Total" in remote mode', () => {
      const games = [makeGameRecord(), makeGameRecord()];
      const remoteMode = makeRemoteMode({ totalGames: 50, pageSize: 20 });
      render(
        <PlayedGamesSection games={games} onAnalyseGame={() => {}} remoteMode={remoteMode} />,
      );
      expect(screen.getByText(/Showing 2 of 50 games/)).toBeInTheDocument();
    });

    it('shows loading indicator when loading', () => {
      const remoteMode = makeRemoteMode({ loading: true });
      render(
        <PlayedGamesSection games={[]} onAnalyseGame={() => {}} remoteMode={remoteMode} />,
      );
      expect(screen.getByText('Loading games…')).toBeInTheDocument();
    });

    it('shows error message when there is an error', () => {
      const remoteMode = makeRemoteMode({ error: 'Network error' });
      render(
        <PlayedGamesSection games={[]} onAnalyseGame={() => {}} remoteMode={remoteMode} />,
      );
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('does not apply client-side filtering in remote mode', () => {
      // In remote mode, even games with isOnline=false should appear regardless of filter state,
      // because the server already filtered the results.
      const offlineGame = makeGameRecord({ isOnline: false });
      const remoteMode = makeRemoteMode();
      const { rerender } = render(
        <PlayedGamesSection games={[offlineGame]} onAnalyseGame={() => {}} remoteMode={remoteMode} />,
      );
      // The game should be visible even after clicking "Online" — in remote mode,
      // it just triggers onFilterChange callback instead of local filtering.
      fireEvent.click(screen.getByRole('radio', { name: '🟢 Online' }));
      // Re-render with the same game still present (server would return different data,
      // but we're verifying client doesn't filter locally).
      rerender(
        <PlayedGamesSection games={[offlineGame]} onAnalyseGame={() => {}} remoteMode={remoteMode} />,
      );
      // The offline game is still in the DOM because remote mode skips client-side filtering.
      expect(screen.queryByText(/No games played yet/)).not.toBeInTheDocument();
    });
  });
});
