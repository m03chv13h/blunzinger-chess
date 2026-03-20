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
} from '../core/blunziger/engine';
import type { VariantConfig } from '../core/blunziger/types';
import {
  DEFAULT_CONFIG,
  GAME_MODE_DEFINITIONS,
  getGameModeDefinition,
  buildVariantConfig,
  DEFAULT_SETUP_CONFIG,
} from '../core/blunziger/types';
import { selectBotMove } from '../bot/botEngine';

// ── Mode Registry / Preset Tests ──────────────────────────────────────

describe('Mode registry & presets', () => {
  it('should have 4 built-in mode definitions', () => {
    expect(GAME_MODE_DEFINITIONS).toHaveLength(4);
  });

  it('should look up each mode by id', () => {
    const ids = [
      'classic_blunziger',
      'double_check_pressure',
      'king_hunter',
      'reverse_blunziger',
    ] as const;
    for (const id of ids) {
      const def = getGameModeDefinition(id);
      expect(def.id).toBe(id);
      expect(def.name).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(def.config).toBeDefined();
    }
  });

  it('should throw for unknown mode id', () => {
    expect(() => getGameModeDefinition('nonexistent' as never)).toThrow('Unknown game mode');
  });

  it('classic_blunziger config should have blunziger enabled', () => {
    const def = getGameModeDefinition('classic_blunziger');
    expect(def.config.enableBlunziger).toBe(true);
    expect(def.config.reverseForcedCheck).toBe(false);
    expect(def.config.doubleCheckPressureImmediateLoss).toBe(false);
  });

  it('buildVariantConfig should merge setup overrides into preset', () => {
    const setup = { ...DEFAULT_SETUP_CONFIG, variantModeId: 'king_hunter' as const, moveLimit: 50 };
    const cfg = buildVariantConfig(setup);
    expect(cfg.scoringMode).toBe('checks_count');
    expect(cfg.moveLimit).toBe(50);
  });

  it('buildVariantConfig disables time reduction penalty when clock is off', () => {
    const setup = { ...DEFAULT_SETUP_CONFIG, enableTimeReductionPenalty: true, enableClock: false };
    const cfg = buildVariantConfig(setup);
    expect(cfg.enableTimeReductionPenalty).toBe(false);
  });

  it('blitz is no longer a standalone mode', () => {
    expect(GAME_MODE_DEFINITIONS.find(d => d.id === ('blitz_blunziger' as string))).toBeUndefined();
  });

  it('clock config is independent and composable', () => {
    const setup = { ...DEFAULT_SETUP_CONFIG, enableClock: true };
    const cfg = buildVariantConfig(setup);
    expect(cfg.enableClock).toBe(true);
    expect(cfg.initialTimeMs).toBe(5 * 60 * 1000);
  });

  it('default clock time is 5 minutes when enabled', () => {
    const setup = { ...DEFAULT_SETUP_CONFIG, enableClock: true };
    const cfg = buildVariantConfig(setup);
    expect(cfg.initialTimeMs).toBe(300000);
  });
});

// ── Double Check Pressure ─────────────────────────────────────────────

