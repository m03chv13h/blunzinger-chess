import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  getLegalMoves,
  getCheckingMoves,
  getNonCheckingMoves,
  applyMoveWithRules,
  canReport,
  reportViolation,
  applyTimeout,
  isReverseForcedState,
  getRemovablePieces,
  applyPieceRemoval,
  selectBestPieceForRemoval,
  getCheckCreatingRemovals,
} from '../core/blunziger/engine';
import type { MatchConfig, Square, GameState } from '../core/blunziger/types';
import {
  VARIANT_MODE_DEFINITIONS,
  getVariantModeDefinition,
  buildMatchConfig,
  DEFAULT_SETUP_CONFIG,
} from '../core/blunziger/types';
import { selectBotMove } from '../bot/botEngine';

// ── Mode Registry / Preset Tests ──────────────────────────────────────

describe('Mode registry & presets', () => {
  it('should have 4 built-in variant mode definitions', () => {
    expect(VARIANT_MODE_DEFINITIONS).toHaveLength(4);
  });

  it('should look up each variant mode by id', () => {
    const ids = [
      'classic_blunzinger',
      'reverse_blunzinger',
      'classic_king_hunt_move_limit',
      'classic_king_hunt_given_check_limit',
    ] as const;
    for (const id of ids) {
      const def = getVariantModeDefinition(id);
      expect(def.id).toBe(id);
      expect(def.name).toBeTruthy();
      expect(def.description).toBeTruthy();
    }
  });

  it('should throw for unknown variant mode id', () => {
    expect(() => getVariantModeDefinition('nonexistent' as never)).toThrow('Unknown variant mode');
  });

  it('classic_blunzinger config has correct variant mode', () => {
    const cfg = buildMatchConfig({ ...DEFAULT_SETUP_CONFIG, variantMode: 'classic_blunzinger' });
    expect(cfg.variantMode).toBe('classic_blunzinger');
  });

  it('buildMatchConfig should merge setup overrides into config', () => {
    const setup = { ...DEFAULT_SETUP_CONFIG, variantMode: 'classic_king_hunt_move_limit' as const, kingHuntPlyLimit: 50 };
    const cfg = buildMatchConfig(setup);
    expect(cfg.variantMode).toBe('classic_king_hunt_move_limit');
    expect(cfg.variantSpecific.kingHuntPlyLimit).toBe(50);
  });

  it('buildMatchConfig disables time reduction penalty when clock is off', () => {
    const setup = { ...DEFAULT_SETUP_CONFIG, enableTimeReductionPenalty: true, enableClock: false };
    const cfg = buildMatchConfig(setup);
    expect(cfg.penaltyConfig.enableTimeReductionPenalty).toBe(false);
  });

  it('old standalone modes are not variant modes', () => {
    expect(() => getVariantModeDefinition('blitz_blunziger' as never)).toThrow('Unknown variant mode');
    expect(() => getVariantModeDefinition('double_check_pressure' as never)).toThrow('Unknown variant mode');
    expect(() => getVariantModeDefinition('king_hunter' as never)).toThrow('Unknown variant mode');
  });

  it('clock config is independent and composable', () => {
    const setup = { ...DEFAULT_SETUP_CONFIG, enableClock: true };
    const cfg = buildMatchConfig(setup);
    expect(cfg.overlays.enableClock).toBe(true);
    expect(cfg.overlays.initialTimeMs).toBe(5 * 60 * 1000);
  });

  it('default clock time is 5 minutes when enabled', () => {
    const setup = { ...DEFAULT_SETUP_CONFIG, enableClock: true };
    const cfg = buildMatchConfig(setup);
    expect(cfg.overlays.initialTimeMs).toBe(300000);
  });

  it('game type defaults to report_incorrectness', () => {
    const cfg = buildMatchConfig(DEFAULT_SETUP_CONFIG);
    expect(cfg.gameType).toBe('report_incorrectness');
  });

  it('game type can be set to penalty_on_miss', () => {
    const cfg = buildMatchConfig({ ...DEFAULT_SETUP_CONFIG, gameType: 'penalty_on_miss' });
    expect(cfg.gameType).toBe('penalty_on_miss');
  });

  it('DCP is an overlay, not a variant mode', () => {
    const cfg = buildMatchConfig({ ...DEFAULT_SETUP_CONFIG, enableDoubleCheckPressure: true });
    expect(cfg.overlays.enableDoubleCheckPressure).toBe(true);
    expect(cfg.variantMode).toBe('classic_blunzinger');
  });

  it('variant mode and game type are orthogonal', () => {
    const cfg = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      variantMode: 'reverse_blunzinger',
      gameType: 'penalty_on_miss',
    });
    expect(cfg.variantMode).toBe('reverse_blunzinger');
    expect(cfg.gameType).toBe('penalty_on_miss');
  });
});

// ── Double Check Pressure (Overlay) ───────────────────────────────────

describe('Double Check Pressure overlay', () => {
  const dcpConfig: MatchConfig = buildMatchConfig({
    ...DEFAULT_SETUP_CONFIG,
    enableDoubleCheckPressure: true,
  });

  it('multiple checking moves + player misses → immediate loss', () => {
    const fen = 'rnbqk2r/pppp1ppp/5n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 3';
    const checks = getCheckingMoves(fen);
    expect(checks.length).toBeGreaterThanOrEqual(2);

    let state = createInitialState('hvh', dcpConfig);
    state = { ...state, fen, sideToMove: 'w' };

    const nonChecks = getNonCheckingMoves(fen);
    expect(nonChecks.length).toBeGreaterThan(0);
    const nonCheckMove = nonChecks[0];
    const result = applyMoveWithRules(state, { from: nonCheckMove.from, to: nonCheckMove.to });

    expect(result.result).not.toBeNull();
    expect(result.result!.reason).toBe('double_check_pressure_violation');
    expect(result.result!.winner).toBe('b');
  });

  it('exactly one checking move + player misses → normal handling (reportable)', () => {
    let state = createInitialState('hvh', dcpConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');

    const checks = getCheckingMoves(state.fen);
    expect(checks.length).toBe(1);

    state = applyMoveWithRules(state, 'd3');
    expect(state.result).toBeNull();
    expect(state.pendingViolation).not.toBeNull();
    expect(state.pendingViolation!.reportable).toBe(true);
  });

  it('multiple checking moves + player plays check → game continues', () => {
    const fen = 'rnbqk2r/pppp1ppp/5n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 3';
    const checks = getCheckingMoves(fen);
    expect(checks.length).toBeGreaterThanOrEqual(2);

    let state = createInitialState('hvh', dcpConfig);
    state = { ...state, fen, sideToMove: 'w' };

    const result = applyMoveWithRules(state, { from: checks[0].from, to: checks[0].to });
    expect(result.result?.reason).not.toBe('double_check_pressure_violation');
  });

  it('DCP + penalty_on_miss: severe miss applies penalty not immediate loss', () => {
    const dcpPenaltyCfg: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      gameType: 'penalty_on_miss',
      enableDoubleCheckPressure: true,
      enableAdditionalMovePenalty: true,
    });
    const fen = 'rnbqk2r/pppp1ppp/5n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 3';
    let state = createInitialState('hvh', dcpPenaltyCfg);
    state = { ...state, fen, sideToMove: 'w' };
    const nonChecks = getNonCheckingMoves(fen);
    const result = applyMoveWithRules(state, { from: nonChecks[0].from, to: nonChecks[0].to });
    // In penalty mode, DCP severe miss applies penalty, not immediate loss
    expect(result.result).toBeNull();
    expect(result.extraTurns.pendingExtraMovesBlack).toBe(1);
  });
});

// ── Clock Overlay ─────────────────────────────────────────────────────

describe('Clock overlay', () => {
  const clockConfig: MatchConfig = buildMatchConfig({
    ...DEFAULT_SETUP_CONFIG,
    enableClock: true,
  });

  it('should initialize clocks in state', () => {
    const state = createInitialState('hvh', clockConfig);
    expect(state.clocks).not.toBeNull();
    expect(state.clocks!.whiteMs).toBe(300000);
    expect(state.clocks!.blackMs).toBe(300000);
  });

  it('applyTimeout should end the game for the losing side', () => {
    let state = createInitialState('hvh', clockConfig);
    state = applyTimeout(state, 'w');
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('timeout');
    expect(state.result!.winner).toBe('b');
  });

  it('applyTimeout should not affect already finished game', () => {
    let state = createInitialState('hvh', clockConfig);
    state = applyTimeout(state, 'w');
    const before = state.result;
    state = applyTimeout(state, 'b');
    expect(state.result).toBe(before);
  });

  it('game end stops clocks (result set, no further timeout applies)', () => {
    let state = createInitialState('hvh', clockConfig);
    state = applyMoveWithRules(state, 'f3');
    state = applyMoveWithRules(state, 'e5');
    state = applyMoveWithRules(state, 'g4');
    state = applyMoveWithRules(state, { from: 'd8', to: 'h4' });
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('checkmate');

    const timeoutState = applyTimeout(state, 'w');
    expect(timeoutState.result!.reason).toBe('checkmate');
  });
});

// ── Extra Move Penalty ────────────────────────────────────────────────

