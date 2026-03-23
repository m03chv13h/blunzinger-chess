import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NumericInput } from '../components/NumericInput';
import App from '../App';

describe('NumericInput component', () => {
  it('shows the initial value', () => {
    const onChange = vi.fn();
    render(<NumericInput value={2} onChange={onChange} fallback={2} min={1} max={10} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('2');
  });

  it('allows the user to clear the field', () => {
    const onChange = vi.fn();
    render(<NumericInput value={2} onChange={onChange} fallback={2} min={1} max={10} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });

    // Field should show empty while editing — not snap back to default
    expect(input.value).toBe('');
    // No valid number to commit, so onChange should not have been called
    expect(onChange).not.toHaveBeenCalled();
  });

  it('allows the user to replace 2 with 1', () => {
    const onChange = vi.fn();
    render(<NumericInput value={2} onChange={onChange} fallback={2} min={1} max={10} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '1' } });

    expect(input.value).toBe('1');
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('allows the user to type a multi-digit number', () => {
    const onChange = vi.fn();
    render(<NumericInput value={2} onChange={onChange} fallback={2} min={1} max={200} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '12' } });

    expect(input.value).toBe('12');
    expect(onChange).toHaveBeenCalledWith(12);
  });

  it('restores fallback when blurred with empty value', () => {
    const onChange = vi.fn();
    render(<NumericInput value={2} onChange={onChange} fallback={2} min={1} max={10} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    expect(input.value).toBe('2');
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('clamps to min on blur', () => {
    const onChange = vi.fn();
    render(<NumericInput value={5} onChange={onChange} fallback={2} min={1} max={10} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.blur(input);

    expect(input.value).toBe('1');
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('clamps to max on blur', () => {
    const onChange = vi.fn();
    render(<NumericInput value={5} onChange={onChange} fallback={2} min={1} max={10} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.blur(input);

    expect(input.value).toBe('10');
    expect(onChange).toHaveBeenLastCalledWith(10);
  });

  it('syncs from external value change when not focused', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <NumericInput value={2} onChange={onChange} fallback={2} min={1} max={10} />,
    );
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('2');

    // Simulate an external change (e.g. mode preset)
    rerender(<NumericInput value={5} onChange={onChange} fallback={2} min={1} max={10} />);
    expect(input.value).toBe('5');
  });
});

describe('Setup screen numeric input editing', () => {
  /** Navigate to the New Game setup screen via the sidebar. */
  function goToNewGame() {
    fireEvent.click(screen.getByRole('button', { name: /New Game/i }));
  }

  it('threshold input initially shows default value 2', () => {
    render(<App />);
    goToNewGame();
    const input = screen.getByLabelText('Invalid Report Loss Threshold') as HTMLInputElement;
    expect(input.value).toBe('2');
  });

  it('user can clear the threshold field while editing', () => {
    render(<App />);
    goToNewGame();
    const input = screen.getByLabelText('Invalid Report Loss Threshold') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });

    // Empty is allowed while editing
    expect(input.value).toBe('');
  });

  it('user can replace threshold 2 with 1', () => {
    render(<App />);
    goToNewGame();
    const input = screen.getByLabelText('Invalid Report Loss Threshold') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '1' } });
    expect(input.value).toBe('1');
  });

  it('user can type a multi-digit threshold', () => {
    render(<App />);
    goToNewGame();
    const input = screen.getByLabelText('Invalid Report Loss Threshold') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '7' } });
    expect(input.value).toBe('7');
  });

  it('empty threshold normalizes to fallback on blur', () => {
    render(<App />);
    goToNewGame();
    const input = screen.getByLabelText('Invalid Report Loss Threshold') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    expect(input.value).toBe('2');
  });

  it('starting a game uses the committed numeric value', () => {
    render(<App />);
    goToNewGame();
    const input = screen.getByLabelText('Invalid Report Loss Threshold') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '4' } });
    fireEvent.click(screen.getByText('▶ Start Game'));

    // The summary should show the entered value
    const summary = screen.getByText('Game Settings').closest('.game-summary') as HTMLElement;
    expect(within(summary).getByText('4')).toBeInTheDocument();
  });

  it('ply limit input can be edited cleanly', () => {
    render(<App />);
    goToNewGame();

    // Switch to a variant mode that shows ply limit
    fireEvent.change(screen.getByLabelText('Variant Mode'), {
      target: { value: 'classic_king_hunt_move_limit' },
    });

    const input = screen.getByLabelText('Ply Limit') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    // Empty is allowed
    expect(input.value).toBe('');

    fireEvent.change(input, { target: { value: '30' } });
    expect(input.value).toBe('30');
  });
});
