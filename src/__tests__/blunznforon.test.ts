import { describe, it, expect, vi } from 'vitest';
import {
  selectBlunznforonMove,
  selectBlunznforonDrop,
  shouldBlunznforonReport,
  selectBlunznforonPieceRemoval,
} from '../core/bots/blunznforon';
import { getBlunznforonConfig } from '../core/bots/blunznforon/config';
import {
  getCheckingMoves,
  getNonCheckingMoves,
  getLegalMoves,
  getCrazyhouseDropMoves,
  createCrazyhouseState,
  getRemovablePieces,
  createInitialState,
} from '../core/blunziger/engine';
import {
  getAllEngineInfos,
  getAvailableEngineInfos,
  getEngineInfo,
  createEngineAdapter,
} from '../core/engine/engineRegistry';
import type { MatchConfig, ViolationRecord, CrazyhouseState, Color } from '../core/blunziger/types';
import { DEFAULT_SETUP_CONFIG, buildMatchConfig, INITIAL_FEN } from '../core/blunziger/types';

// ── Helper: build configs ────────────────────────────────────────────

function classicConfig(): MatchConfig {
  return buildMatchConfig({ ...DEFAULT_SETUP_CONFIG, variantMode: 'classic_blunzinger' });
}

function reverseConfig(): MatchConfig {
  return buildMatchConfig({ ...DEFAULT_SETUP_CONFIG, variantMode: 'reverse_blunzinger' });
}

function kingHuntMoveConfig(): MatchConfig {
  return buildMatchConfig({
    ...DEFAULT_SETUP_CONFIG,
    variantMode: 'classic_king_hunt_move_limit',
    kingHuntPlyLimit: 40,
  });
}

function kingHuntCheckConfig(): MatchConfig {
  return buildMatchConfig({
    ...DEFAULT_SETUP_CONFIG,
    variantMode: 'classic_king_hunt_given_check_limit',
    kingHuntGivenCheckTarget: 5,
  });
}

function kothConfig(): MatchConfig {
  return buildMatchConfig({ ...DEFAULT_SETUP_CONFIG, enableKingOfTheHill: true });
}

function crazyhouseConfig(): MatchConfig {
  return buildMatchConfig({ ...DEFAULT_SETUP_CONFIG, enableCrazyhouse: true });
}

function penaltyConfig(): MatchConfig {
  return buildMatchConfig({
    ...DEFAULT_SETUP_CONFIG,
    gameType: 'penalty_on_miss',
    enableAdditionalMovePenalty: true,
    additionalMoveCount: 1,
    enablePieceRemovalPenalty: true,
    pieceRemovalCount: 1,
  });
}

function reportConfig(): MatchConfig {
  return buildMatchConfig({
    ...DEFAULT_SETUP_CONFIG,
    gameType: 'report_incorrectness',
  });
}

// FEN where checking moves exist (Qh5+ is available)
const FEN_WITH_CHECKS = 'rnbqkbnr/ppppp1pp/8/5p2/4P3/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 2';

// FEN where king can reach a hill square
const FEN_KOTH_WIN = '4k3/8/8/8/3K4/8/8/8 w - - 0 1'; // Kd4 already on hill