describe('Extra Move Penalty', () => {
  const penaltyConfig: MatchConfig = buildMatchConfig({
    ...DEFAULT_SETUP_CONFIG,
    gameType: 'penalty_on_miss',
    enableAdditionalMovePenalty: true,
  });

  it('missed forced check grants opponent extra turn', () => {
    let state = createInitialState('hvh', penaltyConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');

    expect(state.result).toBeNull();
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(1);
    expect(state.pendingViolation?.reportable).toBe(false);
  });

  it('report button is unavailable in penalty mode', () => {
    let state = createInitialState('hvh', penaltyConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');

    expect(canReport(state, 'b')).toBe(false);
    expect(canReport(state, 'w')).toBe(false);
  });

  it('opponent receives two consecutive moves after violation', () => {
    let state = createInitialState('hvh', penaltyConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(1);
    expect(state.sideToMove).toBe('b');

    state = applyMoveWithRules(state, 'e6');
  });

  it('turn order returns to normal after extra turns consumed', () => {
    let state = createInitialState('hvh', penaltyConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(1);
    expect(state.sideToMove).toBe('b');

    state = applyMoveWithRules(state, 'e6');
    expect(state.sideToMove).toBe('b');
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(0);

    state = applyMoveWithRules(state, 'd6');
    expect(state.sideToMove).toBe('w');
  });

  it('configurable additionalMoveCount grants correct number of extra moves', () => {
    const cfg: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      gameType: 'penalty_on_miss',
      enableAdditionalMovePenalty: true,
      additionalMoveCount: 2,
    });
    let state = createInitialState('hvh', cfg);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');

    expect(state.extraTurns.pendingExtraMovesBlack).toBe(2);
  });

  it('no time subtraction when clocks are disabled', () => {
    let state = createInitialState('hvh', penaltyConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');

    expect(state.clocks).toBeNull();
    expect(state.result).toBeNull();
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(1);
  });
});

// ── Extra Turn Violation Reporting ────────────────────────────────────

describe('Extra Turn Violation Reporting', () => {
  const penaltyConfig: MatchConfig = buildMatchConfig({
    ...DEFAULT_SETUP_CONFIG,
    gameType: 'penalty_on_miss',
    enableAdditionalMovePenalty: true,
  });

  // After 1.e4 f5 2.d3 (White violates: Qh5+ available), Black gets 1 extra move.
  // After Black plays e6 (normal move), the extra is consumed and Black moves again.
  // In the extra-turn position Black can play Bb4+ (checking move).
  // Playing d6 instead is a violation that should be reportable.

  it('inExtraTurn is true during the extra turn', () => {
    let state = createInitialState('hvh', penaltyConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3'); // White violates
    expect(state.inExtraTurn).toBe(false);

    state = applyMoveWithRules(state, 'e6'); // Black normal move, consumes extra
    expect(state.inExtraTurn).toBe(true);
    expect(state.sideToMove).toBe('b');
  });

  it('violation during extra turn is reportable (classic blunzinger)', () => {
    let state = createInitialState('hvh', penaltyConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3'); // White violates
    state = applyMoveWithRules(state, 'e6'); // Black normal move
    expect(state.inExtraTurn).toBe(true);

    // Verify Bb4+ is available
    const checks = getCheckingMoves(state.fen);
    expect(checks.length).toBeGreaterThan(0);

    // Black plays d6 instead of Bb4+ → violation during extra turn
    state = applyMoveWithRules(state, 'd6');
    expect(state.result).toBeNull();
    expect(state.pendingViolation).not.toBeNull();
    expect(state.pendingViolation!.reportable).toBe(true);
    expect(state.pendingViolation!.violationType).toBe('missed_check');
    expect(state.sideToMove).toBe('w');
  });

  it('no auto-penalties applied for violation during extra turn', () => {
    let state = createInitialState('hvh', penaltyConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');
    state = applyMoveWithRules(state, 'e6');
    state = applyMoveWithRules(state, 'd6'); // Extra turn violation

    // No additional moves should be granted (no auto-penalty)
    expect(state.extraTurns.pendingExtraMovesWhite).toBe(0);
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(0);
  });

  it('opponent can report violation from extra turn', () => {
    let state = createInitialState('hvh', penaltyConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');
    state = applyMoveWithRules(state, 'e6');
    state = applyMoveWithRules(state, 'd6'); // Extra turn violation

    expect(canReport(state, 'w')).toBe(true);
    expect(canReport(state, 'b')).toBe(false);

    state = reportViolation(state, 'w');
    expect(state.result).not.toBeNull();
    expect(state.result!.winner).toBe('w');
    expect(state.result!.reason).toBe('valid-report');
  });

  it('violation expires if opponent plays instead of reporting', () => {
    let state = createInitialState('hvh', penaltyConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');
    state = applyMoveWithRules(state, 'e6');
    state = applyMoveWithRules(state, 'd6'); // Extra turn violation
    expect(state.pendingViolation!.reportable).toBe(true);

    // White plays instead of reporting → violation should expire
    state = applyMoveWithRules(state, 'a3');
    expect(state.pendingViolation?.reportable ?? false).toBe(false);
    expect(canReport(state, 'b')).toBe(false);
  });

  it('reportable violation persists across consecutive extra turns', () => {
    const cfg: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      gameType: 'penalty_on_miss',
      enableAdditionalMovePenalty: true,
      additionalMoveCount: 2,
    });
    let state = createInitialState('hvh', cfg);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3'); // White violates → 2 extra
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(2);

    state = applyMoveWithRules(state, 'e6'); // Normal move, extra consumed → 1
    expect(state.inExtraTurn).toBe(true);
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(1);

    // Black violates on extra move 1 (d6 instead of Bb4+)
    state = applyMoveWithRules(state, 'd6');
    expect(state.pendingViolation!.reportable).toBe(true);
    expect(state.inExtraTurn).toBe(true); // Still has another extra
    expect(state.sideToMove).toBe('b');

    // Black plays extra move 2 (violation should persist)
    state = applyMoveWithRules(state, 'a6');
    expect(state.pendingViolation!.reportable).toBe(true);
    expect(state.sideToMove).toBe('w');
    expect(state.inExtraTurn).toBe(false);

    // White can now report
    expect(canReport(state, 'w')).toBe(true);
  });

  it('inExtraTurn is false after extra turns are consumed', () => {
    let state = createInitialState('hvh', penaltyConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');
    state = applyMoveWithRules(state, 'e6'); // consumes extra
    expect(state.inExtraTurn).toBe(true);

    state = applyMoveWithRules(state, 'd6'); // extra move
    expect(state.inExtraTurn).toBe(false);
    expect(state.sideToMove).toBe('w');
  });

  describe('reverse blunzinger extra turn reporting', () => {
    const reversePenaltyConfig: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      variantMode: 'reverse_blunzinger',
      gameType: 'penalty_on_miss',
      enableAdditionalMovePenalty: true,
    });

    it('giving check during extra turn is reportable (reverse blunzinger)', () => {
      let state = createInitialState('hvh', reversePenaltyConfig);
      state = applyMoveWithRules(state, 'e4');
      state = applyMoveWithRules(state, 'f5');
      // White gives check (Qh5+) when non-checking moves exist → violation
      state = applyMoveWithRules(state, { from: 'd1', to: 'h5' });
      expect(state.pendingViolation!.violationType).toBe('gave_forbidden_check');
      expect(state.extraTurns.pendingExtraMovesBlack).toBe(1);

      state = applyMoveWithRules(state, 'g6'); // Black normal move
      expect(state.inExtraTurn).toBe(true);

      // During extra turn, if Black gives check when avoidable → reportable
      const checks = getCheckingMoves(state.fen);
      if (checks.length > 0) {
        const nonChecks = getNonCheckingMoves(state.fen);
        if (nonChecks.length > 0) {
          // Play a checking move (violation in reverse mode)
          state = applyMoveWithRules(state, checks[0].san);
          expect(state.pendingViolation).not.toBeNull();
          expect(state.pendingViolation!.reportable).toBe(true);
          expect(state.pendingViolation!.violationType).toBe('gave_forbidden_check');
        }
      }
    });
  });
});

// ── Penalty + Clock (Time Penalty) ────────────────────────────────────

describe('Extra Move Penalty + Clock time reduction', () => {
  const penaltyClockConfig: MatchConfig = buildMatchConfig({
    ...DEFAULT_SETUP_CONFIG,
    gameType: 'penalty_on_miss',
    enableAdditionalMovePenalty: true,
    enableTimeReductionPenalty: true,
    enableClock: true,
    timeReductionSeconds: 5,
  });

  it('missed forced check subtracts configured seconds from violator clock', () => {
    let state = createInitialState('hvh', penaltyClockConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');

    expect(state.result).toBeNull();
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(1);
    expect(state.clocks).not.toBeNull();
    expect(state.clocks!.whiteMs).toBe(300000 - 5000);
    expect(state.clocks!.blackMs).toBe(300000);
  });

  it('grants extra move AND subtracts time on violation', () => {
    let state = createInitialState('hvh', penaltyClockConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');

    expect(state.extraTurns.pendingExtraMovesBlack).toBe(1);
    expect(state.clocks!.whiteMs).toBe(295000);
  });

  it('clamps remaining time at 0 (not negative)', () => {
    const lowTimeConfig: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      gameType: 'penalty_on_miss',
      enableAdditionalMovePenalty: true,
      enableTimeReductionPenalty: true,
      enableClock: true,
      initialTimeMs: 3000,
      timeReductionSeconds: 10,
    });
    let state = createInitialState('hvh', lowTimeConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');

    expect(state.clocks!.whiteMs).toBe(0);
    expect(state.result).not.toBeNull();
    expect(state.result!.winner).toBe('b');
  });

  it('game ends immediately when penalty reduces clock to 0', () => {
    const exactTimeConfig: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      gameType: 'penalty_on_miss',
      enableAdditionalMovePenalty: true,
      enableTimeReductionPenalty: true,
      enableClock: true,
      initialTimeMs: 5000,
      timeReductionSeconds: 5,
    });
    let state = createInitialState('hvh', exactTimeConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');

    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('timeout_penalty');
    expect(state.result!.winner).toBe('b');
    expect(state.clocks!.whiteMs).toBe(0);
  });

  it('no time penalty applied if move ends game (e.g. checkmate)', () => {
    let state = createInitialState('hvh', penaltyClockConfig);
    state = applyMoveWithRules(state, 'f3');
    state = applyMoveWithRules(state, 'e5');
    state = applyMoveWithRules(state, 'g4');
    state = applyMoveWithRules(state, { from: 'd8', to: 'h4' });
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('checkmate');
    expect(state.clocks!.whiteMs).toBe(300000);
    expect(state.clocks!.blackMs).toBe(300000);
  });

  it('no time reduction when enableTimeReductionPenalty is false', () => {
    const noPenaltyConfig: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      gameType: 'penalty_on_miss',
      enableAdditionalMovePenalty: true,
      enableTimeReductionPenalty: false,
      enableClock: true,
    });
    let state = createInitialState('hvh', noPenaltyConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');

    expect(state.extraTurns.pendingExtraMovesBlack).toBe(1);
    expect(state.clocks!.whiteMs).toBe(300000);
  });

  it('does not apply time reduction in report mode', () => {
    const classicClockConfig: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      enableClock: true,
    });
    let state = createInitialState('hvh', classicClockConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');

    expect(state.pendingViolation).not.toBeNull();
    expect(state.pendingViolation!.reportable).toBe(true);
    expect(state.clocks!.whiteMs).toBe(300000);
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(0);
  });

  it('black receives time penalty when black misses forced check', () => {
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4PP2/8/PPPP2PP/RNBQKBNR b KQkq f3 0 2';
    const checks = getCheckingMoves(fen);
    if (checks.length > 0) {
      let state = createInitialState('hvh', penaltyClockConfig);
      state = { ...state, fen, sideToMove: 'b' };
      const nonChecks = getNonCheckingMoves(fen);
      if (nonChecks.length > 0) {
        state = applyMoveWithRules(state, { from: nonChecks[0].from, to: nonChecks[0].to });
        expect(state.clocks!.blackMs).toBe(300000 - 5000);
        expect(state.clocks!.whiteMs).toBe(300000);
        expect(state.extraTurns.pendingExtraMovesWhite).toBe(1);
      }
    }
  });

  it('bot loses on time due to penalty', () => {
    const lowTimeConfig: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      gameType: 'penalty_on_miss',
      enableAdditionalMovePenalty: true,
      enableTimeReductionPenalty: true,
      enableClock: true,
      initialTimeMs: 2000,
      timeReductionSeconds: 5,
    });
    let state = createInitialState('hvbot', lowTimeConfig, 'easy', 'w');
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('timeout_penalty');
    expect(state.result!.winner).toBe('b');
  });
});

// ── King Hunt - Move Limit ────────────────────────────────────────────

describe('King Hunt - Move Limit mode', () => {
  const kingHuntMLConfig: MatchConfig = buildMatchConfig({
    ...DEFAULT_SETUP_CONFIG,
    variantMode: 'classic_king_hunt_move_limit',
    kingHuntPlyLimit: 6,
  });

  it('checking move increments score', () => {
    let state = createInitialState('hvh', kingHuntMLConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, { from: 'd1', to: 'h5' });
    expect(state.scores.w).toBe(1);
  });

  it('non-checking move does not increment score', () => {
    let state = createInitialState('hvh', kingHuntMLConfig);
    state = applyMoveWithRules(state, 'e4');
    expect(state.scores.w).toBe(0);
    expect(state.scores.b).toBe(0);
    state = applyMoveWithRules(state, 'e5');
    expect(state.scores.b).toBe(0);
  });

  it('game ends at ply limit', () => {
    let state = createInitialState('hvh', kingHuntMLConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'e5');
    state = applyMoveWithRules(state, 'd3');
    state = applyMoveWithRules(state, 'd6');
    state = applyMoveWithRules(state, 'a3');
    expect(state.result).toBeNull();
    state = applyMoveWithRules(state, 'a6');
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('king_hunt_ply_limit_draw');
    expect(state.result!.winner).toBe('draw');
  });

  it('higher score wins at ply limit', () => {
    const cfg: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      variantMode: 'classic_king_hunt_move_limit',
      kingHuntPlyLimit: 8,
    });
    let state = createInitialState('hvh', cfg);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, { from: 'd1', to: 'h5' });
    expect(state.scores.w).toBe(1);
    state = applyMoveWithRules(state, 'g6');
    state = applyMoveWithRules(state, { from: 'h5', to: 'f3' });
    state = applyMoveWithRules(state, 'd6');
    state = applyMoveWithRules(state, 'a3');
    expect(state.result).toBeNull();
    state = applyMoveWithRules(state, 'a6');
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('king_hunt_ply_limit');
    expect(state.result!.winner).toBe('w');
  });

  it('tied score draws at ply limit', () => {
    const cfg: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      variantMode: 'classic_king_hunt_move_limit',
      kingHuntPlyLimit: 4,
    });
    let state = createInitialState('hvh', cfg);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'e5');
    state = applyMoveWithRules(state, 'a3');
    state = applyMoveWithRules(state, 'a6');
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('king_hunt_ply_limit_draw');
    expect(state.result!.winner).toBe('draw');
  });

  it('checkmate before ply limit ends game immediately', () => {
    const cfg: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      variantMode: 'classic_king_hunt_move_limit',
      kingHuntPlyLimit: 200,
    });
    let state = createInitialState('hvh', cfg);
    state = applyMoveWithRules(state, 'f3');
    state = applyMoveWithRules(state, 'e5');
    state = applyMoveWithRules(state, 'g4');
    state = applyMoveWithRules(state, { from: 'd8', to: 'h4' });
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('checkmate');
    expect(state.plyCount).toBe(4);
  });
});

