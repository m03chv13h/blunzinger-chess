import { describe, it, expect } from 'vitest';
import { buildMatchConfig, DEFAULT_SETUP_CONFIG } from '../../core/blunziger/types';
import { createInitialState, applyMoveWithRules, canReport, canReportGspritzt, reportGspritzt, getCheckingMoves } from '../../core/blunziger/engine';

describe('G\'spritzt with Atomic + Crazyhouse', () => {
  const config = buildMatchConfig({
    ...DEFAULT_SETUP_CONFIG,
    variantMode: 'classic_blunzinger',
    gameType: 'report_incorrectness',
    enableCrazyhouse: true,
    enableAtomic: true,
    enableGspritzt: true,
    gspritztInvalidReportLossThreshold: 2,
  });

  it('White should have Qh5+ after 1.e4 f6 (with Atomic)', () => {
    const fen = 'rnbqkbnr/ppppp1pp/5p2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    const checkingMoves = getCheckingMoves(fen, null, true);
    const qh5 = checkingMoves.find(m => m.san === 'Qh5+');
    expect(qh5).toBeDefined();
  });

  it('full scenario: 1.e4 f6 2.e5 fxe5 - violation detection and G\'spritzt', () => {
    let state = createInitialState('hvh', config);

    // 1. e4 - no violation
    state = applyMoveWithRules(state, 'e4');
    expect(state.pendingViolation).toBeNull();

    // 1... f6 - no violation
    state = applyMoveWithRules(state, 'f6');
    expect(state.pendingViolation).toBeNull();

    // 2. e5 - White misses Qh5+, violation created
    state = applyMoveWithRules(state, 'e5');
    expect(state.pendingViolation).not.toBeNull();
    expect(state.pendingViolation!.violatingSide).toBe('w');
    expect(state.pendingViolation!.reportable).toBe(true);

    // Black CAN report the violation (it's Black's turn)
    expect(canReport(state, 'b')).toBe(true);
    // White CANNOT report (it's the violator)
    expect(canReport(state, 'w')).toBe(false);
    // Neither side can report G'spritzt yet (violation hasn't expired)
    expect(canReportGspritzt(state, 'w')).toBe(false);
    expect(canReportGspritzt(state, 'b')).toBe(false);

    // 2... fxe5 - Black doesn't report, plays fxe5 (Atomic capture)
    state = applyMoveWithRules(state, 'fxe5');

    // Position matches the issue's FEN
    expect(state.fen).toBe('rnbqkbnr/ppppp1pp/8/8/8/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3');
    expect(state.sideToMove).toBe('w');
    expect(state.result).toBeNull();

    // The expired violation should be saved for G'spritzt
    expect(state.lastExpiredViolation).not.toBeNull();
    expect(state.lastExpiredViolation!.violatingSide).toBe('w');

    // White (the violator) CAN report G'spritzt
    expect(canReportGspritzt(state, 'w')).toBe(true);
    // Black CANNOT report G'spritzt
    expect(canReportGspritzt(state, 'b')).toBe(false);
    // Neither side can report a regular violation (none is pending)
    expect(canReport(state, 'w')).toBe(false);
    expect(canReport(state, 'b')).toBe(false);

    // G'spritzt report should be valid and White should win
    state = reportGspritzt(state, 'w');
    expect(state.result).not.toBeNull();
    expect(state.result!.winner).toBe('w');
    expect(state.result!.reason).toBe('valid-gspritzt-report');
    expect(state.lastReportFeedback!.valid).toBe(true);
  });

  it('same scenario without Atomic overlay', () => {
    const configNoAtomic = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      variantMode: 'classic_blunzinger',
      gameType: 'report_incorrectness',
      enableCrazyhouse: true,
      enableAtomic: false,
      enableGspritzt: true,
      gspritztInvalidReportLossThreshold: 2,
    });

    let state = createInitialState('hvh', configNoAtomic);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f6');
    state = applyMoveWithRules(state, 'e5');
    expect(state.pendingViolation).not.toBeNull();

    state = applyMoveWithRules(state, 'fxe5');
    expect(state.lastExpiredViolation).not.toBeNull();
    expect(canReportGspritzt(state, 'w')).toBe(true);
  });
});