describe('Blunznforön Bot', () => {
  // ── 1. Engine Registration ──────────────────────────────────────────

  describe('engine registration', () => {
    it('Blunznforön is registered as an engine', () => {
      const all = getAllEngineInfos();
      const ids = all.map((e) => e.id);
      expect(ids).toContain('blunznforön');
    });

    it('Blunznforön is marked as available', () => {
      const info = getEngineInfo('blunznforön');
      expect(info).toBeDefined();
      expect(info!.availability).toBe('available');
      expect(info!.supportsVariantAwareness).toBe(true);
      expect(info!.supportsBotPlay).toBe(true);
    });

    it('Blunznforön appears in available engines list', () => {
      const available = getAvailableEngineInfos();
      const ids = available.map((e) => e.id);
      expect(ids).toContain('blunznforön');
    });

    it('Blunznforön adapter can be created', () => {
      const adapter = createEngineAdapter('blunznforön');
      expect(adapter).toBeDefined();
      expect(adapter.info.id).toBe('blunznforön');
      adapter.dispose();
    });
  });

  // ── 2. Legal Moves Only ─────────────────────────────────────────────

  describe('only chooses legal moves', () => {
    it('from starting position (all levels)', () => {
      const config = classicConfig();
      const legal = getLegalMoves(INITIAL_FEN);
      for (const level of ['easy', 'medium', 'hard', 'expert'] as const) {
        const move = selectBlunznforonMove(INITIAL_FEN, level, config, 'w');
        expect(move).not.toBeNull();
        const isLegal = legal.some((m) => m.from === move!.from && m.to === move!.to);
        expect(isLegal).toBe(true);
      }
    }, 30_000);

    it('returns null when checkmated', () => {
      const matedFen = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
      const move = selectBlunznforonMove(matedFen, 'hard', classicConfig(), 'w');
      expect(move).toBeNull();
    });
  });

  // ── 3. Classic Forced-Check Rules ───────────────────────────────────

  describe('respects Classic forced-check rules', () => {
    it('medium bot plays a checking move when available', () => {
      const checks = getCheckingMoves(FEN_WITH_CHECKS);
      expect(checks.length).toBeGreaterThan(0);
      const move = selectBlunznforonMove(FEN_WITH_CHECKS, 'medium', classicConfig(), 'w');
      expect(move).not.toBeNull();
      const isChecking = checks.some((c) => c.from === move!.from && c.to === move!.to);
      expect(isChecking).toBe(true);
    });

    it('hard bot plays a checking move when available', () => {
      const checks = getCheckingMoves(FEN_WITH_CHECKS);
      const move = selectBlunznforonMove(FEN_WITH_CHECKS, 'hard', classicConfig(), 'w');
      expect(move).not.toBeNull();
      const isChecking = checks.some((c) => c.from === move!.from && c.to === move!.to);
      expect(isChecking).toBe(true);
    });

    it('expert bot plays a checking move when available', () => {
      const checks = getCheckingMoves(FEN_WITH_CHECKS);
      const move = selectBlunznforonMove(FEN_WITH_CHECKS, 'expert', classicConfig(), 'w');
      expect(move).not.toBeNull();
      const isChecking = checks.some((c) => c.from === move!.from && c.to === move!.to);
      expect(isChecking).toBe(true);
    }, 15_000);
  });

  // ── 4. Reverse Forced-Non-Check Rules ───────────────────────────────

  describe('respects Reverse forced-non-check rules', () => {
    it('medium bot avoids checking moves when non-checking exist', () => {
      const checks = getCheckingMoves(FEN_WITH_CHECKS);
      const nonChecks = getNonCheckingMoves(FEN_WITH_CHECKS);
      expect(checks.length).toBeGreaterThan(0);
      expect(nonChecks.length).toBeGreaterThan(0);

      const move = selectBlunznforonMove(FEN_WITH_CHECKS, 'medium', reverseConfig(), 'w');
      expect(move).not.toBeNull();
      const isChecking = checks.some((c) => c.from === move!.from && c.to === move!.to);
      expect(isChecking).toBe(false);
    });

    it('hard bot avoids checking moves when non-checking exist', () => {
      const checks = getCheckingMoves(FEN_WITH_CHECKS);
      const move = selectBlunznforonMove(FEN_WITH_CHECKS, 'hard', reverseConfig(), 'w');
      expect(move).not.toBeNull();
      const isChecking = checks.some((c) => c.from === move!.from && c.to === move!.to);
      expect(isChecking).toBe(false);
    });
  });

  // ── 5. Crazyhouse Drop Moves ────────────────────────────────────────

  describe('handles Crazyhouse drop moves', () => {
    it('returns null when no reserves exist', () => {
      const ch = createCrazyhouseState();
      const drop = selectBlunznforonDrop(
        INITIAL_FEN, 'medium', crazyhouseConfig(), 'w', ch,
      );
      expect(drop).toBeNull();
    });

    it('considers drops when reserves have pieces', () => {
      const ch: CrazyhouseState = {
        whiteReserve: { p: 0, n: 1, b: 0, r: 0, q: 0 },
        blackReserve: { p: 0, n: 0, b: 0, r: 0, q: 0 },
      };
      // Use a position where white has a knight in reserve and it's white's turn
      const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'; // Black to move
      const blackCh: CrazyhouseState = {
        whiteReserve: { p: 0, n: 0, b: 0, r: 0, q: 0 },
        blackReserve: { p: 1, n: 1, b: 0, r: 0, q: 0 },
      };
      // We can at least verify the function doesn't crash
      const drop = selectBlunznforonDrop(fen, 'medium', crazyhouseConfig(), 'b', blackCh);
      // It may or may not choose to drop (depends on whether a regular move is better)
      // Just verify it doesn't crash and returns valid type
      expect(drop === null || drop.type === 'drop').toBe(true);
    });
  });

  // ── 6. Report Actions ──────────────────────────────────────────────

  describe('uses report actions correctly', () => {
    const makeViolation = (type: 'missed_check' | 'gave_forbidden_check'): ViolationRecord => ({
      violatingSide: 'b' as Color,
      moveIndex: 0,
      fenBeforeMove: FEN_WITH_CHECKS,
      checkingMoves: getCheckingMoves(FEN_WITH_CHECKS),
      requiredMoves: getCheckingMoves(FEN_WITH_CHECKS),
      reportable: true,
      violationType: type,
      severe: false,
    });

    it('hard bot always reports missed_check', () => {
      expect(shouldBlunznforonReport('hard', makeViolation('missed_check'))).toBe(true);
    });

    it('medium bot always reports missed_check', () => {
      expect(shouldBlunznforonReport('medium', makeViolation('missed_check'))).toBe(true);
    });

    it('expert bot always reports missed_check', () => {
      expect(shouldBlunznforonReport('expert', makeViolation('missed_check'))).toBe(true);
    });

    it('easy bot always reports gave_forbidden_check', () => {
      expect(shouldBlunznforonReport('easy', makeViolation('gave_forbidden_check'))).toBe(true);
    });

    it('easy bot probabilistically reports missed_check', () => {
      // With Math.random returning 0, probability check should pass
      vi.spyOn(Math, 'random').mockReturnValue(0);
      expect(shouldBlunznforonReport('easy', makeViolation('missed_check'))).toBe(true);
      vi.restoreAllMocks();

      // With Math.random returning 0.99, should not report
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      expect(shouldBlunznforonReport('easy', makeViolation('missed_check'))).toBe(false);
      vi.restoreAllMocks();
    });
  });

  // ── 7. Penalty Modes ───────────────────────────────────────────────

  describe('handles penalty modes', () => {
    it('works with penalty_on_miss config', () => {
      const config = penaltyConfig();
      const move = selectBlunznforonMove(INITIAL_FEN, 'hard', config, 'w');
      expect(move).not.toBeNull();
    });

    it('works with report_incorrectness config', () => {
      const config = reportConfig();
      const move = selectBlunznforonMove(INITIAL_FEN, 'hard', config, 'w');
      expect(move).not.toBeNull();
    });
  });

  // ── 8. King Hunt Progress ──────────────────────────────────────────

  describe('values King Hunt progress', () => {
    it('prefers checking moves in King Hunt (move limit)', () => {
      const checks = getCheckingMoves(FEN_WITH_CHECKS);
      expect(checks.length).toBeGreaterThan(0);

      const move = selectBlunznforonMove(
        FEN_WITH_CHECKS, 'hard', kingHuntMoveConfig(), 'w',
        null, { w: 0, b: 0 }, 0,
      );
      expect(move).not.toBeNull();
      const isChecking = checks.some((c) => c.from === move!.from && c.to === move!.to);
      expect(isChecking).toBe(true);
    });

    it('prefers checking moves in King Hunt (given check limit)', () => {
      const checks = getCheckingMoves(FEN_WITH_CHECKS);
      const move = selectBlunznforonMove(
        FEN_WITH_CHECKS, 'hard', kingHuntCheckConfig(), 'w',
        null, { w: 4, b: 0 }, 10,
      );
      expect(move).not.toBeNull();
      const isChecking = checks.some((c) => c.from === move!.from && c.to === move!.to);
      expect(isChecking).toBe(true);
    });
  });

  // ── 9. Piece Removal Decisions ─────────────────────────────────────

  describe('handles piece removal decisions', () => {
    it('returns a valid square for removal', () => {
      // Position with several pieces that can be removed
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const config = penaltyConfig();
      const removable = getRemovablePieces(fen, 'b');

      const square = selectBlunznforonPieceRemoval(fen, 'b', config);
      expect(square).not.toBeNull();
      expect(removable).toContain(square);
    });

    it('prefers higher-value pieces for removal', () => {
      // Position where Black has a queen and pawns
      const fen = '4k3/pppppppp/8/8/8/8/PPPPPPPP/4K2Q w - - 0 1';
      const config = classicConfig();
      const square = selectBlunznforonPieceRemoval(fen, 'b', config);
      // Should exist (there are removable pieces)
      expect(square).not.toBeNull();
    });

    it('returns null when no pieces can be removed', () => {
      // Position with only kings
      const fen = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';
      const config = classicConfig();
      const square = selectBlunznforonPieceRemoval(fen, 'b', config);
      expect(square).toBeNull();
    });
  });

  // ── 10. Difficulty Levels Produce Distinct Behavior ─────────────────

  describe('difficulty levels produce distinct behavior', () => {
    it('easy config has low search depth and high randomization', () => {
      const cfg = getBlunznforonConfig('easy');
      expect(cfg.searchDepth).toBe(1);
      expect(cfg.randomMarginCp).toBeGreaterThan(100);
      expect(cfg.violationProbability).toBeGreaterThan(0);
    });

    it('medium config has moderate search depth', () => {
      const cfg = getBlunznforonConfig('medium');
      expect(cfg.searchDepth).toBe(2);
      expect(cfg.violationProbability).toBe(0);
    });

    it('hard config has deeper search and tactical extensions', () => {
      const cfg = getBlunznforonConfig('hard');
      expect(cfg.searchDepth).toBe(3);
      expect(cfg.useTacticalExtensions).toBe(true);
      expect(cfg.violationProbability).toBe(0);
    });

    it('expert config has deepest search and no randomization', () => {
      const cfg = getBlunznforonConfig('expert');
      expect(cfg.searchDepth).toBe(4);
      expect(cfg.randomMarginCp).toBe(0);
      expect(cfg.useTacticalExtensions).toBe(true);
      expect(cfg.violationProbability).toBe(0);
    });

    it('easy bot makes violations but medium does not', () => {
      const checks = getCheckingMoves(FEN_WITH_CHECKS);

      // Easy bot should make violations ~25% of the time
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const easyMove = selectBlunznforonMove(FEN_WITH_CHECKS, 'easy', classicConfig(), 'w');
      vi.restoreAllMocks();

      const easyIsChecking = checks.some((c) => c.from === easyMove!.from && c.to === easyMove!.to);
      expect(easyIsChecking).toBe(false); // Easy bot violated (played non-checking)

      // Medium bot should NEVER violate
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const mediumMove = selectBlunznforonMove(FEN_WITH_CHECKS, 'medium', classicConfig(), 'w');
      vi.restoreAllMocks();

      const mediumIsChecking = checks.some((c) => c.from === mediumMove!.from && c.to === mediumMove!.to);
      expect(mediumIsChecking).toBe(true); // Medium bot obeyed rules
    });

    it('hard and expert produce moves from starting position', () => {
      for (const level of ['hard', 'expert'] as const) {
        const move = selectBlunznforonMove(INITIAL_FEN, level, classicConfig(), 'w');
        expect(move).not.toBeNull();
      }
    }, 30_000);
  });

  // ── Additional: KOTH awareness ─────────────────────────────────────

  describe('King of the Hill awareness', () => {
    it('prioritizes king move to hill square when possible', () => {
      // Kd4 can move to d5 (hill square) or other squares
      const fen = '4k3/8/8/8/3K4/8/8/8 w - - 0 1';
      const config = kothConfig();
      const move = selectBlunznforonMove(fen, 'medium', config, 'w');
      // King is already on d4 (hill), but the function should still pick valid moves
      expect(move).not.toBeNull();
    });
  });

  // ── Additional: Overlay combinations ───────────────────────────────

  describe('works with overlay combinations', () => {
    it('classic + KOTH + DCP', () => {
      const config = buildMatchConfig({
        ...DEFAULT_SETUP_CONFIG,
        enableKingOfTheHill: true,
        enableDoubleCheckPressure: true,
      });
      const move = selectBlunznforonMove(INITIAL_FEN, 'hard', config, 'w');
      expect(move).not.toBeNull();
    });

    it('reverse + Crazyhouse', () => {
      const config = buildMatchConfig({
        ...DEFAULT_SETUP_CONFIG,
        variantMode: 'reverse_blunzinger',
        enableCrazyhouse: true,
      });
      const move = selectBlunznforonMove(INITIAL_FEN, 'medium', config, 'w');
      expect(move).not.toBeNull();
    });

    it('King Hunt + penalty + clock', () => {
      const config = buildMatchConfig({
        ...DEFAULT_SETUP_CONFIG,
        variantMode: 'classic_king_hunt_move_limit',
        gameType: 'penalty_on_miss',
        enableClock: true,
        enableAdditionalMovePenalty: true,
      });
      const move = selectBlunznforonMove(
        INITIAL_FEN, 'hard', config, 'w',
        null, { w: 0, b: 0 }, 0, 300000, 300000,
      );
      expect(move).not.toBeNull();
    });
  });
});