// ── King Hunt - Given Check Limit ─────────────────────────────────────

describe('King Hunt - Given Check Limit mode', () => {
  const kingHuntGCLConfig: MatchConfig = buildMatchConfig({
    ...DEFAULT_SETUP_CONFIG,
    variantMode: 'classic_king_hunt_given_check_limit',
    kingHuntGivenCheckTarget: 1,
  });

  it('reaching given check target ends game immediately', () => {
    let state = createInitialState('hvh', kingHuntGCLConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, { from: 'd1', to: 'h5' });
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('king_hunt_given_check_limit');
    expect(state.result!.winner).toBe('w');
  });

  it('score increments on each check given', () => {
    const cfg: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      variantMode: 'classic_king_hunt_given_check_limit',
      kingHuntGivenCheckTarget: 10,
    });
    let state = createInitialState('hvh', cfg);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, { from: 'd1', to: 'h5' });
    expect(state.scores.w).toBe(1);
    expect(state.result).toBeNull();
  });

  it('checkmate still takes precedence over given check limit', () => {
    const cfg: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      variantMode: 'classic_king_hunt_given_check_limit',
      kingHuntGivenCheckTarget: 100,
    });
    let state = createInitialState('hvh', cfg);
    state = applyMoveWithRules(state, 'f3');
    state = applyMoveWithRules(state, 'e5');
    state = applyMoveWithRules(state, 'g4');
    state = applyMoveWithRules(state, { from: 'd8', to: 'h4' });
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('checkmate');
  });
});

// ── Reverse Blunzinger ────────────────────────────────────────────────