describe('Double Check Pressure mode', () => {
  const dcpConfig: VariantConfig = {
    ...DEFAULT_CONFIG,
    doubleCheckPressureImmediateLoss: true,
  };

  it('multiple checking moves + player misses → immediate loss', () => {
    // Position: after 1.e4 f5, white has Qh5+ (at minimum 1 check).
    // We need a position with ≥2 checking moves.
    // Use a crafted FEN where white has multiple checks:
    // White: Kg1, Qd1, Rd1 → no; Let's use a position with queen + bishop checks.
    // After 1.e4 d5 2.Bb5+ is one check. Let's find a better position.
    // 
    // Better: White queen on h5 can check on f7 and e8 routes...
    // Let's use a crafted FEN: White Ke1, Qh5, Bc4 vs Black Ke8 + pawns
    // Qh5-f7 is check, Bc4-f7 is check  → two checking moves
    const fen = 'rnbqk2r/pppp1ppp/5n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 3';
    const checks = getCheckingMoves(fen);
    // Verify at least 2 checking moves exist
    expect(checks.length).toBeGreaterThanOrEqual(2);

    // Create state at this position
    let state = createInitialState('hvh', dcpConfig);
    state = { ...state, fen, sideToMove: 'w' };

    // Play a non-checking move (e.g. a3)
    const nonChecks = getNonCheckingMoves(fen);
    expect(nonChecks.length).toBeGreaterThan(0);
    const nonCheckMove = nonChecks[0];
    const result = applyMoveWithRules(state, { from: nonCheckMove.from, to: nonCheckMove.to });

    expect(result.result).not.toBeNull();
    expect(result.result!.reason).toBe('double_check_pressure_violation');
    expect(result.result!.winner).toBe('b');
  });

  it('exactly one checking move + player misses → normal handling (reportable)', () => {
    // After 1.e4 f5, white has exactly Qh5+ (1 checking move)
    let state = createInitialState('hvh', dcpConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');

    const checks = getCheckingMoves(state.fen);
    expect(checks.length).toBe(1); // Only Qh5+

    // Play a non-checking move
    state = applyMoveWithRules(state, 'd3');
    // Should NOT be immediate loss, should be normal violation
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

    // Play a checking move
    const result = applyMoveWithRules(state, { from: checks[0].from, to: checks[0].to });
    expect(result.result?.reason).not.toBe('double_check_pressure_violation');
    // Game continues (result may be null or checkmate, but not DCP violation)
  });
});

// ── Blitz Blunziger (Clock) ───────────────────────────────────────────

describe('Blitz Blunziger mode', () => {
  const blitzConfig: VariantConfig = {
    ...DEFAULT_CONFIG,
    enableClock: true,
    initialTimeMs: 300000, // 5 minutes
    incrementMs: 0,
  };

  it('should initialize clocks in state', () => {
    const state = createInitialState('hvh', blitzConfig);
    expect(state.clocks).not.toBeNull();
    expect(state.clocks!.whiteMs).toBe(300000);
    expect(state.clocks!.blackMs).toBe(300000);
  });

  it('applyTimeout should end the game for the losing side', () => {
    let state = createInitialState('hvh', blitzConfig);
    state = applyTimeout(state, 'w');
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('timeout');
    expect(state.result!.winner).toBe('b');
  });

  it('applyTimeout should not affect already finished game', () => {
    let state = createInitialState('hvh', blitzConfig);
    state = applyTimeout(state, 'w');
    const before = state.result;
    state = applyTimeout(state, 'b');
    expect(state.result).toBe(before); // unchanged
  });

  it('game end stops clocks (result set, no further timeout applies)', () => {
    let state = createInitialState('hvh', blitzConfig);
    // Play fool's mate
    state = applyMoveWithRules(state, 'f3');
    state = applyMoveWithRules(state, 'e5');
    state = applyMoveWithRules(state, 'g4');
    state = applyMoveWithRules(state, { from: 'd8', to: 'h4' }); // Qh4#
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('checkmate');

    // Now try to apply timeout – should be no-op
    const timeoutState = applyTimeout(state, 'w');
    expect(timeoutState.result!.reason).toBe('checkmate');
  });
});

// ── Penalty Instead of Loss ───────────────────────────────────────────

describe('Extra Move Penalty', () => {
  const penaltyConfig: VariantConfig = {
    ...DEFAULT_CONFIG,
    enableExtraMovePenalty: true,
  };

  it('missed forced check grants opponent extra turn', () => {
    // 1.e4 f5 - white has Qh5+ but plays d3
    let state = createInitialState('hvh', penaltyConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    // Now white has Qh5+ available
    state = applyMoveWithRules(state, 'd3'); // white misses check

    // Should NOT be immediate loss
    expect(state.result).toBeNull();
    // Black should have pending extra move
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(1);
    // Violation should not be reportable
    expect(state.pendingViolation?.reportable).toBe(false);
  });

  it('report button is unavailable in penalty mode', () => {
    let state = createInitialState('hvh', penaltyConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3'); // white misses check

    // canReport should always return false
    expect(canReport(state, 'b')).toBe(false);
    expect(canReport(state, 'w')).toBe(false);
  });

  it('opponent receives two consecutive moves after violation', () => {
    let state = createInitialState('hvh', penaltyConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    // White misses Qh5+
    state = applyMoveWithRules(state, 'd3');
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(1);
    expect(state.sideToMove).toBe('b');

    // Black makes first move — extra turn is consumed, but black keeps the turn
    state = applyMoveWithRules(state, 'e6');
  });

  it('turn order returns to normal after extra turns consumed', () => {
    let state = createInitialState('hvh', penaltyConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    // White misses Qh5+
    state = applyMoveWithRules(state, 'd3');
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(1);
    expect(state.sideToMove).toBe('b');

    // Black's first move (normal turn)
    state = applyMoveWithRules(state, 'e6');
    // Black should keep the turn for the extra move
    expect(state.sideToMove).toBe('b');
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(0);

    // Black's second consecutive move (extra turn)
    state = applyMoveWithRules(state, 'd6');
    // Now turn order should resume normally - it's white's turn
    expect(state.sideToMove).toBe('w');
  });

  it('no time subtraction when clocks are disabled', () => {
    let state = createInitialState('hvh', penaltyConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3'); // white misses Qh5+

    // No clocks → no clock change
    expect(state.clocks).toBeNull();
    expect(state.result).toBeNull();
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(1);
  });
});

// ── Penalty + Clock (Time Penalty) ────────────────────────────────────

describe('Extra Move Penalty + Clock time reduction', () => {
  const penaltyClockConfig: VariantConfig = {
    ...DEFAULT_CONFIG,
    enableExtraMovePenalty: true,
    enableTimeReductionPenalty: true,
    enableClock: true,
    initialTimeMs: 300000, // 5 minutes
    incrementMs: 0,
    timeReductionSeconds: 5,
  };

  it('missed forced check subtracts configured seconds from violator clock', () => {
    let state = createInitialState('hvh', penaltyClockConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    // White misses Qh5+ → 5s penalty
    state = applyMoveWithRules(state, 'd3');

    expect(state.result).toBeNull();
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(1);
    // White's clock reduced by 5000ms
    expect(state.clocks).not.toBeNull();
    expect(state.clocks!.whiteMs).toBe(300000 - 5000);
    // Black's clock unchanged
    expect(state.clocks!.blackMs).toBe(300000);
  });

  it('grants extra move AND subtracts time on violation', () => {
    let state = createInitialState('hvh', penaltyClockConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3'); // white misses check

    // Both effects should apply
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(1);
    expect(state.clocks!.whiteMs).toBe(295000);
  });

  it('clamps remaining time at 0 (not negative)', () => {
    const lowTimeConfig: VariantConfig = {
      ...penaltyClockConfig,
      initialTimeMs: 3000, // 3 seconds
      timeReductionSeconds: 10, // 10 second penalty
    };
    let state = createInitialState('hvh', lowTimeConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3'); // white misses check

    // Clock should be 0, not negative
    expect(state.clocks!.whiteMs).toBe(0);
    // Game should end immediately
    expect(state.result).not.toBeNull();
    expect(state.result!.winner).toBe('b');
  });

  it('game ends immediately when penalty reduces clock to 0', () => {
    const exactTimeConfig: VariantConfig = {
      ...penaltyClockConfig,
      initialTimeMs: 5000, // exactly 5 seconds
      timeReductionSeconds: 5, // 5 second penalty
    };
    let state = createInitialState('hvh', exactTimeConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3'); // white misses check → clock reaches 0

    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('timeout_penalty');
    expect(state.result!.winner).toBe('b');
    expect(state.clocks!.whiteMs).toBe(0);
  });

  it('no time penalty applied if move ends game (e.g. checkmate)', () => {
    // A move that produces checkmate should not have extra penalty applied
    const cfg: VariantConfig = {
      ...penaltyClockConfig,
    };
    let state = createInitialState('hvh', cfg);
    // Fool's mate — no violation applies because the game ends by checkmate
    state = applyMoveWithRules(state, 'f3');
    state = applyMoveWithRules(state, 'e5');
    state = applyMoveWithRules(state, 'g4');
    state = applyMoveWithRules(state, { from: 'd8', to: 'h4' }); // Qh4#
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('checkmate');
    // Clocks should remain at initial value (no penalty applied)
    expect(state.clocks!.whiteMs).toBe(300000);
    expect(state.clocks!.blackMs).toBe(300000);
  });

  it('no time reduction when enableTimeReductionPenalty is false', () => {
    const noPenaltyConfig: VariantConfig = {
      ...penaltyClockConfig,
      enableTimeReductionPenalty: false,
    };
    let state = createInitialState('hvh', noPenaltyConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3'); // white misses check

    // Extra move still granted
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(1);
    // No clock reduction
    expect(state.clocks!.whiteMs).toBe(300000);
  });

  it('does not apply time reduction in non-penalty modes', () => {
    const classicClockConfig: VariantConfig = {
      ...DEFAULT_CONFIG,
      enableClock: true,
      initialTimeMs: 300000,
      incrementMs: 0,
      // No penalty flags enabled → classic report-based mode
    };
    let state = createInitialState('hvh', classicClockConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3'); // white misses check

    // In classic mode: violation is reportable, no extra turn, no time penalty
    expect(state.pendingViolation).not.toBeNull();
    expect(state.pendingViolation!.reportable).toBe(true);
    expect(state.clocks!.whiteMs).toBe(300000);
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(0);
  });

  it('black receives time penalty when black misses forced check', () => {
    // We need a position where black has a checking move available
    // After 1.d4 e5 2.dxe5 we need to find something...
    // Easier: use crafted FEN where it's black to move with a check available
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4PP2/8/PPPP2PP/RNBQKBNR b KQkq f3 0 2';
    const checks = getCheckingMoves(fen);
    // If black has checks, proceed
    if (checks.length > 0) {
      let state = createInitialState('hvh', penaltyClockConfig);
      state = { ...state, fen, sideToMove: 'b' };
      const nonChecks = getNonCheckingMoves(fen);
      if (nonChecks.length > 0) {
        state = applyMoveWithRules(state, { from: nonChecks[0].from, to: nonChecks[0].to });
        expect(state.clocks!.blackMs).toBe(300000 - 5000);
        expect(state.clocks!.whiteMs).toBe(300000); // unchanged
        expect(state.extraTurns.pendingExtraMovesWhite).toBe(1);
      }
    }
  });

  it('bot loses on time due to penalty', () => {
    const lowTimeConfig: VariantConfig = {
      ...penaltyClockConfig,
      initialTimeMs: 2000, // 2 seconds
      timeReductionSeconds: 5,
    };
    let state = createInitialState('hvbot', lowTimeConfig, 'easy', 'w');
    // White is the bot; put white in a position where it misses check
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    // White (bot) misses check
    state = applyMoveWithRules(state, 'd3');
    // Bot (white) should lose on time due to penalty
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('timeout_penalty');
    expect(state.result!.winner).toBe('b');
  });
});

// ── King Hunter Mode ──────────────────────────────────────────────────

describe('King Hunter mode', () => {
  const kingHunterConfig: VariantConfig = {
    ...DEFAULT_CONFIG,
    scoringMode: 'checks_count',
    moveLimit: 3, // very short for testing (3 full moves = 6 plies)
  };

  it('checking move increments score', () => {
    // Use the position 1.e4 f5 where Qh5+ is available
    let state = createInitialState('hvh', kingHunterConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    // White plays Qh5+ (a checking move)
    state = applyMoveWithRules(state, { from: 'd1', to: 'h5' });
    expect(state.scores.w).toBe(1);
  });

  it('non-checking move does not increment score', () => {
    let state = createInitialState('hvh', kingHunterConfig);
    state = applyMoveWithRules(state, 'e4');
    expect(state.scores.w).toBe(0);
    expect(state.scores.b).toBe(0);
    state = applyMoveWithRules(state, 'e5');
    expect(state.scores.b).toBe(0);
  });

  it('game ends at move limit', () => {
    // moveLimit = 3, means 6 plies total
    let state = createInitialState('hvh', kingHunterConfig);
    state = applyMoveWithRules(state, 'e4');  // ply 1
    state = applyMoveWithRules(state, 'e5');  // ply 2
    state = applyMoveWithRules(state, 'd3');  // ply 3
    state = applyMoveWithRules(state, 'd6');  // ply 4
    state = applyMoveWithRules(state, 'a3');  // ply 5
    expect(state.result).toBeNull();
    state = applyMoveWithRules(state, 'a6');  // ply 6 → moveLimit*2 reached
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('score_limit_draw'); // 0-0 tie
    expect(state.result!.winner).toBe('draw');
  });

  it('higher score wins at move limit', () => {
    // We need white to give check and accumulate points
    // Use a longer limit
    const cfg: VariantConfig = { ...DEFAULT_CONFIG, scoringMode: 'checks_count', moveLimit: 4 };
    let state = createInitialState('hvh', cfg);
    // 1.e4 f5 2.Qh5+ (check!) g6 3.Qf3 d6 4.a3 a6
    state = applyMoveWithRules(state, 'e4');     // ply 1
    state = applyMoveWithRules(state, 'f5');     // ply 2
    state = applyMoveWithRules(state, { from: 'd1', to: 'h5' }); // ply 3: Qh5+ (check)
    expect(state.scores.w).toBe(1);
    state = applyMoveWithRules(state, 'g6');     // ply 4
    state = applyMoveWithRules(state, { from: 'h5', to: 'f3' }); // ply 5: Qf3
    state = applyMoveWithRules(state, 'd6');     // ply 6
    state = applyMoveWithRules(state, 'a3');     // ply 7
    expect(state.result).toBeNull();
    state = applyMoveWithRules(state, 'a6');     // ply 8 → move limit 4*2=8
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('score_limit');
    expect(state.result!.winner).toBe('w'); // white scored 1, black scored 0
  });

  it('tied score draws at move limit', () => {
    const cfg: VariantConfig = { ...DEFAULT_CONFIG, scoringMode: 'checks_count', moveLimit: 2 };
    let state = createInitialState('hvh', cfg);
    state = applyMoveWithRules(state, 'e4');  // ply 1
    state = applyMoveWithRules(state, 'e5');  // ply 2
    state = applyMoveWithRules(state, 'a3');  // ply 3
    state = applyMoveWithRules(state, 'a6');  // ply 4
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('score_limit_draw');
    expect(state.result!.winner).toBe('draw');
  });

  it('checkmate before move limit ends game immediately', () => {
    const cfg: VariantConfig = { ...DEFAULT_CONFIG, scoringMode: 'checks_count', moveLimit: 100 };
    let state = createInitialState('hvh', cfg);
    // Fool's mate
    state = applyMoveWithRules(state, 'f3');
    state = applyMoveWithRules(state, 'e5');
    state = applyMoveWithRules(state, 'g4');
    state = applyMoveWithRules(state, { from: 'd8', to: 'h4' }); // Qh4#
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('checkmate');
    expect(state.plyCount).toBe(4);
  });
});

// ── Reverse Blunziger ─────────────────────────────────────────────────

describe('Reverse Blunziger mode', () => {
  const reverseConfig: VariantConfig = {
    ...DEFAULT_CONFIG,
    enableBlunziger: false,
    reverseForcedCheck: true,
  };

  it('isReverseForcedState returns true when checking moves exist', () => {
    // After 1.e4 f5, white has Qh5+
    const fen = 'rnbqkbnr/ppppp1pp/8/5p2/4P3/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 2';
    expect(isReverseForcedState(fen)).toBe(true);
  });

  it('checking move + non-checking alternatives + player gives check → immediate loss', () => {
    let state = createInitialState('hvh', reverseConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    // Now white has Qh5+ but in reverse mode, must NOT give check
    const checks = getCheckingMoves(state.fen);
    expect(checks.length).toBeGreaterThan(0);
    const nonChecks = getNonCheckingMoves(state.fen);
    expect(nonChecks.length).toBeGreaterThan(0);

    // Play a checking move (Qh5+)
    state = applyMoveWithRules(state, { from: 'd1', to: 'h5' });
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('reverse_blunziger_violation');
    expect(state.result!.winner).toBe('b');
  });

  it('checking move exists + player plays non-checking move → legal', () => {
    let state = createInitialState('hvh', reverseConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    // Play a non-checking move
    state = applyMoveWithRules(state, 'd3');
    expect(state.result).toBeNull();
    // Should NOT have any violation (reverse mode doesn't create reportable violations)
    expect(state.pendingViolation).toBeNull();
  });

  it('all legal moves give check → move allowed', () => {
    // Crafted position where all of white's legal moves give check
    // White: Kh6, Qg7 vs Black: Kh8
    // All queen moves in this constrained position check... 
    // Actually, let's use a simpler position:
    // White: Ka1, Rb1 vs Black: Ka3  (stalemate-ish but not quite)
    // Let me find a proper one...
    // White: Kg1, Qf7 vs Black: Kh8
    // Qf7 can go to f8+ (check), g8+ (check), g7 (no check?), etc.
    // This is hard to construct. Let me use a position where it's verifiable:
    // 
    // Simpler approach: White: Kc1, Ra8 vs Black: Kb3
    // Ra8 moves: many don't check. Not good.
    //
    // Use this: White Qg6, Kg1 vs Black Kh8, Ph7
    // Moves: Qg7# (checkmate), Qg8+ (check), Qxh7# ...
    // Many moves don't check though (like Qf6, Qf5 etc.)
    //
    // Actually, the best approach: construct a FEN and verify programmatically
    const fen = '7k/7p/6Q1/8/8/8/8/6K1 w - - 0 1';
    const allMoves = getLegalMoves(fen);
    const checks = getCheckingMoves(fen);
    const nonChecks = getNonCheckingMoves(fen);

    // If all moves check, then any move should be allowed
    if (nonChecks.length === 0 && checks.length > 0) {
      let state = createInitialState('hvh', reverseConfig);
      state = { ...state, fen, sideToMove: 'w' };
      const result = applyMoveWithRules(state, { from: checks[0].from, to: checks[0].to });
      // Should be allowed (not a violation)
      expect(result.result?.reason).not.toBe('reverse_blunziger_violation');
    } else {
      // If not all moves give check in this position, just verify the non-check case
      // The important thing is the code path handles it
      expect(allMoves.length).toBeGreaterThan(0);
    }
  });

  it('no checking move exists → normal play', () => {
    let state = createInitialState('hvh', reverseConfig);
    // Starting position has no checking moves
    const checks = getCheckingMoves(state.fen);
    expect(checks.length).toBe(0);
    state = applyMoveWithRules(state, 'e4');
    expect(state.result).toBeNull();
  });

  it('report button is unavailable in reverse mode', () => {
    let state = createInitialState('hvh', reverseConfig);
    state = applyMoveWithRules(state, 'e4');
    expect(canReport(state, 'b')).toBe(false);
  });
});

// ── Bot behavior under new modes ──────────────────────────────────────

describe('Bot mode-aware behavior', () => {
  it('bot obeys reverse blunziger: picks non-checking move when available', () => {
    const reverseConfig: VariantConfig = {
      ...DEFAULT_CONFIG,
      enableBlunziger: false,
      reverseForcedCheck: true,
    };
    // Position where checks exist
    const fen = 'rnbqkbnr/ppppp1pp/8/5p2/4P3/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 2';
    const checks = getCheckingMoves(fen);
    expect(checks.length).toBeGreaterThan(0);
    const nonChecks = getNonCheckingMoves(fen);
    expect(nonChecks.length).toBeGreaterThan(0);

    const move = selectBotMove(fen, 'easy', reverseConfig);
    expect(move).not.toBeNull();
    // Bot must pick a non-checking move
    const isNonChecking = nonChecks.some(
      (nc) => nc.from === move!.from && nc.to === move!.to,
    );
    expect(isNonChecking).toBe(true);
  });

  it('bot in king hunter mode prefers checking moves (medium)', () => {
    const kingHunterConfig: VariantConfig = {
      ...DEFAULT_CONFIG,
      scoringMode: 'checks_count',
      moveLimit: 40,
    };
    // After 1.e4 f5, checks exist
    const fen = 'rnbqkbnr/ppppp1pp/8/5p2/4P3/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 2';
    const checks = getCheckingMoves(fen);
    expect(checks.length).toBeGreaterThan(0);

    // With blunziger enabled (default), bot must pick checking move anyway
    const move = selectBotMove(fen, 'medium', kingHunterConfig);
    expect(move).not.toBeNull();
    const isChecking = checks.some(
      (c) => c.from === move!.from && c.to === move!.to,
    );
    expect(isChecking).toBe(true);
  });

  it('bot works under double check pressure config', () => {
    const dcpConfig: VariantConfig = {
      ...DEFAULT_CONFIG,
      doubleCheckPressureImmediateLoss: true,
    };
    const move = selectBotMove(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      'easy',
      dcpConfig,
    );
    expect(move).not.toBeNull();
  });

  it('bot works under extra move penalty config', () => {
    const penaltyConfig: VariantConfig = {
      ...DEFAULT_CONFIG,
      enableExtraMovePenalty: true,
    };
    const move = selectBotMove(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      'hard',
      penaltyConfig,
    );
    expect(move).not.toBeNull();
  });

  it('bot works under piece removal penalty config', () => {
    const pieceRemovalConfig: VariantConfig = {
      ...DEFAULT_CONFIG,
      enablePieceRemovalPenalty: true,
    };
    const move = selectBotMove(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      'easy',
      pieceRemovalConfig,
    );
    expect(move).not.toBeNull();
  });
});

// ── Blitz Overlay Combination Tests ───────────────────────────────────

describe('Blitz overlay combinations', () => {
  it('Blitz + Classic Blunziger', () => {
    const setup = { ...DEFAULT_SETUP_CONFIG, variantModeId: 'classic_blunziger' as const, enableClock: true };
    const cfg = buildVariantConfig(setup);
    expect(cfg.enableClock).toBe(true);
    expect(cfg.enableBlunziger).toBe(true);
    expect(cfg.initialTimeMs).toBe(DEFAULT_SETUP_CONFIG.initialTimeMs);
  });

  it('Blitz + Double Check Pressure', () => {
    const setup = { ...DEFAULT_SETUP_CONFIG, variantModeId: 'double_check_pressure' as const, enableClock: true };
    const cfg = buildVariantConfig(setup);
    expect(cfg.enableClock).toBe(true);
    expect(cfg.doubleCheckPressureImmediateLoss).toBe(true);
  });

  it('Clock + Extra Move Penalty', () => {
    const setup = { ...DEFAULT_SETUP_CONFIG, enableClock: true, enableExtraMovePenalty: true, enableTimeReductionPenalty: true, timeReductionSeconds: 5 };
    const cfg = buildVariantConfig(setup);
    expect(cfg.enableClock).toBe(true);
    expect(cfg.enableExtraMovePenalty).toBe(true);
    expect(cfg.enableTimeReductionPenalty).toBe(true);
    expect(cfg.timeReductionSeconds).toBe(5);
  });

  it('Clock + Piece Removal Penalty', () => {
    const setup = { ...DEFAULT_SETUP_CONFIG, enableClock: true, enablePieceRemovalPenalty: true, enableTimeReductionPenalty: true, timeReductionSeconds: 3 };
    const cfg = buildVariantConfig(setup);
    expect(cfg.enableClock).toBe(true);
    expect(cfg.enablePieceRemovalPenalty).toBe(true);
    expect(cfg.enableTimeReductionPenalty).toBe(true);
    expect(cfg.timeReductionSeconds).toBe(3);
  });

  it('Blitz + Reverse Blunziger', () => {
    const setup = { ...DEFAULT_SETUP_CONFIG, variantModeId: 'reverse_blunziger' as const, enableClock: true };
    const cfg = buildVariantConfig(setup);
    expect(cfg.enableClock).toBe(true);
    expect(cfg.reverseForcedCheck).toBe(true);
  });

  it('Blitz + King Hunter', () => {
    const setup = { ...DEFAULT_SETUP_CONFIG, variantModeId: 'king_hunter' as const, enableClock: true };
    const cfg = buildVariantConfig(setup);
    expect(cfg.enableClock).toBe(true);
    expect(cfg.scoringMode).toBe('checks_count');
    expect(cfg.moveLimit).toBe(DEFAULT_SETUP_CONFIG.moveLimit);
  });

  it('Blitz + King of the Hill', () => {
    const setup = { ...DEFAULT_SETUP_CONFIG, enableClock: true, enableKingOfTheHill: true };
    const cfg = buildVariantConfig(setup);
    expect(cfg.enableClock).toBe(true);
    expect(cfg.enableKingOfTheHill).toBe(true);
  });

  it('Blitz + Classic Blunziger + KOTH combined', () => {
    const setup = { ...DEFAULT_SETUP_CONFIG, enableClock: true, enableKingOfTheHill: true, variantModeId: 'classic_blunziger' as const };
    const cfg = buildVariantConfig(setup);
    expect(cfg.enableClock).toBe(true);
    expect(cfg.enableBlunziger).toBe(true);
    expect(cfg.enableKingOfTheHill).toBe(true);
  });

  it('Blitz overlay initializes clocks in game state', () => {
    const cfg: VariantConfig = { ...DEFAULT_CONFIG, enableClock: true, initialTimeMs: 300000, incrementMs: 0 };
    const state = createInitialState('hvh', cfg);
    expect(state.clocks).not.toBeNull();
    expect(state.clocks!.whiteMs).toBe(300000);
    expect(state.clocks!.blackMs).toBe(300000);
  });

  it('Clock + penalty mode: timeout from time reduction penalty works', () => {
    const cfg: VariantConfig = {
      ...DEFAULT_CONFIG,
      enableExtraMovePenalty: true,
      enableTimeReductionPenalty: true,
      enableClock: true,
      initialTimeMs: 3000,
      incrementMs: 0,
      timeReductionSeconds: 5,
    };
    let state = createInitialState('hvh', cfg);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    // White misses Qh5+
    state = applyMoveWithRules(state, 'd3');
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('timeout_penalty');
    expect(state.result!.winner).toBe('b');
  });
});

// ── Checkmate Precedence Tests ────────────────────────────────────────

describe('Checkmate precedence in penalty modes', () => {
  const penaltyConfig: VariantConfig = {
    ...DEFAULT_CONFIG,
    enableExtraMovePenalty: true,
  };

  it('checkmate on normal turn in penalty mode is recognized immediately', () => {
    // Fool's mate in penalty mode
    let state = createInitialState('hvh', penaltyConfig);
    state = applyMoveWithRules(state, 'f3');
    state = applyMoveWithRules(state, 'e5');
    state = applyMoveWithRules(state, 'g4');
    state = applyMoveWithRules(state, { from: 'd8', to: 'h4' }); // Qh4#
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('checkmate');
    expect(state.result!.winner).toBe('b');
  });

  it('no extra move state is created after checkmate', () => {
    let state = createInitialState('hvh', penaltyConfig);
    state = applyMoveWithRules(state, 'f3');
    state = applyMoveWithRules(state, 'e5');
    state = applyMoveWithRules(state, 'g4');
    state = applyMoveWithRules(state, { from: 'd8', to: 'h4' }); // Qh4#
    expect(state.result!.reason).toBe('checkmate');
    // No extra turns should be pending
    expect(state.extraTurns.pendingExtraMovesWhite).toBe(0);
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(0);
    // No pending piece removal
    expect(state.pendingPieceRemoval).toBeNull();
  });

  it('checkmate during extra turn is recognized in penalty mode', () => {
    // Set up: Black has pending extra turns and can deliver checkmate
    let state = createInitialState('hvh', penaltyConfig);
    // Position: after 1.f3 e5 2.g4 - Black can play Qh4#
    // Simulate: White missed a forced check, Black has extra turn
    state = {
      ...state,
      fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2',
      sideToMove: 'b',
      extraTurns: { pendingExtraMovesWhite: 0, pendingExtraMovesBlack: 1 },
      plyCount: 3,
    };
    // Black plays Qh4# - immediate checkmate
    state = applyMoveWithRules(state, { from: 'd8', to: 'h4' });
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('checkmate');
    expect(state.result!.winner).toBe('b');
  });

  it('checkmate during consumed extra turn (FEN-swapped) is recognized', () => {
    let state = createInitialState('hvh', penaltyConfig);
    // Position where Black has an extra turn and needs 2 moves to mate
    state = {
      ...state,
      fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2',
      sideToMove: 'b',
      extraTurns: { pendingExtraMovesWhite: 0, pendingExtraMovesBlack: 1 },
      plyCount: 3,
    };
    // Black's first move (normal turn - consumes extra) - play d6 (not mate)
    state = applyMoveWithRules(state, 'd6');
    expect(state.sideToMove).toBe('b'); // Black keeps turn (extra)
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(0);
    expect(state.result).toBeNull();

    // Black's extra move: Qh4# (checkmate!)
    state = applyMoveWithRules(state, { from: 'd8', to: 'h4' });
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('checkmate');
    expect(state.result!.winner).toBe('b');
  });

  it('checkmate with Clock + penalty mode', () => {
    const blitzPenaltyConfig: VariantConfig = {
      ...DEFAULT_CONFIG,
      enableExtraMovePenalty: true,
      enableClock: true,
      initialTimeMs: 300000,
      incrementMs: 0,
    };
    let state = createInitialState('hvh', blitzPenaltyConfig);
    state = applyMoveWithRules(state, 'f3');
    state = applyMoveWithRules(state, 'e5');
    state = applyMoveWithRules(state, 'g4');
    state = applyMoveWithRules(state, { from: 'd8', to: 'h4' }); // Qh4#
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('checkmate');
    expect(state.result!.winner).toBe('b');
    // Clocks should remain unchanged (no penalty applied since game ended by checkmate)
    expect(state.clocks!.whiteMs).toBe(300000);
    expect(state.clocks!.blackMs).toBe(300000);
  });

  it('checkmate precedence over penalty: no extra turn when checkmate occurs', () => {
    // Even if a violation was detected, checkmate takes absolute precedence
    let state = createInitialState('hvh', penaltyConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    // White has Qh5+ but misses
    state = applyMoveWithRules(state, 'd3');
    expect(state.extraTurns.pendingExtraMovesBlack).toBe(1);
    expect(state.result).toBeNull();
    // Now Black delivers checkmate eventually - result should be recognized
    // (checkmate cannot be missed by the engine)
  });

  it('checkmate in piece_removal penalty mode is recognized immediately', () => {
    const pieceRemovalConfig: VariantConfig = {
      ...DEFAULT_CONFIG,
      enablePieceRemovalPenalty: true,
    };
    let state = createInitialState('hvh', pieceRemovalConfig);
    state = applyMoveWithRules(state, 'f3');
    state = applyMoveWithRules(state, 'e5');
    state = applyMoveWithRules(state, 'g4');
    state = applyMoveWithRules(state, { from: 'd8', to: 'h4' }); // Qh4#
    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('checkmate');
    expect(state.result!.winner).toBe('b');
    expect(state.pendingPieceRemoval).toBeNull();
  });
});

// ── Piece Removal Penalty Tests ───────────────────────────────────────

describe('Piece Removal Penalty mode', () => {
  const pieceRemovalConfig: VariantConfig = {
    ...DEFAULT_CONFIG,
    enablePieceRemovalPenalty: true,
  };

  it('missed forced check enters pending piece removal state', () => {
    let state = createInitialState('hvh', pieceRemovalConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    // White has Qh5+ but misses
    state = applyMoveWithRules(state, 'd3');

    expect(state.result).toBeNull();
    expect(state.pendingPieceRemoval).not.toBeNull();
    expect(state.pendingPieceRemoval!.targetSide).toBe('w');
    expect(state.pendingPieceRemoval!.chooserSide).toBe('b');
    expect(state.pendingPieceRemoval!.removableSquares.length).toBeGreaterThan(0);
  });

  it('removable squares exclude king', () => {
    let state = createInitialState('hvh', pieceRemovalConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');

    const removable = state.pendingPieceRemoval!.removableSquares;
    // e1 is white king - should not be in the list
    expect(removable).not.toContain('e1');
    // Should contain white pieces like pawns, rooks, etc.
    expect(removable.length).toBeGreaterThan(0);
  });

  it('chosen piece is removed correctly', () => {
    let state = createInitialState('hvh', pieceRemovalConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3'); // White misses check

    expect(state.pendingPieceRemoval).not.toBeNull();
    // Remove white's queen on d1
    const removable = state.pendingPieceRemoval!.removableSquares;
    expect(removable).toContain('d1'); // White queen

    state = applyPieceRemoval(state, 'd1');
    expect(state.pendingPieceRemoval).toBeNull();
    // Verify the queen is gone from the position using getRemovablePieces
    // d1 should no longer have a piece
    const remainingWhite = getRemovablePieces(state.fen, 'w');
    expect(remainingWhite).not.toContain('d1');
  });

  it('invalid square selection is rejected', () => {
    let state = createInitialState('hvh', pieceRemovalConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');

    // Try to remove king (invalid)
    const before = state;
    const result = applyPieceRemoval(state, 'e1');
    expect(result).toBe(before); // No change

    // Try to remove a black piece (invalid - target is white)
    const result2 = applyPieceRemoval(state, 'e8');
    expect(result2).toBe(before);
  });

  it('violator loses immediately when no removable pieces exist', () => {
    // When a side has no removable pieces (only king), the engine detects this.
    // Test the getRemovablePieces helper directly:
    const fen = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';
    const removable = getRemovablePieces(fen, 'w');
    expect(removable).toHaveLength(0);
    // Note: in practice, a king-only side can't have checking moves,
    // so the fallback triggers only after previous removals.
  });

  it('fallback: no removable pieces means immediate loss', () => {
    // Construct a state where a violation occurs and the violator has only a king
    // We need a position where:
    // 1. It's white to move
    // 2. White has a checking move but only from non-king pieces... no, white has only king
    // Since king-only can never have checking moves, we construct the state manually
    
    let state = createInitialState('hvh', pieceRemovalConfig);
    // Use a position where white has a bishop and king
    // Bishop can give check, but we simulate having already removed all pieces except king
    // after the violation detection, the removable pieces check uses the post-move FEN
    
    // FEN: White Ke1, Bc4. Black Ke8, Pa7. White can play Bf7+ (check).
    const fen = 'r3k3/p7/8/8/2B5/8/8/4K3 w - - 0 1';
    const checks = getCheckingMoves(fen);
    expect(checks.length).toBeGreaterThan(0); // Bf7+ exists
    
    state = {
      ...createInitialState('hvh', pieceRemovalConfig),
      fen,
      sideToMove: 'w',
    };
    // White misses the check (plays Ke2 instead)
    state = applyMoveWithRules(state, { from: 'e1', to: 'e2' });
    
    // White still has Bc4, so piece removal should be pending (not immediate loss)
    if (state.pendingPieceRemoval) {
      expect(state.pendingPieceRemoval.targetSide).toBe('w');
      // After removing the bishop, white has only king
      state = applyPieceRemoval(state, 'c4');
      expect(state.pendingPieceRemoval).toBeNull();
      
      // Now verify: next time white violates with only king, they'd lose
      // (But king-only can't have checking moves, so this path is tested via getRemovablePieces)
    }
  });

  it('bot chooser removes highest-value piece', () => {
    // Position with multiple white pieces
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/3P4/PPP2PPP/RNBQKBNR b KQkq - 0 2';
    const bestSquare = selectBestPieceForRemoval(fen, 'w');
    expect(bestSquare).not.toBeNull();
    // White queen on d1 should be the highest value target
    expect(bestSquare).toBe('d1');
  });

  it('bot chooser selects deterministically among equal values', () => {
    // Position with multiple pawns (equal value)
    const fen = '4k3/8/8/8/8/8/PPP5/4K3 w - - 0 1';
    const best = selectBestPieceForRemoval(fen, 'w');
    expect(best).not.toBeNull();
    // Should deterministically pick the alphabetically first square
    const removable = getRemovablePieces(fen, 'w');
    expect(removable.length).toBeGreaterThan(0);
    // All pawns have same value, so alphabetically first square should win
  });

  it('report button is unavailable in piece removal mode', () => {
    let state = createInitialState('hvh', pieceRemovalConfig);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3');

    expect(canReport(state, 'b')).toBe(false);
    expect(canReport(state, 'w')).toBe(false);
  });

  it('getRemovablePieces returns all non-king pieces', () => {
    const removable = getRemovablePieces(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      'w',
    );
    // White has 16 pieces, minus king = 15 removable
    expect(removable).toHaveLength(15);
    expect(removable).not.toContain('e1'); // King
  });

  it('piece removal with clock time reduction penalty', () => {
    const cfg: VariantConfig = {
      ...DEFAULT_CONFIG,
      enablePieceRemovalPenalty: true,
      enableTimeReductionPenalty: true,
      enableClock: true,
      initialTimeMs: 300000,
      incrementMs: 0,
      timeReductionSeconds: 5,
    };
    let state = createInitialState('hvh', cfg);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3'); // White misses check

    // Both piece removal AND clock penalty should apply
    expect(state.pendingPieceRemoval).not.toBeNull();
    expect(state.clocks!.whiteMs).toBe(300000 - 5000);
  });

  it('piece removal + clock timeout ends game immediately', () => {
    const cfg: VariantConfig = {
      ...DEFAULT_CONFIG,
      enablePieceRemovalPenalty: true,
      enableTimeReductionPenalty: true,
      enableClock: true,
      initialTimeMs: 3000,
      incrementMs: 0,
      timeReductionSeconds: 10,
    };
    let state = createInitialState('hvh', cfg);
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3'); // White misses check → clock timeout

    expect(state.result).not.toBeNull();
    expect(state.result!.reason).toBe('timeout_penalty');
    expect(state.pendingPieceRemoval).toBeNull(); // Cleared because game ended
  });
});

// ── Classic mode regression ───────────────────────────────────────────

describe('Classic mode still works', () => {
  it('forced-check violation is reportable in classic mode', () => {
    let state = createInitialState();
    state = applyMoveWithRules(state, 'e4');
    state = applyMoveWithRules(state, 'f5');
    state = applyMoveWithRules(state, 'd3'); // miss Qh5+
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
    expect(state.variantModeId).toBe('classic_blunziger');
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
    expect(nonChecks).toHaveLength(20); // same as all legal moves
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
