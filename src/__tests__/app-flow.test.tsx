import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';

describe('App game flow', () => {
  beforeEach(() => {
    render(<App />);
  });

  describe('PRE-GAME SETUP', () => {
    it('starts in setup mode showing the setup screen', () => {
      expect(screen.getByText('♟ New Game Setup')).toBeInTheDocument();
      expect(screen.getByText('▶ Start Game')).toBeInTheDocument();
    });

    it('shows game mode selector', () => {
      const select = screen.getByLabelText('Game Mode') as HTMLSelectElement;
      expect(select).toBeInTheDocument();
      expect(select.value).toBe('hvh');
    });

    it('shows invalid report threshold input', () => {
      const input = screen.getByLabelText('Invalid Report Loss Threshold') as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.value).toBe('2');
    });

    it('shows King of the Hill checkbox', () => {
      const checkbox = screen.getByLabelText('Enable King of the Hill') as HTMLInputElement;
      expect(checkbox).toBeInTheDocument();
      expect(checkbox.checked).toBe(false);
    });

    it('hides bot settings when Human vs Human is selected', () => {
      expect(screen.queryByLabelText('Bot Difficulty')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Play As')).not.toBeInTheDocument();
    });

    it('shows bot difficulty when Human vs Bot is selected', () => {
      fireEvent.change(screen.getByLabelText('Game Mode'), { target: { value: 'hvbot' } });
      expect(screen.getByLabelText('Bot Difficulty')).toBeInTheDocument();
      expect(screen.getByLabelText('Play As')).toBeInTheDocument();
    });

    it('shows bot difficulty but not play-as when Bot vs Bot is selected', () => {
      fireEvent.change(screen.getByLabelText('Game Mode'), { target: { value: 'botvbot' } });
      expect(screen.getByLabelText('Bot Difficulty')).toBeInTheDocument();
      expect(screen.queryByLabelText('Play As')).not.toBeInTheDocument();
    });

    it('does not show the chess board', () => {
      expect(screen.queryByRole('grid', { name: 'Chess board' })).not.toBeInTheDocument();
    });
  });

  describe('STARTING A GAME', () => {
    it('clicking Start Game transitions to active game screen', () => {
      fireEvent.click(screen.getByText('▶ Start Game'));

      // Setup screen should be gone
      expect(screen.queryByText('♟ New Game Setup')).not.toBeInTheDocument();

      // Board should be visible
      expect(screen.getByRole('grid', { name: 'Chess board' })).toBeInTheDocument();

      // New Game button should be visible
      expect(screen.getByText('🔄 New Game')).toBeInTheDocument();
    });

    it('locks settings into read-only summary during play', () => {
      // Change some settings
      fireEvent.change(screen.getByLabelText('Invalid Report Loss Threshold'), {
        target: { value: '3' },
      });
      const kothCheckbox = screen.getByLabelText('Enable King of the Hill') as HTMLInputElement;
      fireEvent.click(kothCheckbox);

      fireEvent.click(screen.getByText('▶ Start Game'));

      // Read-only summary should show the chosen settings
      const summary = screen.getByText('Game Settings').closest('.game-summary') as HTMLElement;
      expect(within(summary).getByText('Human vs Human')).toBeInTheDocument();
      expect(within(summary).getByText('3')).toBeInTheDocument();
      expect(within(summary).getByText('On')).toBeInTheDocument();
    });

    it('does not show editable settings controls during active play', () => {
      fireEvent.click(screen.getByText('▶ Start Game'));

      // No select dropdowns or number inputs for settings
      expect(screen.queryByLabelText('Game Mode')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Bot Difficulty')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Invalid Report Loss Threshold')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Enable King of the Hill')).not.toBeInTheDocument();
    });
  });

  describe('NEW GAME BUTTON', () => {
    it('clicking New Game returns to setup screen', () => {
      fireEvent.click(screen.getByText('▶ Start Game'));
      expect(screen.getByRole('grid', { name: 'Chess board' })).toBeInTheDocument();

      fireEvent.click(screen.getByText('🔄 New Game'));

      // Should be back on setup
      expect(screen.getByText('♟ New Game Setup')).toBeInTheDocument();
      expect(screen.queryByRole('grid', { name: 'Chess board' })).not.toBeInTheDocument();
    });

    it('prefills setup with last used settings', () => {
      // Set custom settings
      fireEvent.change(screen.getByLabelText('Game Mode'), { target: { value: 'hvbot' } });
      fireEvent.change(screen.getByLabelText('Bot Difficulty'), { target: { value: 'hard' } });
      fireEvent.change(screen.getByLabelText('Invalid Report Loss Threshold'), {
        target: { value: '5' },
      });
      fireEvent.click(screen.getByLabelText('Enable King of the Hill'));

      // Start and return
      fireEvent.click(screen.getByText('▶ Start Game'));
      fireEvent.click(screen.getByText('🔄 New Game'));

      // Verify prefilled values
      expect((screen.getByLabelText('Game Mode') as HTMLSelectElement).value).toBe('hvbot');
      expect((screen.getByLabelText('Bot Difficulty') as HTMLSelectElement).value).toBe('hard');
      expect((screen.getByLabelText('Invalid Report Loss Threshold') as HTMLInputElement).value).toBe('5');
      expect((screen.getByLabelText('Enable King of the Hill') as HTMLInputElement).checked).toBe(true);
    });

    it('allows editing settings before starting a new game', () => {
      // Start first game
      fireEvent.click(screen.getByText('▶ Start Game'));
      fireEvent.click(screen.getByText('🔄 New Game'));

      // Change mode
      fireEvent.change(screen.getByLabelText('Game Mode'), { target: { value: 'botvbot' } });
      expect((screen.getByLabelText('Game Mode') as HTMLSelectElement).value).toBe('botvbot');

      // Start with new settings
      fireEvent.click(screen.getByText('▶ Start Game'));
      const summary = screen.getByText('Game Settings').closest('.game-summary') as HTMLElement;
      expect(within(summary).getByText('Bot vs Bot')).toBeInTheDocument();
    });
  });

  describe('SETTINGS IMMUTABILITY', () => {
    it('displays correct config in summary for Human vs Bot game', () => {
      fireEvent.change(screen.getByLabelText('Game Mode'), { target: { value: 'hvbot' } });
      fireEvent.change(screen.getByLabelText('Bot Difficulty'), { target: { value: 'medium' } });
      fireEvent.click(screen.getByText('▶ Start Game'));

      const summary = screen.getByText('Game Settings').closest('.game-summary') as HTMLElement;
      expect(within(summary).getByText('Human vs Bot')).toBeInTheDocument();
      expect(within(summary).getByText('Medium')).toBeInTheDocument();
    });

    it('shows King of the Hill as Off by default in summary', () => {
      fireEvent.click(screen.getByText('▶ Start Game'));

      const summary = screen.getByText('Game Settings').closest('.game-summary') as HTMLElement;
      expect(within(summary).getByText('Off')).toBeInTheDocument();
    });
  });

  describe('CLOCK SETUP', () => {
    it('shows Enable Clock checkbox', () => {
      const checkbox = screen.getByLabelText('Enable Clock') as HTMLInputElement;
      expect(checkbox).toBeInTheDocument();
      expect(checkbox.checked).toBe(false);
    });

    it('shows single time input when clock is enabled', () => {
      fireEvent.click(screen.getByLabelText('Enable Clock'));
      const input = screen.getByLabelText('Initial time (minutes)') as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.value).toBe('5'); // default 5 minutes
    });

    it('does not show per-side time inputs', () => {
      fireEvent.click(screen.getByLabelText('Enable Clock'));
      expect(screen.queryByLabelText(/White time/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Black time/i)).not.toBeInTheDocument();
    });

    it('hides time input when clock is disabled', () => {
      expect(screen.queryByLabelText('Initial time (minutes)')).not.toBeInTheDocument();
    });

    it('clock summary shows chosen time during play', () => {
      fireEvent.click(screen.getByLabelText('Enable Clock'));
      fireEvent.click(screen.getByText('▶ Start Game'));

      const summary = screen.getByText('Game Settings').closest('.game-summary') as HTMLElement;
      expect(within(summary).getByText('5 min')).toBeInTheDocument();
    });
  });

  describe('PENALTY CHECKBOXES', () => {
    it('shows penalty checkboxes for Classic Blunziger', () => {
      expect(screen.getByLabelText('Additional move')).toBeInTheDocument();
      expect(screen.getByLabelText('Piece removal')).toBeInTheDocument();
      expect(screen.getByLabelText('Time reduction')).toBeInTheDocument();
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
      fireEvent.click(screen.getByLabelText('Enable Clock'));
      expect((screen.getByLabelText('Time reduction') as HTMLInputElement).disabled).toBe(false);
    });

    it('time reduction seconds field appears when time reduction is checked and clock is on', () => {
      fireEvent.click(screen.getByLabelText('Enable Clock'));
      fireEvent.click(screen.getByLabelText('Time reduction'));
      expect(screen.getByLabelText('Time reduction (seconds)')).toBeInTheDocument();
    });

    it('time reduction seconds field hidden when time reduction is unchecked', () => {
      expect(screen.queryByLabelText('Time reduction (seconds)')).not.toBeInTheDocument();
    });

    it('penalty checkboxes hidden for Reverse Blunziger', () => {
      fireEvent.change(screen.getByLabelText('Variant Mode'), { target: { value: 'reverse_blunziger' } });
      expect(screen.queryByLabelText('Additional move')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Piece removal')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Time reduction')).not.toBeInTheDocument();
    });

    it('summary shows penalties when enabled', () => {
      fireEvent.click(screen.getByLabelText('Additional move'));
      fireEvent.click(screen.getByLabelText('Piece removal'));
      fireEvent.click(screen.getByText('▶ Start Game'));

      const summary = screen.getByText('Game Settings').closest('.game-summary') as HTMLElement;
      expect(within(summary).getByText(/Additional move/)).toBeInTheDocument();
      expect(within(summary).getByText(/Piece removal/)).toBeInTheDocument();
    });

    it('threshold hidden when penalties are enabled', () => {
      fireEvent.click(screen.getByLabelText('Additional move'));
      expect(screen.queryByLabelText('Invalid Report Loss Threshold')).not.toBeInTheDocument();
    });
  });
});