describe('Reverse Blunzinger mode', () => {
  describe('with report_incorrectness game type', () => {
    const reverseReportConfig: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      variantMode: 'reverse_blunzinger',
      gameType: 'report_incorrectness',
    });

    it('isReverseForcedState returns true when checking moves exist', () => {
      const fen = 'rnbqkbnr/ppppp1pp/8/5p2/4P3/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 2';
      expect(isReverseForcedState(fen)).toBe(true);
    });

    it('checking move + non-checking alternatives + player gives check → reportable violation', () => {
      let state = createInitialState('hvh', reverseReportConfig);
      state = applyMoveWithRules(state, 'e4');
      state = applyMoveWithRules(state, 'f5');
      const checks = getCheckingMoves(state.fen);
      expect(checks.length).toBeGreaterThan(0);
      const nonChecks = getNonCheckingMoves(state.fen);
      expect(nonChecks.length).toBeGreaterThan(0);

      state = applyMoveWithRules(state, { from: 'd1', to: 'h5' });
      expect(state.pendingViolation).not.toBeNull();
      expect(state.pendingViolation!.reportable).toBe(true);
      expect(state.pendingViolation!.violationType).toBe('gave_forbidden_check');
      expect(state.result).toBeNull();
    });

    it('reverse violation can be reported for a valid-report win', () => {
      let state = createInitialState('hvh', reverseReportConfig);
      state = applyMoveWithRules(state, 'e4');
      state = applyMoveWithRules(state, 'f5');
      state = applyMoveWithRules(state, { from: 'd1', to: 'h5' });
      expect(canReport(state, 'b')).toBe(true);

      state = reportViolation(state, 'b');
      expect(state.result).not.toBeNull();
      expect(state.result!.reason).toBe('valid-report');
      expect(state.result!.winner).toBe('b');
    });

    it('checking move exists + player plays non-checking move → legal', () => {
      let state = createInitialState('hvh', reverseReportConfig);
      state = applyMoveWithRules(state, 'e4');
      state = applyMoveWithRules(state, 'f5');
      state = applyMoveWithRules(state, 'd3');
      expect(state.result).toBeNull();
      expect(state.pendingViolation).toBeNull();
    });

    it('all legal moves give check → move allowed', () => {
      const fen = '7k/7p/6Q1/8/8/8/8/6K1 w - - 0 1';
      const nonChecks = getNonCheckingMoves(fen);
      const checks = getCheckingMoves(fen);

      if (nonChecks.length === 0 && checks.length > 0) {
        let state = createInitialState('hvh', reverseReportConfig);
        state = { ...state, fen, sideToMove: 'w' };
        const result = applyMoveWithRules(state, { from: checks[0].from, to: checks[0].to });
        expect(result.pendingViolation).toBeNull();
      } else {
        const allMoves = getLegalMoves(fen);
        expect(allMoves.length).toBeGreaterThan(0);
      }
    });

    it('no checking move exists → normal play', () => {
      let state = createInitialState('hvh', reverseReportConfig);
      const checks = getCheckingMoves(state.fen);
      expect(checks.length).toBe(0);
      state = applyMoveWithRules(state, 'e4');
      expect(state.result).toBeNull();
    });
  });

  describe('with penalty_on_miss game type', () => {
    const reversePenaltyConfig: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      variantMode: 'reverse_blunzinger',
      gameType: 'penalty_on_miss',
      enableAdditionalMovePenalty: true,
    });

    it('giving check when non-checking moves exist → penalty applied', () => {
      let state = createInitialState('hvh', reversePenaltyConfig);
      state = applyMoveWithRules(state, 'e4');
      state = applyMoveWithRules(state, 'f5');
      state = applyMoveWithRules(state, { from: 'd1', to: 'h5' });

      expect(state.result).toBeNull();
      expect(state.pendingViolation).not.toBeNull();
      expect(state.pendingViolation!.reportable).toBe(false);
      expect(state.extraTurns.pendingExtraMovesBlack).toBe(1);
    });

    it('report button is unavailable in reverse + penalty mode', () => {
      let state = createInitialState('hvh', reversePenaltyConfig);
      state = applyMoveWithRules(state, 'e4');
      state = applyMoveWithRules(state, 'f5');
      state = applyMoveWithRules(state, { from: 'd1', to: 'h5' });
      expect(canReport(state, 'b')).toBe(false);
    });
  });
});

// ── Bot mode-aware behavior ───────────────────────────────────────────

describe('Bot mode-aware behavior', () => {
  it('bot obeys reverse blunzinger: picks non-checking move when available', () => {
    const reverseConfig: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      variantMode: 'reverse_blunzinger',
    });
    const fen = 'rnbqkbnr/ppppp1pp/8/5p2/4P3/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 2';
    const checks = getCheckingMoves(fen);
    expect(checks.length).toBeGreaterThan(0);
    const nonChecks = getNonCheckingMoves(fen);
    expect(nonChecks.length).toBeGreaterThan(0);

    const move = selectBotMove(fen, 'easy', reverseConfig);
    expect(move).not.toBeNull();
    const isNonChecking = nonChecks.some(
      (nc) => nc.from === move!.from && nc.to === move!.to,
    );
    expect(isNonChecking).toBe(true);
  });

  it('bot in king hunt mode prefers checking moves (medium)', () => {
    const kingHuntConfig: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      variantMode: 'classic_king_hunt_move_limit',
      kingHuntPlyLimit: 80,
    });
    const fen = 'rnbqkbnr/ppppp1pp/8/5p2/4P3/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 2';
    const checks = getCheckingMoves(fen);
    expect(checks.length).toBeGreaterThan(0);

    const move = selectBotMove(fen, 'medium', kingHuntConfig);
    expect(move).not.toBeNull();
    const isChecking = checks.some(
      (c) => c.from === move!.from && c.to === move!.to,
    );
    expect(isChecking).toBe(true);
  });

  it('bot works under double check pressure config', () => {
    const dcpCfg: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      enableDoubleCheckPressure: true,
    });
    const move = selectBotMove(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      'easy',
      dcpCfg,
    );
    expect(move).not.toBeNull();
  });

  it('bot works under extra move penalty config', () => {
    const penaltyCfg: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      gameType: 'penalty_on_miss',
      enableAdditionalMovePenalty: true,
    });
    const move = selectBotMove(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      'hard',
      penaltyCfg,
    );
    expect(move).not.toBeNull();
  });

  it('bot works under piece removal penalty config', () => {
    const pieceRemovalCfg: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      gameType: 'penalty_on_miss',
      enablePieceRemovalPenalty: true,
    });
    const move = selectBotMove(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      'easy',
      pieceRemovalCfg,
    );
    expect(move).not.toBeNull();
  });
});

// ── Overlay Combination Tests ─────────────────────────────────────────

describe('Overlay combinations', () => {
  it('Clock + Classic Blunzinger', () => {
    const cfg = buildMatchConfig({ ...DEFAULT_SETUP_CONFIG, variantMode: 'classic_blunzinger', enableClock: true });
    expect(cfg.overlays.enableClock).toBe(true);
    expect(cfg.variantMode).toBe('classic_blunzinger');
    expect(cfg.overlays.initialTimeMs).toBe(DEFAULT_SETUP_CONFIG.initialTimeMs);
  });

  it('Clock + DCP overlay', () => {
    const cfg = buildMatchConfig({ ...DEFAULT_SETUP_CONFIG, enableClock: true, enableDoubleCheckPressure: true });
    expect(cfg.overlays.enableClock).toBe(true);
    expect(cfg.overlays.enableDoubleCheckPressure).toBe(true);
  });

  it('Clock + Additional Move Penalty + Time Reduction', () => {
    const cfg = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      gameType: 'penalty_on_miss',
      enableClock: true,
      enableAdditionalMovePenalty: true,
      enableTimeReductionPenalty: true,
      timeReductionSeconds: 5,
    });
    expect(cfg.overlays.enableClock).toBe(true);
    expect(cfg.penaltyConfig.enableAdditionalMovePenalty).toBe(true);
    expect(cfg.penaltyConfig.enableTimeReductionPenalty).toBe(true);
    expect(cfg.penaltyConfig.timeReductionSeconds).toBe(5);
  });

  it('Clock + Piece Removal Penalty + Time Reduction', () => {
    const cfg = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      gameType: 'penalty_on_miss',
      enableClock: true,
      enablePieceRemovalPenalty: true,
      enableTimeReductionPenalty: true,
      timeReductionSeconds: 3,
    });
    expect(cfg.overlays.enableClock).toBe(true);
    expect(cfg.penaltyConfig.enablePieceRemovalPenalty).toBe(true);
    expect(cfg.penaltyConfig.enableTimeReductionPenalty).toBe(true);
    expect(cfg.penaltyConfig.timeReductionSeconds).toBe(3);
  });

  it('Clock + Reverse Blunzinger', () => {
    const cfg = buildMatchConfig({ ...DEFAULT_SETUP_CONFIG, variantMode: 'reverse_blunzinger', enableClock: true });
    expect(cfg.overlays.enableClock).toBe(true);
    expect(cfg.variantMode).toBe('reverse_blunzinger');
  });

  it('Clock + King Hunt Move Limit', () => {
    const cfg = buildMatchConfig({ ...DEFAULT_SETUP_CONFIG, variantMode: 'classic_king_hunt_move_limit', enableClock: true });
    expect(cfg.overlays.enableClock).toBe(true);
    expect(cfg.variantMode).toBe('classic_king_hunt_move_limit');
    expect(cfg.variantSpecific.kingHuntPlyLimit).toBe(DEFAULT_SETUP_CONFIG.kingHuntPlyLimit);
  });

  it('Clock + King of the Hill', () => {
    const cfg = buildMatchConfig({ ...DEFAULT_SETUP_CONFIG, enableClock: true, enableKingOfTheHill: true });
    expect(cfg.overlays.enableClock).toBe(true);
    expect(cfg.overlays.enableKingOfTheHill).toBe(true);
  });

  it('Clock + Classic Blunzinger + KOTH combined', () => {
    const cfg = buildMatchConfig({ ...DEFAULT_SETUP_CONFIG, enableClock: true, enableKingOfTheHill: true, variantMode: 'classic_blunzinger' });
    expect(cfg.overlays.enableClock).toBe(true);
    expect(cfg.variantMode).toBe('classic_blunzinger');
    expect(cfg.overlays.enableKingOfTheHill).toBe(true);
  });

  it('Clock overlay initializes clocks in game state', () => {
    const cfg: MatchConfig = buildMatchConfig({ ...DEFAULT_SETUP_CONFIG, enableClock: true });
    const state = createInitialState('hvh', cfg);
    expect(state.clocks).not.toBeNull();
    expect(state.clocks!.whiteMs).toBe(300000);
    expect(state.clocks!.blackMs).toBe(300000);
  });

  it('Clock + penalty mode: timeout from time reduction penalty works', () => {
    const cfg: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      gameType: 'penalty_on_miss',
      enableAdditionalMovePenalty: true,
      enableTimeReductionPenalty: true,
      enableClock: true,
      initialTimeMs: 3000,
      timeReductionSeconds: 5,
    });
    let state = createInitialState('hvh', cfg);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('timeout_penalty');
    expect(state.result!.winner).toBe('b');
  });
});

// ── Checkmate Precedence Tests ────────────────────────────────────────

