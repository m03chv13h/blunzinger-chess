import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';

describe('Evaluation bar UI', () => {
  it('should not show evaluation bar by default', () => {
    render(<App />);
    // Start a game first.
    fireEvent.click(screen.getByText('▶ Start Game'));
    // Evaluation bar should NOT be visible (the bar has class "eval-bar").
    expect(document.querySelector('.eval-bar')).not.toBeInTheDocument();
  });

  it('should show "Show evaluation bar" toggle in game controls', () => {
    render(<App />);
    fireEvent.click(screen.getByText('▶ Start Game'));
    const toggle = screen.getByLabelText('Show evaluation bar');
    expect(toggle).toBeInTheDocument();
    expect((toggle as HTMLInputElement).checked).toBe(false);
  });

  it('should show evaluation bar when toggle is enabled', () => {
    render(<App />);
    fireEvent.click(screen.getByText('▶ Start Game'));
    const toggle = screen.getByLabelText('Show evaluation bar');
    fireEvent.click(toggle);
    // The evaluation bar should now be visible.
    expect(document.querySelector('.eval-bar')).toBeInTheDocument();
  });

  it('should hide evaluation bar when toggle is disabled', () => {
    render(<App />);
    fireEvent.click(screen.getByText('▶ Start Game'));
    const toggle = screen.getByLabelText('Show evaluation bar');
    // Enable.
    fireEvent.click(toggle);
    expect(document.querySelector('.eval-bar')).toBeInTheDocument();
    // Disable.
    fireEvent.click(toggle);
    expect(document.querySelector('.eval-bar')).not.toBeInTheDocument();
  });

  it('should show evaluation bar with score label', () => {
    render(<App />);
    fireEvent.click(screen.getByText('▶ Start Game'));
    const toggle = screen.getByLabelText('Show evaluation bar');
    fireEvent.click(toggle);
    const bar = document.querySelector('.eval-bar');
    expect(bar).toBeInTheDocument();
    // The bar should have a label element inside.
    const label = document.querySelector('.eval-bar-label');
    expect(label).toBeInTheDocument();
    expect(label!.textContent).toBeTruthy();
  });

  it('should show best move hint squares on the board when eval bar is enabled', () => {
    render(<App />);
    fireEvent.click(screen.getByText('▶ Start Game'));
    const toggle = screen.getByLabelText('Show evaluation bar');
    fireEvent.click(toggle);
    // The best move hint should be highlighted on the board.
    const hintSquares = document.querySelectorAll('.square.best-move-hint');
    expect(hintSquares.length).toBe(2); // from and to squares
  });

  it('should not show best move hint squares when eval bar is disabled', () => {
    render(<App />);
    fireEvent.click(screen.getByText('▶ Start Game'));
    // Eval bar is off by default — no hint should be shown.
    const hintSquares = document.querySelectorAll('.square.best-move-hint');
    expect(hintSquares.length).toBe(0);
  });
});
