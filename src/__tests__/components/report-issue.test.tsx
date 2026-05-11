import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportIssue } from '../../components/ReportIssue';
import { DEFAULT_SETUP_CONFIG } from '../../core/blunziger/types';
import type { GameSetupConfig } from '../../core/blunziger/types';
import type { Move } from 'chess.js';

function makeConfig(overrides: Partial<GameSetupConfig> = {}): GameSetupConfig {
  return { ...DEFAULT_SETUP_CONFIG, ...overrides };
}

const sampleMoves: Move[] = [
  { color: 'w', from: 'e2', to: 'e4', flags: 'b', piece: 'p', san: 'e4' },
  { color: 'b', from: 'e7', to: 'e5', flags: 'b', piece: 'p', san: 'e5' },
  { color: 'w', from: 'g1', to: 'f3', flags: 'n', piece: 'n', san: 'Nf3' },
] as Move[];

/** Decode a URL's query parameters body value for readable assertions. */
function getIssueBody(url: string): string {
  const u = new URL(url);
  return u.searchParams.get('body') ?? '';
}

describe('ReportIssue', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the report issue button', () => {
    render(
      <ReportIssue
        config={makeConfig()}
        fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        moveHistory={[]}
      />,
    );
    expect(screen.getByRole('button', { name: /Report Issue/i })).toBeInTheDocument();
  });

  it('shows the form when button is clicked', () => {
    render(
      <ReportIssue
        config={makeConfig()}
        fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        moveHistory={[]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Report Issue/i }));
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Additional Details')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open on GitHub/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
  });

  it('pre-fills the title with "Bug: "', () => {
    render(
      <ReportIssue
        config={makeConfig()}
        fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        moveHistory={[]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Report Issue/i }));
    expect(screen.getByLabelText('Title')).toHaveValue('Bug: ');
  });

  it('hides the form when Cancel is clicked', () => {
    render(
      <ReportIssue
        config={makeConfig()}
        fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        moveHistory={[]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Report Issue/i }));
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Report Issue/i })).toBeInTheDocument();
  });

  it('opens GitHub issue URL with game information on submit', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';

    render(
      <ReportIssue
        config={makeConfig({ variantMode: 'reverse_blunzinger', enableKingOfTheHill: true })}
        fen={fen}
        moveHistory={sampleMoves}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Report Issue/i }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Bug: missed check not detected' } });
    fireEvent.change(screen.getByLabelText('Additional Details'), { target: { value: 'Check was available but not enforced' } });
    fireEvent.click(screen.getByRole('button', { name: /Open on GitHub/i }));

    expect(openSpy).toHaveBeenCalledOnce();
    const url = openSpy.mock.calls[0][0] as string;
    expect(url).toContain('https://github.com/m03chv13h/blunzinger-chess/issues/new');

    const body = getIssueBody(url);
    expect(body).toContain('Reverse Blunzinger');
    expect(body).toContain(fen);
    expect(body).toContain('1. e4 e5');
    expect(body).toContain('2. Nf3');
    expect(body).toContain('King of the Hill');
    expect(body).toContain('Check was available but not enforced');
  });

  it('includes overlays in the issue body', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <ReportIssue
        config={makeConfig({
          enableKingOfTheHill: true,
          enableClock: true,
          enableDoubleCheckPressure: true,
          enableCrazyhouse: true,
          enableChess960: true,
          enableAtomic: true,
        })}
        fen="startpos"
        moveHistory={[]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Report Issue/i }));
    fireEvent.click(screen.getByRole('button', { name: /Open on GitHub/i }));

    const body = getIssueBody(openSpy.mock.calls[0][0] as string);
    expect(body).toContain('King of the Hill');
    expect(body).toContain('Clock');
    expect(body).toContain('Double Check Pressure');
    expect(body).toContain('Crazyhouse');
    expect(body).toContain('Chess960');
    expect(body).toContain('Atomic Chess');
  });

  it('closes the form after submitting', () => {
    vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <ReportIssue
        config={makeConfig()}
        fen="startpos"
        moveHistory={[]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Report Issue/i }));
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Open on GitHub/i }));
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Report Issue/i })).toBeInTheDocument();
  });

  it('includes hvbot settings in the issue body', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <ReportIssue
        config={makeConfig({ mode: 'hvbot', botSide: 'b', botDifficulty: 'hard', engineId: 'heuristic' })}
        fen="startpos"
        moveHistory={[]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Report Issue/i }));
    fireEvent.click(screen.getByRole('button', { name: /Open on GitHub/i }));

    const body = getIssueBody(openSpy.mock.calls[0][0] as string);
    expect(body).toContain('Human vs Bot');
    expect(body).toContain('Playing As');
    expect(body).toContain('White');
    expect(body).toContain('Bot Difficulty');
    expect(body).toContain('hard');
    expect(body).toContain('Engine');
    expect(body).toContain('heuristic');
  });

  it('includes botvbot settings in the issue body', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <ReportIssue
        config={makeConfig({
          mode: 'botvbot',
          botDifficultyWhite: 'hard',
          botDifficultyBlack: 'easy',
          engineIdWhite: 'heuristic',
          engineIdBlack: 'blunznforön',
        })}
        fen="startpos"
        moveHistory={[]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Report Issue/i }));
    fireEvent.click(screen.getByRole('button', { name: /Open on GitHub/i }));

    const body = getIssueBody(openSpy.mock.calls[0][0] as string);
    expect(body).toContain('Bot vs Bot');
    expect(body).toContain('Bot Difficulty (White)');
    expect(body).toContain('hard');
    expect(body).toContain('Bot Difficulty (Black)');
    expect(body).toContain('easy');
    expect(body).toContain('Engine (White)');
    expect(body).toContain('heuristic');
    expect(body).toContain('Engine (Black)');
    expect(body).toContain('blunznforön');
  });

  it('includes clock settings when clock is enabled', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <ReportIssue
        config={makeConfig({
          enableClock: true,
          initialTimeMs: 300_000,
          incrementMs: 5000,
          decrementMs: 2000,
        })}
        fen="startpos"
        moveHistory={[]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Report Issue/i }));
    fireEvent.click(screen.getByRole('button', { name: /Open on GitHub/i }));

    const body = getIssueBody(openSpy.mock.calls[0][0] as string);
    expect(body).toContain('Clock');
    expect(body).toContain('300s');
    expect(body).toContain('5s inc');
    expect(body).toContain('2s dec');
  });

  it('includes report threshold for report_incorrectness game type', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <ReportIssue
        config={makeConfig({ gameType: 'report_incorrectness', invalidReportLossThreshold: 3 })}
        fen="startpos"
        moveHistory={[]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Report Issue/i }));
    fireEvent.click(screen.getByRole('button', { name: /Open on GitHub/i }));

    const body = getIssueBody(openSpy.mock.calls[0][0] as string);
    expect(body).toContain('Invalid Report Loss Threshold');
    expect(body).toContain('3');
  });

  it('includes penalty settings for penalty_on_miss game type', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <ReportIssue
        config={makeConfig({
          gameType: 'penalty_on_miss',
          enableAdditionalMovePenalty: true,
          additionalMoveCount: 2,
          enablePieceRemovalPenalty: true,
          pieceRemovalCount: 1,
          enableTimeReductionPenalty: true,
          timeReductionSeconds: 30,
        })}
        fen="startpos"
        moveHistory={[]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Report Issue/i }));
    fireEvent.click(screen.getByRole('button', { name: /Open on GitHub/i }));

    const body = getIssueBody(openSpy.mock.calls[0][0] as string);
    expect(body).toContain('Penalties');
    expect(body).toContain('Additional Move (2)');
    expect(body).toContain('Piece Removal (1)');
    expect(body).toContain('Time Reduction (30s)');
  });

  it('includes ply limit for King Hunt Move Limit variant', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <ReportIssue
        config={makeConfig({ variantMode: 'classic_king_hunt_move_limit', kingHuntPlyLimit: 60 })}
        fen="startpos"
        moveHistory={[]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Report Issue/i }));
    fireEvent.click(screen.getByRole('button', { name: /Open on GitHub/i }));

    const body = getIssueBody(openSpy.mock.calls[0][0] as string);
    expect(body).toContain('King Hunt');
    expect(body).toContain('Ply Limit');
    expect(body).toContain('60');
  });

  it('includes given check target for King Hunt Given Check Limit variant', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <ReportIssue
        config={makeConfig({ variantMode: 'classic_king_hunt_given_check_limit', kingHuntGivenCheckTarget: 10 })}
        fen="startpos"
        moveHistory={[]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Report Issue/i }));
    fireEvent.click(screen.getByRole('button', { name: /Open on GitHub/i }));

    const body = getIssueBody(openSpy.mock.calls[0][0] as string);
    expect(body).toContain('King Hunt');
    expect(body).toContain('Given Check Target');
    expect(body).toContain('10');
  });

  it('includes custom initial FEN when set', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const customFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

    render(
      <ReportIssue
        config={makeConfig({ initialFen: customFen })}
        fen="startpos"
        moveHistory={[]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Report Issue/i }));
    fireEvent.click(screen.getByRole('button', { name: /Open on GitHub/i }));

    const body = getIssueBody(openSpy.mock.calls[0][0] as string);
    expect(body).toContain('Initial FEN');
    expect(body).toContain(customFen);
  });

  it('omits bot settings for hvh mode', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <ReportIssue
        config={makeConfig({ mode: 'hvh' })}
        fen="startpos"
        moveHistory={[]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Report Issue/i }));
    fireEvent.click(screen.getByRole('button', { name: /Open on GitHub/i }));

    const body = getIssueBody(openSpy.mock.calls[0][0] as string);
    expect(body).toContain('Human vs Human');
    expect(body).not.toContain('Playing As');
    expect(body).not.toContain('Bot Difficulty');
    expect(body).not.toContain('Engine');
  });

  it('includes gspritzt enabled status in the issue body', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <ReportIssue
        config={makeConfig({
          gameType: 'report_incorrectness',
          enableGspritzt: true,
          gspritztInvalidReportLossThreshold: 3,
        })}
        fen="startpos"
        moveHistory={[]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Report Issue/i }));
    fireEvent.click(screen.getByRole('button', { name: /Open on GitHub/i }));

    const body = getIssueBody(openSpy.mock.calls[0][0] as string);
    expect(body).toContain("Blunzinger G'spritzt");
    expect(body).toContain('Enabled');
    expect(body).toContain("G'spritzt Invalid Report Loss Threshold");
    expect(body).toContain('3');
  });

  it('shows gspritzt as disabled when not enabled', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <ReportIssue
        config={makeConfig({
          gameType: 'report_incorrectness',
          enableGspritzt: false,
        })}
        fen="startpos"
        moveHistory={[]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Report Issue/i }));
    fireEvent.click(screen.getByRole('button', { name: /Open on GitHub/i }));

    const body = getIssueBody(openSpy.mock.calls[0][0] as string);
    expect(body).toContain("Blunzinger G'spritzt");
    expect(body).toContain('Disabled');
    expect(body).not.toContain("G'spritzt Invalid Report Loss Threshold");
  });

  it('omits penalties line when no penalties are enabled', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <ReportIssue
        config={makeConfig({
          gameType: 'penalty_on_miss',
          enableAdditionalMovePenalty: false,
          enablePieceRemovalPenalty: false,
          enableTimeReductionPenalty: false,
        })}
        fen="startpos"
        moveHistory={[]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Report Issue/i }));
    fireEvent.click(screen.getByRole('button', { name: /Open on GitHub/i }));

    const body = getIssueBody(openSpy.mock.calls[0][0] as string);
    expect(body).not.toContain('Penalties');
  });
});