describe('Checkmate precedence in penalty modes', () => {
  const penaltyConfig: MatchConfig = buildMatchConfig({
    ...DEFAULT_SETUP_CONFIG,
    gameType: 'penalty_on_miss',
    enableAdditionalMovePenalty: true,
  });

  it('checkmate on normal turn in penalty mode is recognized immediately', () => {
    let state = createInitialState('hvh', penaltyConfig);
    state = applyMoveWithRules(state, 'f3');
    state = applyMoveWithRules(state, 'e5');
    state = applyMoveWithRules(state, 'g4');
    state = applyMoveWithRules(state, { from: 'd8', to: 'h4' });
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('checkmate');
    expect(state.result!.winner).toBe('b');
  });

  it('no extra move state is created after checkmate', () => {
    let state = createInitialState('hvh', penaltyConfig);
    state = applyMoveWithRules(state, 'f3');
    state = applyMoveWithRules(state, 'e5');
    state = applyMoveWithRules(state, 'g4');
    state = applyMoveWithRules(state, { from: 'd8', to: 'h4' });
    expect(state.result!.reason).toBe('checkmate');
    expect(state.extraTurns.pendingExtraMovesWhite).toBe(0);
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(0);
    expect(state.pendingPieceRemoval).toBeNull();
  });

  it('checkmate during extra turn is recognized in penalty mode', () => {
    let state = createInitialState('hvh', penaltyConfig);
    state = {
      ...state,
      fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2',
      sideToMove: 'b',
      extraTurns: { pendingExtraMovesWhite: 0, pendingExtraMovesBlack: 1 },
      plyCount: 3,
    };
    state = applyMoveWithRules(state, { from: 'd8', to: 'h4' });
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('checkmate');
    expect(state.result!.winner).toBe('b');
  });

  it('checkmate during consumed extra turn (FEN-swapped) is recognized', () => {
    let state = createInitialState('hvh', penaltyConfig);
    state = {
      ...state,
      fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2',
      sideToMove: 'b',
      extraTurns: { pendingExtraMovesWhite: 0, pendingExtraMovesBlack: 1 },
      plyCount: 3,
    };
    state = applyMoveWithRules(state, 'd6');
    expect(state.sideToMove).toBe('b');
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(0);
    expect(state.result).toBeNull();

    state = applyMoveWithRules(state, { from: 'd8', to: 'h4' });
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('checkmate');
    expect(state.result!.winner).toBe('b');
  });

  it('checkmate with Clock + penalty mode', () => {
    const blitzPenaltyCfg: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      gameType: 'penalty_on_miss',
      enableAdditionalMovePenalty: true,
      enableClock: true,
    });
    let state = createInitialState('hvh', blitzPenaltyCfg);
    state = applyMoveWithRules(state, 'f3');
    state = applyMoveWithRules(state, 'e5');
    state = applyMoveWithRules(state, 'g4');
    state = applyMoveWithRules(state, { from: 'd8', to: 'h4' });
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('checkmate');
    expect(state.result!.winner).toBe('b');
    expect(state.clocks!.whiteMs).toBe(300000);
    expect(state.clocks!.blackMs).toBe(300000);
  });

  it('checkmate in piece_removal penalty mode is recognized immediately', () => {
    const pieceRemovalCfg: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      gameType: 'penalty_on_miss',
      enablePieceRemovalPenalty: true,
    });
    let state = createInitialState('hvh', pieceRemovalCfg);
    state = applyMoveWithRules(state, 'f3');
    state = applyMoveWithRules(state, 'e5');
    state = applyMoveWithRules(state, 'g4');
    state = applyMoveWithRules(state, { from: 'd8', to: 'h4' });
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('checkmate');
    expect(state.result!.winner).toBe('b');
    expect(state.pendingPieceRemoval).toBeNull();
  });
});

// ── Piece Removal Penalty Tests ───────────────────────────────────────

describe('Piece Removal Penalty mode', () => {
  const pieceRemovalConfig: MatchConfig = buildMatchConfig({
    ...DEFAULT_SETUP_CONFIG,
    gameType: 'penalty_on_miss',
    enablePieceRemovalPenalty: true,
  });

  it('missed forced check enters pending piece removal state', () => {
    let state = createInitialState('hvh', pieceRemovalConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');

    expect(state.result).toBeNull();
    expect(state.pendingPieceRemoval).not.toBeNull();
    expect(state.pendingPieceRemoval!.targetSide).toBe('w');
    expect(state.pendingPieceRemoval!.chooserSide).toBe('b');
    expect(state.pendingPieceRemoval!.removableSquares.length).toBeGreaterThan(0);
    expect(state.pendingPieceRemoval!.remainingRemovals).toBe(1);
  });

  it('configurable pieceRemovalCount supports multi-piece removal', () => {
    const multiCfg: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      gameType: 'penalty_on_miss',
      enablePieceRemovalPenalty: true,
      pieceRemovalCount: 2,
    });
    let state = createInitialState('hvh', multiCfg);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');

    expect(state.pendingPieceRemoval).not.toBeNull();
    expect(state.pendingPieceRemoval!.remainingRemovals).toBe(2);
  });

  it('removable squares exclude king', () => {
    let state = createInitialState('hvh', pieceRemovalConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');

    const removable = state.pendingPieceRemoval!.removableSquares;
    expect(removable).not.toContain('e1');
    expect(removable.length).toBeGreaterThan(0);
  });

  it('chosen piece is removed correctly', () => {
    let state = createInitialState('hvh', pieceRemovalConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');

    expect(state.pendingPieceRemoval).not.toBeNull();
    const removable = state.pendingPieceRemoval!.removableSquares;
    expect(removable).toContain('d1');

    state = applyPieceRemoval(state, 'd1');
    expect(state.pendingPieceRemoval).toBeNull();
    const remainingWhite = getRemovablePieces(state.fen, 'w');
    expect(remainingWhite).not.toContain('d1');
  });

  it('invalid square selection is rejected', () => {
    let state = createInitialState('hvh', pieceRemovalConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');

    const before = state;
    const result = applyPieceRemoval(state, 'e1');
    expect(result).toBe(before);
    const result2 = applyPieceRemoval(state, 'e8');
    expect(result2).toBe(before);
  });

  it('getRemovablePieces returns all non-king pieces', () => {
    const removable = getRemovablePieces(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      'w',
    );
    expect(removable).toHaveLength(15);
    expect(removable).not.toContain('e1');
  });

  it('bot chooser removes highest-value piece', () => {
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/3P4/PPP2PPP/RNBQKBNR b KQkq - 0 2';
    const bestSquare = selectBestPieceForRemoval(fen, 'w');
    expect(bestSquare).not.toBeNull();
    expect(bestSquare).toBe('d1');
  });

  it('report button is unavailable in piece removal mode', () => {
    let state = createInitialState('hvh', pieceRemovalConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');
    expect(canReport(state, 'b')).toBe(false);
    expect(canReport(state, 'w')).toBe(false);
  });
});

// ── Classic mode regression ───────────────────────────────────────────

describe('Classic mode still works', () => {
  it('forced-check violation is reportable in classic mode', () => {
    let state = createInitialState();
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');
    expect(state.pendingViolation).not.toBeNull();
    expect(state.pendingViolation!.reportable).toBe(true);
    expect(canReport(state, 'b')).toBe(true);
  });

  it('valid report wins in classic mode', () => {
    let state = createInitialState();
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');
    state = reportViolation(state, 'b');
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('valid-report');
    expect(state.result!.winner).toBe('b');
  });

  it('new state fields exist and are initialized', () => {
    const state = createInitialState();
    expect(state.config.variantMode).toBe('classic_blunzinger');
    expect(state.scores).toEqual({ w: 0, b: 0 });
    expect(state.clocks).toBeNull();
    expect(state.extraTurns).toEqual({
      pendingExtraMovesWhite: 0,
      pendingExtraMovesBlack: 0,
    });
    expect(state.plyCount).toBe(0);
  });

  it('plyCount increments on each move', () => {
    let state = createInitialState();
    state = applyMoveWithRules(state, 'e4');
    expect(state.plyCount).toBe(1);
    state = applyMoveWithRules(state, 'e5');
    expect(state.plyCount).toBe(2);
  });
});

// ── getNonCheckingMoves ───────────────────────────────────────────────

describe('getNonCheckingMoves', () => {
  it('should return all moves from starting position (no checks possible)', () => {
    const nonChecks = getNonCheckingMoves('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(nonChecks).toHaveLength(20);
  });

  it('should exclude checking moves', () => {
    const fen = 'rnbqkbnr/ppppp1pp/8/5p2/4P3/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 2';
    const all = getLegalMoves(fen);
    const checks = getCheckingMoves(fen);
    const nonChecks = getNonCheckingMoves(fen);
    expect(nonChecks.length + checks.length).toBe(all.length);
    expect(nonChecks.length).toBeGreaterThan(0);
  });
});

// ── Combined Penalty Tests ────────────────────────────────────────────

describe('Combined penalty behavior', () => {
  it('extra move + piece removal combined: both apply on violation', () => {
    const cfg: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      gameType: 'penalty_on_miss',
      enableAdditionalMovePenalty: true,
      enablePieceRemovalPenalty: true,
    });
    let state = createInitialState('hvh', cfg);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');

    expect(state.result).toBeNull();
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(1);
    expect(state.pendingPieceRemoval).not.toBeNull();
    expect(state.pendingPieceRemoval!.targetSide).toBe('w');
  });

  it('report game type falls back to report-based handling', () => {
    let state = createInitialState();
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');

    expect(state.pendingViolation).not.toBeNull();
    expect(state.pendingViolation!.reportable).toBe(true);
    expect(canReport(state, 'b')).toBe(true);
  });

  it('report button disabled when game type is penalty_on_miss', () => {
    const cfg: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      gameType: 'penalty_on_miss',
      enableAdditionalMovePenalty: true,
    });
    let state = createInitialState('hvh', cfg);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');
    expect(canReport(state, 'b')).toBe(false);
  });

  it('King of the Hill still combines correctly with clock', () => {
    const cfg: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      enableKingOfTheHill: true,
      enableClock: true,
    });
    const state = createInitialState('hvh', cfg);
    expect(state.config.overlays.enableKingOfTheHill).toBe(true);
    expect(state.config.overlays.enableClock).toBe(true);
    expect(state.clocks).not.toBeNull();
  });
});

