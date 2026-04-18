import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../../App';
import { GameStatus } from '../../components/GameStatus';
import { createInitialState } from '../../core/blunziger/engine';
import { DEFAULT_SETUP_CONFIG, buildMatchConfig } from '../../core/blunziger/types';

// Mock useAuth so App skips the welcome screen and lands on quick-start.
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { userId: 'test', displayName: 'Test', isGuest: true, provider: 'guest' },
    loading: false,
    error: null,
    availableProviders: [],
    loginAsGuest: vi.fn(),
    loginWithProvider: vi.fn(),
    logout: vi.fn(),
  }),
}));

/** Navigate to the New Game setup screen via the sidebar. */
function goToNewGame() {
  fireEvent.click(screen.getByRole('button', { name: /New Game/i }));
}

/** Expand the collapsed left panel to access settings during active play. */
function expandDetails() {
  fireEvent.click(screen.getByText(/Show details/));
}

describe('App game flow', () => {
  beforeEach(() => {
    render(<App />);
  });

  describe('SIDEBAR NAVIGATION', () => {
    it('starts on Quick Start screen by default', () => {
      expect(screen.getByText('⚡ Quick Start')).toBeInTheDocument();
      expect(screen.getByText('▶ Start Game')).toBeInTheDocument();
    });

    it('shows sidebar with all navigation items', () => {
      expect(screen.getByRole('button', { name: /Quick Start/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /New Game/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Analyse/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Rules/i })).toBeInTheDocument();
    });

    it('can navigate to New Game screen', () => {
      goToNewGame();
      expect(screen.getByText('♟ New Game Setup')).toBeInTheDocument();
    });

    it('can navigate to Rules screen', () => {
      fireEvent.click(screen.getByRole('button', { name: /Rules/i }));
      expect(screen.getByText('📖 Rules')).toBeInTheDocument();
    });

    it('can navigate to Analyse screen', () => {
      fireEvent.click(screen.getByRole('button', { name: /Analyse/i }));
      expect(screen.getByText('📊 Analyse')).toBeInTheDocument();
    });
  });

  describe('PRE-GAME SETUP', () => {
    beforeEach(() => {
      goToNewGame();
    });

    it('starts in setup mode showing the setup screen', () => {
      expect(screen.getByText('♟ New Game Setup')).toBeInTheDocument();
      expect(screen.getByText('▶ Start Game')).toBeInTheDocument();
    });

    it('shows player mode selector', () => {
      const select = screen.getByLabelText('Player Mode') as HTMLSelectElement;
      expect(select).toBeInTheDocument();
      expect(select.value).toBe('hvh');
    });

    it('shows variant mode selector', () => {
      const select = screen.getByLabelText('Variant Mode') as HTMLSelectElement;
      expect(select).toBeInTheDocument();
      expect(select.value).toBe('classic_blunzinger');
    });

    it('shows game type selector', () => {
      const select = screen.getByLabelText('Game Type') as HTMLSelectElement;
      expect(select).toBeInTheDocument();
      expect(select.value).toBe('report_incorrectness');
    });

    it('shows invalid report threshold input when game type is report', () => {
      const input = screen.getByLabelText('Invalid Report Loss Threshold') as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.value).toBe('2');
    });

    it('shows King of the Hill checkbox', () => {
      const checkbox = screen.getByLabelText('King of the Hill') as HTMLInputElement;
      expect(checkbox).toBeInTheDocument();
      expect(checkbox.checked).toBe(false);
    });

    it('hides bot settings when Human vs Human is selected', () => {
      expect(screen.queryByLabelText('Bot Difficulty')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Play As')).not.toBeInTheDocument();
    });

    it('shows bot difficulty when Human vs Bot is selected', () => {
      fireEvent.change(screen.getByLabelText('Player Mode'), { target: { value: 'hvbot' } });
      expect(screen.getByLabelText('Bot Difficulty')).toBeInTheDocument();
      expect(screen.getByLabelText('Play As')).toBeInTheDocument();
    });

    it('shows bot difficulty but not play-as when Bot vs Bot is selected', () => {
      fireEvent.change(screen.getByLabelText('Player Mode'), { target: { value: 'botvbot' } });
      expect(screen.getByLabelText('Bot Difficulty')).toBeInTheDocument();
      expect(screen.queryByLabelText('Play As')).not.toBeInTheDocument();
    });

    it('does not show the chess board', () => {
      expect(screen.queryByRole('grid', { name: 'Chess board' })).not.toBeInTheDocument();
    });
  });

  describe('STARTING A GAME', () => {
    beforeEach(() => {
      goToNewGame();
    });

    it('clicking Start Game transitions to active game screen', () => {
      fireEvent.click(screen.getByText('▶ Start Game'));

      expect(screen.queryByText('♟ New Game Setup')).not.toBeInTheDocument();
      expect(screen.getByRole('grid', { name: 'Chess board' })).toBeInTheDocument();
      expandDetails();
      expect(screen.getByText('🔄 New Game')).toBeInTheDocument();
    });

    it('locks settings into read-only summary during play', () => {
      fireEvent.click(screen.getByLabelText('King of the Hill'));

      fireEvent.click(screen.getByText('▶ Start Game'));
      expandDetails();

      const summary = screen.getByText('Game Settings').closest('.game-summary') as HTMLElement;
      expect(within(summary).getByText('Human vs Human')).toBeInTheDocument();
      expect(within(summary).getByText('On')).toBeInTheDocument();
    });

    it('does not show editable settings controls during active play', () => {
      fireEvent.click(screen.getByText('▶ Start Game'));

      expect(screen.queryByLabelText('Player Mode')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Bot Difficulty')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Invalid Report Loss Threshold')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('King of the Hill')).not.toBeInTheDocument();
    });
  });

  describe('NEW GAME BUTTON', () => {
    beforeEach(() => {
      goToNewGame();
    });

    it('clicking New Game returns to setup screen', () => {
      fireEvent.click(screen.getByText('▶ Start Game'));
      expect(screen.getByRole('grid', { name: 'Chess board' })).toBeInTheDocument();

      expandDetails();
      fireEvent.click(screen.getByText('🔄 New Game'));

      expect(screen.getByText('♟ New Game Setup')).toBeInTheDocument();
      expect(screen.queryByRole('grid', { name: 'Chess board' })).not.toBeInTheDocument();
    });

    it('prefills setup with last used settings', () => {
      fireEvent.change(screen.getByLabelText('Player Mode'), { target: { value: 'hvbot' } });
      fireEvent.change(screen.getByLabelText('Bot Difficulty'), { target: { value: 'hard' } });
      fireEvent.click(screen.getByLabelText('King of the Hill'));

      fireEvent.click(screen.getByText('▶ Start Game'));
      expandDetails();
      fireEvent.click(screen.getByText('🔄 New Game'));

      expect((screen.getByLabelText('Player Mode') as HTMLSelectElement).value).toBe('hvbot');
      expect((screen.getByLabelText('Bot Difficulty') as HTMLSelectElement).value).toBe('hard');
      expect((screen.getByLabelText('King of the Hill') as HTMLInputElement).checked).toBe(true);
    });

    it('allows editing settings before starting a new game', () => {
      fireEvent.click(screen.getByText('▶ Start Game'));
      expandDetails();
      fireEvent.click(screen.getByText('🔄 New Game'));

      fireEvent.change(screen.getByLabelText('Player Mode'), { target: { value: 'botvbot' } });
      expect((screen.getByLabelText('Player Mode') as HTMLSelectElement).value).toBe('botvbot');

      fireEvent.click(screen.getByText('▶ Start Game'));
      expandDetails();
      const summary = screen.getByText('Game Settings').closest('.game-summary') as HTMLElement;
      expect(within(summary).getByText('Bot vs Bot')).toBeInTheDocument();
    });
  });

  describe('SETTINGS IMMUTABILITY', () => {
    beforeEach(() => {
      goToNewGame();
    });

    it('displays correct config in summary for Human vs Bot game', () => {
      fireEvent.change(screen.getByLabelText('Player Mode'), { target: { value: 'hvbot' } });
      fireEvent.change(screen.getByLabelText('Bot Difficulty'), { target: { value: 'medium' } });
      fireEvent.click(screen.getByText('▶ Start Game'));
      expandDetails();

      const summary = screen.getByText('Game Settings').closest('.game-summary') as HTMLElement;
      expect(within(summary).getByText('Human vs Bot')).toBeInTheDocument();
      expect(within(summary).getByText('Medium')).toBeInTheDocument();
    });

    it('shows King of the Hill as Off by default in summary', () => {
      fireEvent.click(screen.getByText('▶ Start Game'));
      expandDetails();

      const summary = screen.getByText('Game Settings').closest('.game-summary') as HTMLElement;
      // Both KOTH and DCP show "Off" by default; verify at least one exists
      const offElements = within(summary).getAllByText('Off');
      expect(offElements.length).toBeGreaterThanOrEqual(1);
      // More specifically, verify King of the Hill label exists
      expect(within(summary).getByText('King of the Hill')).toBeInTheDocument();
    });

    it('shows engine name in summary for Human vs Bot game', () => {
      fireEvent.change(screen.getByLabelText('Player Mode'), { target: { value: 'hvbot' } });
      fireEvent.click(screen.getByText('▶ Start Game'));
      expandDetails();

      const summary = screen.getByText('Game Settings').closest('.game-summary') as HTMLElement;
      expect(within(summary).getByText('Engine')).toBeInTheDocument();
      expect(within(summary).getByText('Heuristic')).toBeInTheDocument();
    });

    it('shows per-side engine names in summary for Bot vs Bot game', () => {
      fireEvent.change(screen.getByLabelText('Player Mode'), { target: { value: 'botvbot' } });
      fireEvent.click(screen.getByText('▶ Start Game'));
      expandDetails();

      const summary = screen.getByText('Game Settings').closest('.game-summary') as HTMLElement;
      expect(within(summary).getByText('Engine (White)')).toBeInTheDocument();
      expect(within(summary).getByText('Engine (Black)')).toBeInTheDocument();
    });

    it('does not show engine name in summary for Human vs Human game', () => {
      fireEvent.click(screen.getByText('▶ Start Game'));
      expandDetails();

      const summary = screen.getByText('Game Settings').closest('.game-summary') as HTMLElement;
      expect(within(summary).queryByText('Engine')).not.toBeInTheDocument();
      expect(within(summary).queryByText('Engine (White)')).not.toBeInTheDocument();
      expect(within(summary).queryByText('Engine (Black)')).not.toBeInTheDocument();
    });
  });

  describe('CLOCK SETUP', () => {
    beforeEach(() => {
      goToNewGame();
    });

    it('shows Clock checkbox', () => {
      const checkbox = screen.getByLabelText('Clock') as HTMLInputElement;
      expect(checkbox).toBeInTheDocument();
      expect(checkbox.checked).toBe(false);
    });

    it('shows single time input when clock is enabled', () => {
      fireEvent.click(screen.getByLabelText('Clock'));
      const input = screen.getByLabelText('Initial time (MM:SS)') as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.value).toBe('05:00');
    });

    it('does not show per-side time inputs', () => {
      fireEvent.click(screen.getByLabelText('Clock'));
      expect(screen.queryByLabelText(/White time/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Black time/i)).not.toBeInTheDocument();
    });

    it('hides time input when clock is disabled', () => {
      expect(screen.queryByLabelText('Initial time (MM:SS)')).not.toBeInTheDocument();
    });

    it('clock summary shows chosen time during play', () => {
      fireEvent.click(screen.getByLabelText('Clock'));
      fireEvent.click(screen.getByText('▶ Start Game'));
      expandDetails();

      const summary = screen.getByText('Game Settings').closest('.game-summary') as HTMLElement;
      expect(within(summary).getByText('05:00')).toBeInTheDocument();
    });
  });

  describe('GAME TYPE SELECTOR', () => {
    beforeEach(() => {
      goToNewGame();
    });

    it('game type defaults to Report Incorrectness', () => {
      const select = screen.getByLabelText('Game Type') as HTMLSelectElement;
      expect(select.value).toBe('report_incorrectness');
    });

    it('can switch to Penalty on Miss', () => {
      fireEvent.change(screen.getByLabelText('Game Type'), { target: { value: 'penalty_on_miss' } });
      expect((screen.getByLabelText('Game Type') as HTMLSelectElement).value).toBe('penalty_on_miss');
    });

    it('shows penalty checkboxes when Game Type is Penalty on Miss', () => {
      fireEvent.change(screen.getByLabelText('Game Type'), { target: { value: 'penalty_on_miss' } });
      expect(screen.getByLabelText('Additional move')).toBeInTheDocument();
      expect(screen.getByLabelText('Piece removal')).toBeInTheDocument();
      expect(screen.getByLabelText('Time reduction')).toBeInTheDocument();
    });

    it('hides penalty checkboxes when Game Type is Report Incorrectness', () => {
      // Default is report_incorrectness - penalty checkboxes should not be visible
      expect(screen.queryByLabelText('Additional move')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Piece removal')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Time reduction')).not.toBeInTheDocument();
    });

    it('shows Invalid Report Threshold when Game Type is Report Incorrectness', () => {
      expect(screen.getByLabelText('Invalid Report Loss Threshold')).toBeInTheDocument();
    });

    it('hides Invalid Report Threshold when Game Type is Penalty on Miss', () => {
      fireEvent.change(screen.getByLabelText('Game Type'), { target: { value: 'penalty_on_miss' } });
      expect(screen.queryByLabelText('Invalid Report Loss Threshold')).not.toBeInTheDocument();
    });
  });

  describe('MODE DESCRIPTIONS', () => {
    beforeEach(() => {
      goToNewGame();
    });

    it('shows description for default player mode (Human vs Human)', () => {
      expect(screen.getByText('Two players take turns on the same device.')).toBeInTheDocument();
    });

    it('updates player mode description when switching to Human vs Bot', () => {
      fireEvent.change(screen.getByLabelText('Player Mode'), { target: { value: 'hvbot' } });
      expect(screen.getByText('Play against a computer opponent.')).toBeInTheDocument();
    });

    it('updates player mode description when switching to Bot vs Bot', () => {
      fireEvent.change(screen.getByLabelText('Player Mode'), { target: { value: 'botvbot' } });
      expect(screen.getByText('Watch two bots play against each other.')).toBeInTheDocument();
    });

    it('shows description for default game type (Report Incorrectness)', () => {
      expect(screen.getByText(/Opponent can report violations manually/)).toBeInTheDocument();
    });

    it('updates game type description when switching to Penalty on Miss', () => {
      fireEvent.change(screen.getByLabelText('Game Type'), { target: { value: 'penalty_on_miss' } });
      expect(screen.getByText(/Penalties.*are applied automatically on violations/)).toBeInTheDocument();
    });

    it('shows variant mode description for Classic Blunzinger', () => {
      expect(screen.getByText(/checking move exists, the player is required/)).toBeInTheDocument();
    });
  });

  describe('REPORT BUTTON VISIBILITY', () => {
    it('shows report button for Human vs Human game', () => {
      goToNewGame();
      fireEvent.click(screen.getByText('▶ Start Game'));
      expect(screen.getByText('🚨 Report Violation')).toBeInTheDocument();
    });

    it('hides report button when game type is not report_incorrectness', () => {
      goToNewGame();
      fireEvent.change(screen.getByLabelText('Game Type'), { target: { value: 'penalty_on_miss' } });
      fireEvent.click(screen.getByText('▶ Start Game'));
      expect(screen.queryByText('🚨 Report Violation')).not.toBeInTheDocument();
    });

    it('hides report button in Bot vs Bot mode', () => {
      goToNewGame();
      fireEvent.change(screen.getByLabelText('Player Mode'), { target: { value: 'botvbot' } });
      fireEvent.click(screen.getByText('▶ Start Game'));
      expect(screen.queryByText('🚨 Report Violation')).not.toBeInTheDocument();
    });

    it('shows report button in Human vs Bot mode when it is the human turn', () => {
      goToNewGame();
      fireEvent.change(screen.getByLabelText('Player Mode'), { target: { value: 'hvbot' } });
      // Human plays white (default), bot plays black; white moves first -> human turn
      fireEvent.click(screen.getByText('▶ Start Game'));
      expect(screen.getByText('🚨 Report Violation')).toBeInTheDocument();
    });

    it('hides report button in Human vs Bot mode when it is the bot turn', () => {
      const { unmount } = render(
        <GameStatus
          state={{
            ...createInitialState('hvbot', buildMatchConfig({ ...DEFAULT_SETUP_CONFIG, mode: 'hvbot', botSide: 'w' }), 'easy', 'w'),
            sideToMove: 'w',
          }}
          onReport={() => {}}
          botThinking={true}
        />,
      );
      expect(screen.queryByText('🚨 Report Violation')).not.toBeInTheDocument();
      unmount();
    });
  });

  describe('PENALTY CHECKBOXES', () => {
    beforeEach(() => {
      goToNewGame();
      fireEvent.change(screen.getByLabelText('Game Type'), { target: { value: 'penalty_on_miss' } });
    });

    it('penalty checkboxes default to unchecked', () => {
      expect((screen.getByLabelText('Additional move') as HTMLInputElement).checked).toBe(false);
      expect((screen.getByLabelText('Piece removal') as HTMLInputElement).checked).toBe(false);
      expect((screen.getByLabelText('Time reduction') as HTMLInputElement).checked).toBe(false);
    });

    it('time reduction checkbox is disabled when clock is off', () => {
      expect((screen.getByLabelText('Time reduction') as HTMLInputElement).disabled).toBe(true);
    });

    it('time reduction checkbox is enabled when clock is on', () => {
      fireEvent.click(screen.getByLabelText('Clock'));
      expect((screen.getByLabelText('Time reduction') as HTMLInputElement).disabled).toBe(false);
    });

    it('time reduction seconds field appears when time reduction is checked and clock is on', () => {
      fireEvent.click(screen.getByLabelText('Clock'));
      fireEvent.click(screen.getByLabelText('Time reduction'));
      expect(screen.getByLabelText('Time reduction (seconds)')).toBeInTheDocument();
    });

    it('time reduction seconds field hidden when time reduction is unchecked', () => {
      expect(screen.queryByLabelText('Time reduction (seconds)')).not.toBeInTheDocument();
    });

    it('summary shows penalties when enabled', () => {
      fireEvent.click(screen.getByLabelText('Additional move'));
      fireEvent.click(screen.getByLabelText('Piece removal'));
      fireEvent.click(screen.getByText('▶ Start Game'));
      expandDetails();

      const summary = screen.getByText('Game Settings').closest('.game-summary') as HTMLElement;
      expect(within(summary).getByText(/Additional move/)).toBeInTheDocument();
      expect(within(summary).getByText(/Piece removal/)).toBeInTheDocument();
    });
  });

  describe('RESTART BUTTON', () => {
    beforeEach(() => {
      goToNewGame();
    });

    it('shows restart button during active play', () => {
      fireEvent.click(screen.getByText('▶ Start Game'));
      expandDetails();
      expect(screen.getByText('🔁 Restart')).toBeInTheDocument();
    });

    it('does not restart when user cancels the confirmation', () => {
      fireEvent.click(screen.getByText('▶ Start Game'));
      expandDetails();
      vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
      fireEvent.click(screen.getByText('🔁 Restart'));
      // Still on the playing screen with the board visible
      expect(screen.getByRole('grid', { name: 'Chess board' })).toBeInTheDocument();
    });

    it('restarts the game when user confirms', () => {
      fireEvent.click(screen.getByText('▶ Start Game'));
      expandDetails();
      vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
      fireEvent.click(screen.getByText('🔁 Restart'));
      // Still on the playing screen (not setup)
      expect(screen.getByRole('grid', { name: 'Chess board' })).toBeInTheDocument();
      expect(screen.queryByText('♟ New Game Setup')).not.toBeInTheDocument();
    });

    it('preserves game settings after restart', () => {
      fireEvent.click(screen.getByLabelText('King of the Hill'));
      fireEvent.click(screen.getByText('▶ Start Game'));
      expandDetails();

      const summaryBefore = screen.getByText('Game Settings').closest('.game-summary') as HTMLElement;
      expect(within(summaryBefore).getByText('On')).toBeInTheDocument();

      vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
      fireEvent.click(screen.getByText('🔁 Restart'));

      // Panel should be collapsed again after restart
      expect(screen.getByText(/Show details/)).toBeInTheDocument();
      expandDetails();

      const summaryAfter = screen.getByText('Game Settings').closest('.game-summary') as HTMLElement;
      expect(within(summaryAfter).getByText('On')).toBeInTheDocument();
    });

    it('asks for confirmation with a dialog', () => {
      fireEvent.click(screen.getByText('▶ Start Game'));
      expandDetails();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
      fireEvent.click(screen.getByText('🔁 Restart'));
      expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to restart the game?');
    });
  });

  describe('COLLAPSED PANELS DURING GAMEPLAY', () => {
    beforeEach(() => {
      goToNewGame();
    });

    it('collapses left panel by default when game starts', () => {
      fireEvent.click(screen.getByText('▶ Start Game'));

      expect(screen.getByText(/Show details/)).toBeInTheDocument();
      expect(screen.queryByText('Game Settings')).not.toBeInTheDocument();
      expect(screen.queryByText('🔄 New Game')).not.toBeInTheDocument();
      expect(screen.queryByText('🔁 Restart')).not.toBeInTheDocument();
    });

    it('shows essential gameplay elements when collapsed', () => {
      fireEvent.click(screen.getByText('▶ Start Game'));

      expect(screen.getByRole('grid', { name: 'Chess board' })).toBeInTheDocument();
      expect(screen.getByText(/to move/)).toBeInTheDocument();
      expect(screen.getByText('🚨 Report Violation')).toBeInTheDocument();
    });

    it('expands left panel when toggle is clicked', () => {
      fireEvent.click(screen.getByText('▶ Start Game'));
      expandDetails();

      expect(screen.getByText(/Hide details/)).toBeInTheDocument();
      expect(screen.getByText('Game Settings')).toBeInTheDocument();
      expect(screen.getByText('🔄 New Game')).toBeInTheDocument();
      expect(screen.getByText('🔁 Restart')).toBeInTheDocument();
    });

    it('collapses left panel when toggle is clicked again', () => {
      fireEvent.click(screen.getByText('▶ Start Game'));
      expandDetails();
      fireEvent.click(screen.getByText(/Hide details/));

      expect(screen.getByText(/Show details/)).toBeInTheDocument();
      expect(screen.queryByText('Game Settings')).not.toBeInTheDocument();
    });

    it('hides FEN display when panel is collapsed', () => {
      fireEvent.click(screen.getByText('▶ Start Game'));

      expect(screen.queryByLabelText('Current FEN')).not.toBeInTheDocument();
    });

    it('shows FEN display when panel is expanded', () => {
      fireEvent.click(screen.getByText('▶ Start Game'));
      expandDetails();

      expect(screen.getByLabelText('Current FEN')).toBeInTheDocument();
    });

    it('collapses move list by default during active play', () => {
      fireEvent.click(screen.getByText('▶ Start Game'));

      expect(screen.getByText(/Moves/)).toBeInTheDocument();
      expect(screen.queryByText('#')).not.toBeInTheDocument();
    });

    it('resets collapsed state on new game', () => {
      fireEvent.click(screen.getByText('▶ Start Game'));
      expandDetails();
      fireEvent.click(screen.getByText('🔄 New Game'));
      fireEvent.click(screen.getByText('▶ Start Game'));

      expect(screen.getByText(/Show details/)).toBeInTheDocument();
      expect(screen.queryByText('Game Settings')).not.toBeInTheDocument();
    });
  });

  describe('ANALYSE REVIEW', () => {
    /** Play fool's mate (1. f3 e5 2. g4 Qh4#) by clicking squares. */
    function playFoolsMate() {
      fireEvent.click(screen.getByRole('gridcell', { name: 'f2' }));
      fireEvent.click(screen.getByRole('gridcell', { name: 'f3' }));
      fireEvent.click(screen.getByRole('gridcell', { name: 'e7' }));
      fireEvent.click(screen.getByRole('gridcell', { name: 'e5' }));
      fireEvent.click(screen.getByRole('gridcell', { name: 'g2' }));
      fireEvent.click(screen.getByRole('gridcell', { name: 'g4' }));
      fireEvent.click(screen.getByRole('gridcell', { name: 'd8' }));
      fireEvent.click(screen.getByRole('gridcell', { name: 'h4' }));
    }

    function completeGameAndGoToAnalyse() {
      fireEvent.click(screen.getByText('▶ Start Game'));
      playFoolsMate();
      // Navigate to Analyse — this flushes the completed game into history
      fireEvent.click(screen.getByRole('button', { name: /Analyse/i }));
    }

    it('shows played game in analyse section after completing a game', () => {
      completeGameAndGoToAnalyse();
      expect(screen.getByText('🎮 Played Games')).toBeInTheDocument();
      expect(screen.getByText('Black wins')).toBeInTheDocument();
    });

    it('shows board with Back to Analyse button when reviewing from analyse', () => {
      completeGameAndGoToAnalyse();
      // Click the played game to review it
      fireEvent.click(screen.getByText('Black wins'));
      // Should show the board in analyse-review mode
      expect(screen.getByRole('grid', { name: 'Chess board' })).toBeInTheDocument();
      expect(screen.getByText('← Back to Analyse')).toBeInTheDocument();
    });

    it('highlights Analyse in sidebar during analyse-review', () => {
      completeGameAndGoToAnalyse();
      fireEvent.click(screen.getByText('Black wins'));
      // The Analyse sidebar button should have the active class
      const nav = screen.getByRole('navigation');
      const analyseBtn = within(nav).getByRole('button', { name: /Analyse/i });
      expect(analyseBtn.className).toContain('sidebar-item--active');
    });

    it('does not show game controls in analyse-review mode', () => {
      completeGameAndGoToAnalyse();
      fireEvent.click(screen.getByText('Black wins'));
      // Game controls like New Game, Restart should not be shown
      expect(screen.queryByText('🔄 New Game')).not.toBeInTheDocument();
      expect(screen.queryByText('🔁 Restart')).not.toBeInTheDocument();
    });

    it('does not show panel collapse toggle in analyse-review mode', () => {
      completeGameAndGoToAnalyse();
      fireEvent.click(screen.getByText('Black wins'));
      expect(screen.queryByText(/Show details/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Hide details/)).not.toBeInTheDocument();
    });

    it('shows game summary and rules panel in analyse-review', () => {
      completeGameAndGoToAnalyse();
      fireEvent.click(screen.getByText('Black wins'));
      expect(screen.getByText('Game Settings')).toBeInTheDocument();
    });

    it('returns to analyse list when Back to Analyse is clicked', () => {
      completeGameAndGoToAnalyse();
      fireEvent.click(screen.getByText('Black wins'));
      expect(screen.getByText('← Back to Analyse')).toBeInTheDocument();
      // Click back
      fireEvent.click(screen.getByText('← Back to Analyse'));
      // Should be back in the analyse section
      expect(screen.getByText('📊 Analyse')).toBeInTheDocument();
      expect(screen.getByText('🎮 Played Games')).toBeInTheDocument();
    });

    it('shows review controls with move navigation', () => {
      completeGameAndGoToAnalyse();
      fireEvent.click(screen.getByText('Black wins'));
      // Review controls should be visible (the game is in review mode)
      expect(screen.getByText('📖 Review Mode')).toBeInTheDocument();
    });
  });
});
