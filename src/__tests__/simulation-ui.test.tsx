import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';

describe('Simulation UI', () => {
  beforeEach(() => {
    render(<App />);
  });

  it('shows Simulate button in the sidebar', () => {
    expect(screen.getByRole('button', { name: /Simulate/i })).toBeInTheDocument();
  });

  it('navigates to simulation setup screen', () => {
    fireEvent.click(screen.getByRole('button', { name: /Simulate/i }));
    expect(screen.getByText('🔬 Simulation Setup')).toBeInTheDocument();
  });

  it('shows number of games input', () => {
    fireEvent.click(screen.getByRole('button', { name: /Simulate/i }));
    expect(screen.getByLabelText('Number of Games')).toBeInTheDocument();
  });

  it('shows bot difficulty selector', () => {
    fireEvent.click(screen.getByRole('button', { name: /Simulate/i }));
    expect(screen.getByLabelText('Bot Difficulty')).toBeInTheDocument();
  });

  it('shows variant mode selector', () => {
    fireEvent.click(screen.getByRole('button', { name: /Simulate/i }));
    expect(screen.getByLabelText('Variant Mode')).toBeInTheDocument();
  });

  it('shows game type selector', () => {
    fireEvent.click(screen.getByRole('button', { name: /Simulate/i }));
    expect(screen.getByLabelText('Game Type')).toBeInTheDocument();
  });

  it('shows start simulation button', () => {
    fireEvent.click(screen.getByRole('button', { name: /Simulate/i }));
    expect(screen.getByText('▶ Start Simulation')).toBeInTheDocument();
  });

  it('transitions to simulation running view on start', () => {
    fireEvent.click(screen.getByRole('button', { name: /Simulate/i }));
    fireEvent.click(screen.getByText('▶ Start Simulation'));
    expect(screen.getByText('🔬 Simulation')).toBeInTheDocument();
  });

  it('shows standing section in running view', () => {
    fireEvent.click(screen.getByRole('button', { name: /Simulate/i }));
    fireEvent.click(screen.getByText('▶ Start Simulation'));
    expect(screen.getByText('White wins')).toBeInTheDocument();
    expect(screen.getByText('Black wins')).toBeInTheDocument();
    expect(screen.getByText('Draws')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('shows stop simulation button when running', () => {
    fireEvent.click(screen.getByRole('button', { name: /Simulate/i }));
    fireEvent.click(screen.getByText('▶ Start Simulation'));
    expect(screen.getByText('⏹ Stop Simulation')).toBeInTheDocument();
  });

  it('shows penalty options when penalty game type is selected', () => {
    fireEvent.click(screen.getByRole('button', { name: /Simulate/i }));
    fireEvent.change(screen.getByLabelText('Game Type'), { target: { value: 'penalty_on_miss' } });
    expect(screen.getByLabelText('Additional move')).toBeInTheDocument();
    expect(screen.getByLabelText('Piece removal')).toBeInTheDocument();
  });

  it('shows overlay options', () => {
    fireEvent.click(screen.getByRole('button', { name: /Simulate/i }));
    expect(screen.getByLabelText('King of the Hill')).toBeInTheDocument();
    expect(screen.getByLabelText('Double Check Pressure')).toBeInTheDocument();
  });

  it('shows per-side engine selectors', () => {
    fireEvent.click(screen.getByRole('button', { name: /Simulate/i }));
    expect(screen.getByLabelText('Engine (White)')).toBeInTheDocument();
    expect(screen.getByLabelText('Engine (Black)')).toBeInTheDocument();
  });

  it('defaults engine selectors to Heuristic', () => {
    fireEvent.click(screen.getByRole('button', { name: /Simulate/i }));
    const whiteSelect = screen.getByLabelText('Engine (White)') as HTMLSelectElement;
    const blackSelect = screen.getByLabelText('Engine (Black)') as HTMLSelectElement;
    expect(whiteSelect.value).toBe('heuristic');
    expect(blackSelect.value).toBe('heuristic');
  });

  it('allows selecting different engines for each side', () => {
    fireEvent.click(screen.getByRole('button', { name: /Simulate/i }));
    const whiteSelect = screen.getByLabelText('Engine (White)') as HTMLSelectElement;
    const blackSelect = screen.getByLabelText('Engine (Black)') as HTMLSelectElement;
    fireEvent.change(whiteSelect, { target: { value: 'blunznforön' } });
    expect(whiteSelect.value).toBe('blunznforön');
    expect(blackSelect.value).toBe('heuristic');
  });
});