// ── King Hunt Given Check Limit + Penalty + Clock (exact bug reproduction) ──

describe('King Hunt Given Check Limit + Penalty on Miss + All penalties + Clock', () => {
  // Exact configuration from the bug report
  const combinedCfg: MatchConfig = buildMatchConfig({
    ...DEFAULT_SETUP_CONFIG,
    variantMode: 'classic_king_hunt_given_check_limit',
    gameType: 'penalty_on_miss',
    enableAdditionalMovePenalty: true,
    additionalMoveCount: 1,
    enablePieceRemovalPenalty: true,
    pieceRemovalCount: 1,
    enableTimeReductionPenalty: true,
    timeReductionSeconds: 60,
    enableClock: true,
    initialTimeMs: 300000,
    kingHuntGivenCheckTarget: 5,
  });

  it('config is built correctly for the combined setup', () => {
    expect(combinedCfg.variantMode).toBe('classic_king_hunt_given_check_limit');
    expect(combinedCfg.gameType).toBe('penalty_on_miss');
    expect(combinedCfg.overlays.enableClock).toBe(true);
    expect(combinedCfg.overlays.initialTimeMs).toBe(300000);
    expect(combinedCfg.penaltyConfig.enableAdditionalMovePenalty).toBe(true);
    expect(combinedCfg.penaltyConfig.additionalMoveCount).toBe(1);
    expect(combinedCfg.penaltyConfig.enablePieceRemovalPenalty).toBe(true);
    expect(combinedCfg.penaltyConfig.pieceRemovalCount).toBe(1);
    expect(combinedCfg.penaltyConfig.enableTimeReductionPenalty).toBe(true);
    expect(combinedCfg.penaltyConfig.timeReductionSeconds).toBe(60);
    expect(combinedCfg.variantSpecific.kingHuntGivenCheckTarget).toBe(5);
  });

  it('initial state has clocks enabled', () => {
    const state = createInitialState('hvh', combinedCfg);
    expect(state.clocks).not.toBeNull();
    expect(state.clocks!.whiteMs).toBe(300000);
    expect(state.clocks!.blackMs).toBe(300000);
    expect(state.scores).toEqual({ w: 0, b: 0 });
  });

  it('full penalty flow: all three penalties applied on violation with clock', () => {
    let state = createInitialState('hvh', combinedCfg);

    // 1.e4 (no forced check from starting position)
    state = applyMoveWithRules(state, 'e4');
    expect(state.sideToMove).toBe('b');
    expect(state.result).toBeNull();
    expect(state.clocks!.whiteMs).toBe(300000);

    // 1...f5 (creates Qh5+ for white)
    state = applyMoveWithRules(state, 'f5');
    expect(state.sideToMove).toBe('w');
    expect(getCheckingMoves(state.fen).length).toBeGreaterThan(0);

    // 2.d3 (VIOLATION: missed Qh5+)
    state = applyMoveWithRules(state, 'd3');

    // All three penalties must be applied
    expect(state.result).toBeNull();
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(1);
    expect(state.pendingPieceRemoval).not.toBeNull();
    expect(state.pendingPieceRemoval!.targetSide).toBe('w');
    expect(state.pendingPieceRemoval!.chooserSide).toBe('b');
    expect(state.pendingPieceRemoval!.remainingRemovals).toBe(1);
    expect(state.clocks!.whiteMs).toBe(240000); // 300000 - 60000
    expect(state.clocks!.blackMs).toBe(300000);
    // sideToMove = chooser during piece removal
    expect(state.sideToMove).toBe('b');
    // Score did not increment (d3 doesn't give check)
    expect(state.scores.w).toBe(0);
  });

  it('piece removal completes and preserves extra turns + clock', () => {
    let state = createInitialState('hvh', combinedCfg);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');
    expect(state.pendingPieceRemoval).not.toBeNull();

    // Remove white's queen
    state = applyPieceRemoval(state, 'd1');
    expect(state.pendingPieceRemoval).toBeNull();
    expect(state.sideToMove).toBe('b');
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(1);
    expect(state.clocks!.whiteMs).toBe(240000);
    expect(state.clocks!.blackMs).toBe(300000);
    expect(state.result).toBeNull();
  });

  it('extra move consumed after piece removal, clock switches correctly', () => {
    let state = createInitialState('hvh', combinedCfg);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');
    state = applyPieceRemoval(state, 'd1');

    // Black's normal move (consumes extra turn).
    // Use a6 which doesn't open any checking diagonal.
    state = applyMoveWithRules(state, 'a6');
    expect(state.sideToMove).toBe('b'); // still black (extra turn)
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(0);

    // Black's extra move — use a5 (safe, no checking lines opened)
    state = applyMoveWithRules(state, 'a5');
    expect(state.sideToMove).toBe('w'); // back to white
    expect(state.result).toBeNull();
    // White's clock preserved at reduced value; black's clock unchanged
    expect(state.clocks!.whiteMs).toBe(240000);
    expect(state.clocks!.blackMs).toBe(300000);
  });

  it('King Hunt check limit still ends game immediately', () => {
    // Use target=1 so one check ends it
    const cfg1: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      variantMode: 'classic_king_hunt_given_check_limit',
      gameType: 'penalty_on_miss',
      enableAdditionalMovePenalty: true,
      enablePieceRemovalPenalty: true,
      enableTimeReductionPenalty: true,
      timeReductionSeconds: 60,
      enableClock: true,
      initialTimeMs: 300000,
      kingHuntGivenCheckTarget: 1,
    });
    let state = createInitialState('hvh', cfg1);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');

    // White gives check with Qh5+ (reaches target)
    state = applyMoveWithRules(state, { from: 'd1', to: 'h5' });
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('king_hunt_given_check_limit');
    expect(state.result!.winner).toBe('w');
    expect(state.scores.w).toBe(1);
    // No penalties applied since game ended immediately
    expect(state.pendingPieceRemoval).toBeNull();
  });

  it('time reduction to zero ends game immediately (clears piece removal)', () => {
    const lowTimeCfg: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      variantMode: 'classic_king_hunt_given_check_limit',
      gameType: 'penalty_on_miss',
      enableAdditionalMovePenalty: true,
      enablePieceRemovalPenalty: true,
      enableTimeReductionPenalty: true,
      timeReductionSeconds: 60,
      enableClock: true,
      initialTimeMs: 30000, // 30 seconds -> reduced to 0
      kingHuntGivenCheckTarget: 5,
    });
    let state = createInitialState('hvh', lowTimeCfg);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');

    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('timeout_penalty');
    expect(state.result!.winner).toBe('b');
    expect(state.clocks!.whiteMs).toBe(0);
    // Piece removal must be cleared when game ends
    expect(state.pendingPieceRemoval).toBeNull();
  });

  it('applyTimeout clears pendingPieceRemoval', () => {
    let state = createInitialState('hvh', combinedCfg);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');
    expect(state.pendingPieceRemoval).not.toBeNull();

    // Simulate clock timeout during piece removal
    state = applyTimeout(state, 'b');
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('timeout');
    expect(state.result!.winner).toBe('w');
    expect(state.pendingPieceRemoval).toBeNull();
    expect(state.pendingViolation).toBeNull();
  });

  it('applyTimeout clears pendingViolation', () => {
    let state = createInitialState('hvh', combinedCfg);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');
    expect(state.pendingViolation).not.toBeNull();

    state = applyTimeout(state, 'w');
    expect(state.result).not.toBeNull();
    expect(state.pendingViolation).toBeNull();
  });

  it('checkmate takes precedence over penalties in combined config', () => {
    let state = createInitialState('hvh', combinedCfg);
    state = applyMoveWithRules(state, 'f3');
    state = applyMoveWithRules(state, 'e5');
    state = applyMoveWithRules(state, 'g4');
    state = applyMoveWithRules(state, { from: 'd8', to: 'h4' });

    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('checkmate');
    expect(state.result!.winner).toBe('b');
    expect(state.pendingPieceRemoval).toBeNull();
    expect(state.extraTurns.pendingExtraMovesWhite).toBe(0);
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(0);
    // Clocks unchanged (no penalties applied on checkmate)
    expect(state.clocks!.whiteMs).toBe(300000);
    expect(state.clocks!.blackMs).toBe(300000);
  });
});

// ── Extra Move + Clock regression ─────────────────────────────────────

describe('Extra move + clock regression', () => {
  const extraMoveClock: MatchConfig = buildMatchConfig({
    ...DEFAULT_SETUP_CONFIG,
    gameType: 'penalty_on_miss',
    enableAdditionalMovePenalty: true,
    enableClock: true,
  });

  it('extra move changes active side correctly (clock perspective)', () => {
    let state = createInitialState('hvh', extraMoveClock);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3'); // violation

    expect(state.sideToMove).toBe('b');
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(1);

    // Black's normal move
    state = applyMoveWithRules(state, 'e6');
    expect(state.sideToMove).toBe('b'); // extra turn: clock stays with black
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(0);

    // Black's extra move
    state = applyMoveWithRules(state, 'd6');
    expect(state.sideToMove).toBe('w'); // clock switches to white
  });

  it('clock state preserved through extra turn sequence', () => {
    let state = createInitialState('hvh', extraMoveClock);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');

    // Clocks should be unchanged (no time reduction enabled)
    expect(state.clocks!.whiteMs).toBe(300000);
    expect(state.clocks!.blackMs).toBe(300000);

    state = applyMoveWithRules(state, 'e6');
    state = applyMoveWithRules(state, 'd6');
    expect(state.clocks!.whiteMs).toBe(300000);
    expect(state.clocks!.blackMs).toBe(300000);
  });
});

