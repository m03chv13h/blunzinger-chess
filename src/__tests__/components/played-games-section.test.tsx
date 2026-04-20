import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PlayedGamesSection } from '../../components/PlayedGamesSection';
import type { GameRecord } from '../../core/gameRecord';
import { DEFAULT_SETUP_CONFIG } from '../../core/blunziger/types';
import type { ScoreState } from '../../core/blunziger/types';
import type { GameListItem } from '../../services/gamesService';

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
  });

  describe('with games', () => {
    it('shows game result and reason', () => {
      const game = makeGameRecord({ result: { winner: 'b', reason: 'checkmate' } });
      render(
        <PlayedGamesSection games={[game]} onAnalyseGame={() => {}} />,
      );
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

  describe('remote saved games', () => {
    function makeRemoteGame(overrides: Partial<GameListItem> = {}): GameListItem {
      return {
        id: `remote-${Date.now()}-${Math.random()}`,
        matchConfig: JSON.stringify({ ...DEFAULT_SETUP_CONFIG, mode: 'hvh' }),
        result: JSON.stringify({ winner: 'b', reason: 'checkmate' }),
        finalFen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        moveCount: 30,
        gameMode: 'local',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        ...overrides,
      };
    }

    it('shows Saved Games heading when remoteGames are provided', () => {
      const remote = [makeRemoteGame()];
      render(
        <PlayedGamesSection
          games={[]}
          onAnalyseGame={() => {}}
          remoteGames={remote}
          remoteTotal={1}
          remotePage={1}
        />,
      );
      expect(screen.getByText('☁️ Saved Games')).toBeInTheDocument();
    });

    it('shows loading state', () => {
      render(
        <PlayedGamesSection
          games={[]}
          onAnalyseGame={() => {}}
          remoteGames={[]}
          remoteLoading={true}
        />,
      );
      expect(screen.getByText('Loading saved games…')).toBeInTheDocument();
    });

    it('shows error state', () => {
      render(
        <PlayedGamesSection
          games={[]}
          onAnalyseGame={() => {}}
          remoteGames={[]}
          remoteError="Network error"
        />,
      );
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('shows pagination when total exceeds page size', () => {
      const remote = [makeRemoteGame()];
      const onFetchPage = vi.fn();
      render(
        <PlayedGamesSection
          games={[]}
          onAnalyseGame={() => {}}
          remoteGames={remote}
          remoteTotal={50}
          remotePage={1}
          onFetchRemotePage={onFetchPage}
        />,
      );
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    });
  });
});
