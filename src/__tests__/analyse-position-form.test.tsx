import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AnalysePositionForm } from '../components/AnalysePositionForm';
import { INITIAL_FEN, DEFAULT_SETUP_CONFIG, buildMatchConfig } from '../core/blunziger/types';

describe('AnalysePositionForm', () => {
  it('renders FEN input with default starting position', () => {
    render(<AnalysePositionForm onStartAnalysis={() => {}} />);
    const input = screen.getByLabelText('FEN string for analysis') as HTMLInputElement;
    expect(input.value).toBe(INITIAL_FEN);
  });

  it('renders variant mode and game type selects', () => {
    render(<AnalysePositionForm onStartAnalysis={() => {}} />);
    expect(screen.getByLabelText('Variant Mode')).toBeInTheDocument();
    expect(screen.getByLabelText('Game Type')).toBeInTheDocument();
  });

  it('renders overlay checkboxes', () => {
    render(<AnalysePositionForm onStartAnalysis={() => {}} />);
    expect(screen.getByLabelText(/King of the Hill/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Crazyhouse/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Double Check Pressure/)).toBeInTheDocument();
  });

  it('shows mini board preview for valid FEN', () => {
    render(<AnalysePositionForm onStartAnalysis={() => {}} />);
    expect(screen.getByLabelText('Board thumbnail')).toBeInTheDocument();
  });

  it('shows error for invalid FEN', () => {
    render(<AnalysePositionForm onStartAnalysis={() => {}} />);
    const input = screen.getByLabelText('FEN string for analysis');
    fireEvent.change(input, { target: { value: 'not-a-fen' } });
    expect(screen.getByText(/Invalid FEN/)).toBeInTheDocument();
  });

  it('disables start button for invalid FEN', () => {
    render(<AnalysePositionForm onStartAnalysis={() => {}} />);
    const input = screen.getByLabelText('FEN string for analysis');
    fireEvent.change(input, { target: { value: 'invalid' } });
    expect(screen.getByText('▶ Start Analysis')).toBeDisabled();
  });

  it('enables start button for valid FEN', () => {
    render(<AnalysePositionForm onStartAnalysis={() => {}} />);
    expect(screen.getByText('▶ Start Analysis')).toBeEnabled();
  });

  it('calls onStartAnalysis with correct config for default FEN', () => {
    const onStart = vi.fn();
    render(<AnalysePositionForm onStartAnalysis={onStart} />);
    fireEvent.click(screen.getByText('▶ Start Analysis'));
    expect(onStart).toHaveBeenCalledTimes(1);
    const config = onStart.mock.calls[0][0];
    expect(config.mode).toBe('hvh');
    expect(config.variantMode).toBe('classic_blunzinger');
    expect(config.gameType).toBe('report_incorrectness');
    // Default FEN should not set initialFen
    expect(config.initialFen).toBeUndefined();
  });

  it('calls onStartAnalysis with custom FEN', () => {
    const onStart = vi.fn();
    const customFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    render(<AnalysePositionForm onStartAnalysis={onStart} />);
    const input = screen.getByLabelText('FEN string for analysis');
    fireEvent.change(input, { target: { value: customFen } });
    fireEvent.click(screen.getByText('▶ Start Analysis'));
    expect(onStart).toHaveBeenCalledTimes(1);
    const config = onStart.mock.calls[0][0];
    expect(config.initialFen).toBe(customFen);
  });

  it('calls onStartAnalysis with selected variant and overlays', () => {
    const onStart = vi.fn();
    render(<AnalysePositionForm onStartAnalysis={onStart} />);

    // Change variant
    fireEvent.change(screen.getByLabelText('Variant Mode'), {
      target: { value: 'reverse_blunzinger' },
    });

    // Change game type
    fireEvent.change(screen.getByLabelText('Game Type'), {
      target: { value: 'penalty_on_miss' },
    });

    // Enable overlays
    fireEvent.click(screen.getByLabelText(/King of the Hill/));
    fireEvent.click(screen.getByLabelText(/Crazyhouse/));

    fireEvent.click(screen.getByText('▶ Start Analysis'));
    const config = onStart.mock.calls[0][0];
    expect(config.variantMode).toBe('reverse_blunzinger');
    expect(config.gameType).toBe('penalty_on_miss');
    expect(config.enableKingOfTheHill).toBe(true);
    expect(config.enableCrazyhouse).toBe(true);
    expect(config.enableDoubleCheckPressure).toBe(false);
  });

  it('shows game-over error for checkmate position', () => {
    render(<AnalysePositionForm onStartAnalysis={() => {}} />);
    const input = screen.getByLabelText('FEN string for analysis');
    // Scholar's mate final position
    fireEvent.change(input, {
      target: { value: 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3' },
    });
    expect(screen.getByText('Position is already game over')).toBeInTheDocument();
    expect(screen.getByText('▶ Start Analysis')).toBeDisabled();
  });
});

describe('buildMatchConfig with initialFen', () => {
  it('uses custom initialFen from GameSetupConfig', () => {
    const customFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const config = {
      ...DEFAULT_SETUP_CONFIG,
      initialFen: customFen,
    };
    const matchConfig = buildMatchConfig(config);
    expect(matchConfig.initialFen).toBe(customFen);
  });

  it('uses INITIAL_FEN when no custom FEN provided', () => {
    const matchConfig = buildMatchConfig(DEFAULT_SETUP_CONFIG);
    expect(matchConfig.initialFen).toBe(INITIAL_FEN);
  });

  it('uses custom FEN even when Chess960 is enabled', () => {
    const customFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const config = {
      ...DEFAULT_SETUP_CONFIG,
      enableChess960: true,
      initialFen: customFen,
    };
    const matchConfig = buildMatchConfig(config);
    expect(matchConfig.initialFen).toBe(customFen);
  });
});