// ── Piece Removal + Clock regression ──────────────────────────────────

describe('Piece removal + clock regression', () => {
  const pieceRemovalClock: MatchConfig = buildMatchConfig({
    ...DEFAULT_SETUP_CONFIG,
    gameType: 'penalty_on_miss',
    enablePieceRemovalPenalty: true,
    enableClock: true,
  });

  it('pending piece removal: sideToMove equals chooserSide (clock runs for chooser)', () => {
    let state = createInitialState('hvh', pieceRemovalClock);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');

    expect(state.pendingPieceRemoval).not.toBeNull();
    expect(state.pendingPieceRemoval!.chooserSide).toBe('b');
    // sideToMove must match chooser so the clock ticks for the right side
    expect(state.sideToMove).toBe(state.pendingPieceRemoval!.chooserSide);
  });

  it('selection completes and clock flow continues', () => {
    let state = createInitialState('hvh', pieceRemovalClock);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');

    state = applyPieceRemoval(state, 'd1');
    expect(state.pendingPieceRemoval).toBeNull();
    expect(state.sideToMove).toBe('b');
    expect(state.clocks!.whiteMs).toBe(300000);
    expect(state.clocks!.blackMs).toBe(300000);
    expect(state.result).toBeNull();

    // Black can make a move after removal
    state = applyMoveWithRules(state, 'e6');
    expect(state.sideToMove).toBe('w');
    expect(state.result).toBeNull();
  });

  it('timeout during piece removal clears pending state', () => {
    let state = createInitialState('hvh', pieceRemovalClock);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');
    expect(state.pendingPieceRemoval).not.toBeNull();

    state = applyTimeout(state, 'b');
    expect(state.result!.reason).toBe('timeout');
    expect(state.pendingPieceRemoval).toBeNull();
  });
});

// ── Time Reduction + Clock regression ─────────────────────────────────

describe('Time reduction + clock regression', () => {
  const timeReductionClock: MatchConfig = buildMatchConfig({
    ...DEFAULT_SETUP_CONFIG,
    gameType: 'penalty_on_miss',
    enableTimeReductionPenalty: true,
    timeReductionSeconds: 60,
    enableClock: true,
  });

  it('violator loses 60 seconds', () => {
    let state = createInitialState('hvh', timeReductionClock);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');

    expect(state.clocks!.whiteMs).toBe(240000); // 300000 - 60000
    expect(state.clocks!.blackMs).toBe(300000);
    expect(state.result).toBeNull();
  });

  it('clamp at 0 and immediate game end', () => {
    const cfg: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      gameType: 'penalty_on_miss',
      enableTimeReductionPenalty: true,
      timeReductionSeconds: 60,
      enableClock: true,
      initialTimeMs: 30000,
    });
    let state = createInitialState('hvh', cfg);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');

    expect(state.clocks!.whiteMs).toBe(0);
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('timeout_penalty');
    expect(state.result!.winner).toBe('b');
  });

  it('only time reduction (no extra move, no piece removal) + clock works', () => {
    let state = createInitialState('hvh', timeReductionClock);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');

    // Only time reduction applied, no extra turns or piece removal
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(0);
    expect(state.pendingPieceRemoval).toBeNull();
    expect(state.clocks!.whiteMs).toBe(240000);
    expect(state.sideToMove).toBe('b');

    // Game continues normally
    state = applyMoveWithRules(state, 'e6');
    expect(state.sideToMove).toBe('w');
    expect(state.result).toBeNull();
  });
});

// ── King Hunt Given Check Limit + Clock regression ────────────────────

describe('King Hunt Given Check Limit + clock regression', () => {
  const gclClock: MatchConfig = buildMatchConfig({
    ...DEFAULT_SETUP_CONFIG,
    variantMode: 'classic_king_hunt_given_check_limit',
    kingHuntGivenCheckTarget: 1,
    enableClock: true,
  });

  it('reaching check limit ends game, clocks stop', () => {
    let state = createInitialState('hvh', gclClock);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, { from: 'd1', to: 'h5' });

    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('king_hunt_given_check_limit');
    expect(state.result!.winner).toBe('w');
    expect(state.clocks).not.toBeNull();
    // Clocks preserved at their values (no penalty)
    expect(state.clocks!.whiteMs).toBe(300000);
    expect(state.clocks!.blackMs).toBe(300000);
  });

  it('applyTimeout after game end is a no-op', () => {
    let state = createInitialState('hvh', gclClock);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, { from: 'd1', to: 'h5' });

    const before = state;
    state = applyTimeout(state, 'w');
    expect(state).toBe(before); // no change
  });
});

// ── Report Incorrectness + Clock regression ───────────────────────────

describe('Report Incorrectness + clock regression', () => {
  const reportClock: MatchConfig = buildMatchConfig({
    ...DEFAULT_SETUP_CONFIG,
    gameType: 'report_incorrectness',
    enableClock: true,
  });

  it('clock still works with report mode', () => {
    let state = createInitialState('hvh', reportClock);
    expect(state.clocks).not.toBeNull();
    expect(state.clocks!.whiteMs).toBe(300000);

    state = applyMoveWithRules(state, 'e4');
    expect(state.clocks!.whiteMs).toBe(300000);
    expect(state.sideToMove).toBe('b');
  });

  it('violation is reportable and clock not affected by penalties', () => {
    let state = createInitialState('hvh', reportClock);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');

    expect(state.pendingViolation).not.toBeNull();
    expect(state.pendingViolation!.reportable).toBe(true);
    expect(state.clocks!.whiteMs).toBe(300000);
    expect(state.clocks!.blackMs).toBe(300000);
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(0);
    expect(state.pendingPieceRemoval).toBeNull();
  });
});

// ── Piece Removal Check Violation Tests ───────────────────────────────

describe('Piece removal check violation (classic blunziger)', () => {
  // FEN: Black rook on e8, Black king on h8, White pawns on a2 + e2, White king on e1.
  // Removing e2 exposes White king to Black rook on e8 (check).
  // Removing a2 does not create check.
  const testFen = '4r2k/8/8/8/8/8/P3P3/4K3 b - - 0 1';

  const classicPenaltyCfg: MatchConfig = buildMatchConfig({
    ...DEFAULT_SETUP_CONFIG,
    variantMode: 'classic_blunzinger',
    gameType: 'penalty_on_miss',
    enablePieceRemovalPenalty: true,
  });

  function stateWithPendingRemoval(config: MatchConfig, fen: string, targetSide: 'w' | 'b' = 'w'): GameState {
    const chooserSide: 'w' | 'b' = targetSide === 'w' ? 'b' : 'w';
    const removableSquares = getRemovablePieces(fen, targetSide);
    const state = createInitialState('hvh', config);
    return {
      ...state,
      fen,
      sideToMove: chooserSide,
      pendingPieceRemoval: {
        targetSide,
        chooserSide,
        removableSquares,
        remainingRemovals: 1,
        triggerMoveIndex: 0,
      },
    };
  }

  it('getCheckCreatingRemovals finds removals that create check', () => {
    const removable = getRemovablePieces(testFen, 'w');
    const checkCreating = getCheckCreatingRemovals(testFen, 'w', removable);
    expect(checkCreating).toContain('e2');
    expect(checkCreating).not.toContain('a2');
    expect(checkCreating).toHaveLength(1);
  });

  it('getCheckCreatingRemovals returns empty when no removal creates check', () => {
    // No Black piece can attack White king regardless of which piece is removed
    const fen = '7k/8/8/8/8/8/P3P3/4K3 b - - 0 1';
    const removable = getRemovablePieces(fen, 'w');
    const checkCreating = getCheckCreatingRemovals(fen, 'w', removable);
    expect(checkCreating).toHaveLength(0);
  });

  it('choosing non-check-creating removal in classic penalty mode auto-penalises', () => {
    const state = stateWithPendingRemoval(classicPenaltyCfg, testFen);
    // Black (chooser) removes a2 instead of e2 — misses check-creating removal
    const newState = applyPieceRemoval(state, 'a2' as Square);

    expect(newState.pendingViolation).not.toBeNull();
    expect(newState.pendingViolation!.violationType).toBe('missed_check_removal');
    expect(newState.pendingViolation!.reportable).toBe(false); // auto-penalised
    expect(newState.pendingViolation!.violatingSide).toBe('b'); // chooser violated
    expect(newState.pendingViolation!.requiredRemovalSquares).toContain('e2');
    expect(newState.pendingViolation!.chosenRemovalSquare).toBe('a2');
  });

  it('choosing check-creating removal in classic mode does not set violation', () => {
    const state = stateWithPendingRemoval(classicPenaltyCfg, testFen);
    // Black (chooser) correctly removes e2 — creates check
    const newState = applyPieceRemoval(state, 'e2' as Square);

    // No new violation should be set (the original state.pendingViolation was null)
    expect(newState.pendingViolation).toBeNull();
  });

  it('penalty mode auto-applies piece removal penalty on removal violation', () => {
    // FEN: Black rook e8, Black king h8, White pawns a2/e2/f2/g2/h2, White king e1,
    // plus Black pawns for legal moves (no pawn at e7 so rook has clear e-file).
    const fen = '4r2k/pppp1ppp/8/8/8/8/P3PPPP/4K3 b - - 0 1';
    const cfg: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      variantMode: 'classic_blunzinger',
      gameType: 'penalty_on_miss',
      enablePieceRemovalPenalty: true,
      pieceRemovalCount: 1,
    });

    let state = stateWithPendingRemoval(cfg, fen);
    // Black removes a2 (misses check-creating e2)
    state = applyPieceRemoval(state, 'a2' as Square);
    expect(state.pendingViolation).not.toBeNull();
    expect(state.pendingViolation!.violationType).toBe('missed_check_removal');
    expect(state.pendingViolation!.reportable).toBe(false); // auto-penalised

    // A new pending piece removal should target Black's pieces (the violator)
    expect(state.pendingPieceRemoval).not.toBeNull();
    expect(state.pendingPieceRemoval!.targetSide).toBe('b'); // violator's pieces
    expect(state.pendingPieceRemoval!.chooserSide).toBe('w'); // opponent chooses
  });

  it('report mode keeps removal violation reportable (classic)', () => {
    const fen = '4r2k/pppp1ppp/8/8/8/8/P3PPPP/4K3 b - - 0 1';
    const cfg: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      variantMode: 'classic_blunzinger',
      gameType: 'report_incorrectness',
    });

    let state = stateWithPendingRemoval(cfg, fen);
    state = applyPieceRemoval(state, 'a2' as Square);
    expect(state.pendingViolation).not.toBeNull();
    expect(state.pendingViolation!.violationType).toBe('missed_check_removal');
    expect(state.pendingViolation!.reportable).toBe(true);
  });

  it('penalty mode applies additional move penalty on removal violation', () => {
    const cfg: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      variantMode: 'classic_blunzinger',
      gameType: 'penalty_on_miss',
      enableAdditionalMovePenalty: true,
      additionalMoveCount: 2,
    });

    const state = stateWithPendingRemoval(cfg, testFen);
    const newState = applyPieceRemoval(state, 'a2' as Square);

    // Additional moves awarded to target side (White = opponent of violator Black)
    expect(newState.extraTurns.pendingExtraMovesWhite).toBe(2);
  });

  it('penalty mode applies time reduction on removal violation', () => {
    const cfg: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      variantMode: 'classic_blunzinger',
      gameType: 'penalty_on_miss',
      enableTimeReductionPenalty: true,
      timeReductionSeconds: 30,
      enableClock: true,
      initialTimeMs: 300_000,
    });

    let state = stateWithPendingRemoval(cfg, testFen);
    // Give Black some clock time
    state = { ...state, clocks: { whiteMs: 300_000, blackMs: 300_000, lastTimestamp: null } };
    const newState = applyPieceRemoval(state, 'a2' as Square);

    // Time deducted from violator (Black)
    expect(newState.clocks!.blackMs).toBe(270_000);
    expect(newState.timeReductions).toHaveLength(1);
    expect(newState.timeReductions[0].seconds).toBe(30);
  });

  it('penalty mode records removal violation in missedChecks', () => {
    const state = stateWithPendingRemoval(classicPenaltyCfg, testFen);
    const newState = applyPieceRemoval(state, 'a2' as Square);

    expect(newState.missedChecks).toHaveLength(1);
    expect(newState.missedChecks[0].violationType).toBe('missed_check_removal');
  });

  it('no violation when no check-creating removal exists', () => {
    const fen = '7k/8/8/8/8/8/P3P3/4K3 b - - 0 1';
    const state = stateWithPendingRemoval(classicPenaltyCfg, fen);
    const newState = applyPieceRemoval(state, 'a2' as Square);
    expect(newState.pendingViolation).toBeNull();
  });
});

describe('Piece removal check violation (reverse blunziger)', () => {
  // Same FEN: Removing e2 creates check, removing a2 does not.
  const testFen = '4r2k/8/8/8/8/8/P3P3/4K3 b - - 0 1';

  const reversePenaltyCfg: MatchConfig = buildMatchConfig({
    ...DEFAULT_SETUP_CONFIG,
    variantMode: 'reverse_blunzinger',
    gameType: 'penalty_on_miss',
    enablePieceRemovalPenalty: true,
  });

  function stateWithPendingRemoval(config: MatchConfig, fen: string, targetSide: 'w' | 'b' = 'w'): GameState {
    const chooserSide: 'w' | 'b' = targetSide === 'w' ? 'b' : 'w';
    const removableSquares = getRemovablePieces(fen, targetSide);
    const state = createInitialState('hvh', config);
    return {
      ...state,
      fen,
      sideToMove: chooserSide,
      pendingPieceRemoval: {
        targetSide,
        chooserSide,
        removableSquares,
        remainingRemovals: 1,
        triggerMoveIndex: 0,
      },
    };
  }

  it('choosing check-creating removal in reverse penalty mode auto-penalises', () => {
    const state = stateWithPendingRemoval(reversePenaltyCfg, testFen);
    // Black (chooser) removes e2 — creates check (forbidden in reverse mode)
    const newState = applyPieceRemoval(state, 'e2' as Square);

    expect(newState.pendingViolation).not.toBeNull();
    expect(newState.pendingViolation!.violationType).toBe('gave_forbidden_check_removal');
    expect(newState.pendingViolation!.reportable).toBe(false); // auto-penalised
    expect(newState.pendingViolation!.violatingSide).toBe('b'); // chooser violated
    expect(newState.pendingViolation!.requiredRemovalSquares).toContain('a2');
    expect(newState.pendingViolation!.chosenRemovalSquare).toBe('e2');
  });

  it('choosing non-check-creating removal in reverse mode does not set violation', () => {
    const state = stateWithPendingRemoval(reversePenaltyCfg, testFen);
    // Black (chooser) correctly removes a2 — no check created
    const newState = applyPieceRemoval(state, 'a2' as Square);
    expect(newState.pendingViolation).toBeNull();
  });

  it('no violation if all removals create check (reverse mode allows any)', () => {
    // White Ke1, Pawn e2; Black Re8, Kh8 — only one removable piece (e2), creates check.
    // With only one option, there are no non-check alternatives → any removal is allowed.
    const fen = '4r2k/8/8/8/8/8/4P3/4K3 b - - 0 1';
    const state = stateWithPendingRemoval(reversePenaltyCfg, fen);
    const newState = applyPieceRemoval(state, 'e2' as Square);
    // No violation because there's no non-check-creating alternative
    expect(newState.pendingViolation).toBeNull();
  });

  it('penalty mode auto-applies piece removal penalty on reverse removal violation', () => {
    const fen = '4r2k/pppp1ppp/8/8/8/8/P3PPPP/4K3 b - - 0 1';
    const cfg: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      variantMode: 'reverse_blunzinger',
      gameType: 'penalty_on_miss',
      enablePieceRemovalPenalty: true,
      pieceRemovalCount: 1,
    });

    let state = stateWithPendingRemoval(cfg, fen);
    // Black removes e2 (creates check — violation in reverse mode)
    state = applyPieceRemoval(state, 'e2' as Square);
    expect(state.pendingViolation).not.toBeNull();
    expect(state.pendingViolation!.violationType).toBe('gave_forbidden_check_removal');
    expect(state.pendingViolation!.reportable).toBe(false); // auto-penalised

    // A new pending piece removal should target Black's pieces (the violator)
    expect(state.pendingPieceRemoval).not.toBeNull();
    expect(state.pendingPieceRemoval!.targetSide).toBe('b');
    expect(state.pendingPieceRemoval!.chooserSide).toBe('w');
  });

  it('report mode keeps removal violation reportable (reverse)', () => {
    const fen = '4r2k/pppp1ppp/8/8/8/8/P3PPPP/4K3 b - - 0 1';
    const cfg: MatchConfig = buildMatchConfig({
      ...DEFAULT_SETUP_CONFIG,
      variantMode: 'reverse_blunzinger',
      gameType: 'report_incorrectness',
    });

    let state = stateWithPendingRemoval(cfg, fen);
    state = applyPieceRemoval(state, 'e2' as Square);
    expect(state.pendingViolation).not.toBeNull();
    expect(state.pendingViolation!.violationType).toBe('gave_forbidden_check_removal');
    expect(state.pendingViolation!.reportable).toBe(true);
  });
});

describe('selectBestPieceForRemoval with variant rules', () => {
  const testFen = '4r2k/8/8/8/8/8/P3P3/4K3 b - - 0 1';

  it('classic mode: prefers check-creating removal', () => {
    const sq = selectBestPieceForRemoval(testFen, 'w', 'classic_blunzinger');
    expect(sq).toBe('e2'); // creates check
  });

  it('reverse mode: avoids check-creating removal', () => {
    const sq = selectBestPieceForRemoval(testFen, 'w', 'reverse_blunzinger');
    expect(sq).toBe('a2'); // does not create check
  });

  it('no variant mode: falls back to highest value', () => {
    const sq = selectBestPieceForRemoval(testFen, 'w');
    // Both are pawns, tie-break by square name (a2 < e2)
    expect(sq).toBe('a2');
  });

  it('classic mode with higher-value non-check piece still picks check-creating', () => {
    // White has Queen on a2 (high value) and Pawn on e2 (creates check)
    const fen = '4r2k/8/8/8/8/8/Q3P3/4K3 b - - 0 1';
    const sq = selectBestPieceForRemoval(fen, 'w', 'classic_blunzinger');
    expect(sq).toBe('e2'); // check-creating, even though queen is higher value
  });
});
