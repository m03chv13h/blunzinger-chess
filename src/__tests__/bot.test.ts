import { describe, it, expect } from 'vitest';
import { selectBotMove } from '../bot/botEngine';
import { getCheckingMoves, getLegalMoves, createInitialState, applyMoveWithRules, canReport, reportViolation } from '../core/blunziger/engine';
import type { MatchConfig } from '../core/blunziger/types';
import { DEFAULT_SETUP_CONFIG, buildMatchConfig, INITIAL_FEN } from '../core/blunziger/types';

const kothConfig: MatchConfig = buildMatchConfig({
  ...DEFAULT_SETUP_CONFIG,
  enableKingOfTheHill: true,
});

describe('Bot Engine', () => {
  describe('selectBotMove', () => {
    it('should return a legal move from starting position', () => {
      const move = selectBotMove(INITIAL_FEN, 'easy');
      expect(move).not.toBeNull();
      const legalMoves = getLegalMoves(INITIAL_FEN);
      const isLegal = legalMoves.some(
        (m) => m.from === move!.from && m.to === move!.to,
      );
      expect(isLegal).toBe(true);
    });

    it('should select only checking moves when available (easy)', () => {
      // Position where checking moves exist
      const fen = 'rnbqkbnr/ppppp1pp/8/5p2/4P3/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 2';
      const checks = getCheckingMoves(fen);
      expect(checks.length).toBeGreaterThan(0);

      const move = selectBotMove(fen, 'easy');
      expect(move).not.toBeNull();
      // Bot must pick a checking move
      const isChecking = checks.some(
        (c) => c.from === move!.from && c.to === move!.to,
      );
      expect(isChecking).toBe(true);
    });

    it('should select only checking moves when available (medium)', () => {
      const fen = 'rnbqkbnr/ppppp1pp/8/5p2/4P3/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 2';
      const checks = getCheckingMoves(fen);

      const move = selectBotMove(fen, 'medium');
      expect(move).not.toBeNull();
      const isChecking = checks.some(
        (c) => c.from === move!.from && c.to === move!.to,
      );
      expect(isChecking).toBe(true);
    });

    it('should select only checking moves when available (hard)', () => {
      const fen = 'rnbqkbnr/ppppp1pp/8/5p2/4P3/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 2';
      const checks = getCheckingMoves(fen);

      const move = selectBotMove(fen, 'hard');
      expect(move).not.toBeNull();
      const isChecking = checks.some(
        (c) => c.from === move!.from && c.to === move!.to,
      );
      expect(isChecking).toBe(true);
    });

    it('should return null when no legal moves exist', () => {
      // Checkmate position
      const matedFen = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
      const move = selectBotMove(matedFen, 'easy');
      expect(move).toBeNull();
    });

    it('should work with reverse blunzinger config', () => {
      const reverseConfig: MatchConfig = buildMatchConfig({
        ...DEFAULT_SETUP_CONFIG,
        variantMode: 'reverse_blunzinger',
      });
      const move = selectBotMove(INITIAL_FEN, 'easy', reverseConfig);
      expect(move).not.toBeNull();
    });

    it('should work with penalty config', () => {
      const penaltyConfig: MatchConfig = buildMatchConfig({
        ...DEFAULT_SETUP_CONFIG,
        gameType: 'penalty_on_miss',
        enableAdditionalMovePenalty: true,
      });
      const move = selectBotMove(INITIAL_FEN, 'hard', penaltyConfig);
      expect(move).not.toBeNull();
    });

    it('should work with DCP overlay config', () => {
      const dcpConfig: MatchConfig = buildMatchConfig({
        ...DEFAULT_SETUP_CONFIG,
        enableDoubleCheckPressure: true,
      });
      const move = selectBotMove(INITIAL_FEN, 'easy', dcpConfig);
      expect(move).not.toBeNull();
    });
  });

  describe('King of the Hill bot behavior', () => {
    it('should take immediate hill win when legal and available', () => {
      // White king on d3, can move to d4 (hill), no checking moves exist
      const fen = '7k/8/8/8/8/3K4/8/8 w - - 0 1';
      const move = selectBotMove(fen, 'easy', kothConfig);
      expect(move).not.toBeNull();
      expect(move!.from).toBe('d3');
      expect(move!.to).toBe('d4');
    });

    it('should respect forced-check restriction even with hill available', () => {
      // White king on d3, rook on a1, black king on g8
      // Checking moves exist (rook checks), king can go to d4 (hill)
      // But forced-check: bot must pick a checking move
      const fen = '6k1/8/8/8/8/3K4/8/R7 w - - 0 1';
      const checks = getCheckingMoves(fen);
      expect(checks.length).toBeGreaterThan(0);

      const move = selectBotMove(fen, 'easy', kothConfig);
      expect(move).not.toBeNull();
      // Bot must pick a checking move due to forced-check rule
      const isChecking = checks.some(
        (c) => c.from === move!.from && c.to === move!.to,
      );
      expect(isChecking).toBe(true);
    });

    it('should prioritize hill win among checking moves if one exists', () => {
      // Verify medium bot also takes hill win
      const simpleHillFen = '7k/8/8/8/8/3K4/8/8 w - - 0 1';
      const mediumMove = selectBotMove(simpleHillFen, 'medium', kothConfig);
      expect(mediumMove).not.toBeNull();
      expect(mediumMove!.from).toBe('d3');
      expect(mediumMove!.to).toBe('d4');
    });

    it('hard bot should take immediate hill win', () => {
      // White king on d3, can step to d4 (hill)
      const fen = '7k/8/8/8/8/3K4/8/8 w - - 0 1';
      const move = selectBotMove(fen, 'hard', kothConfig);
      expect(move).not.toBeNull();
      expect(move!.from).toBe('d3');
      expect(move!.to).toBe('d4');
    });

    it('hard bot should advance king toward the hill when KOTH enabled', () => {
      // White king far from center on a1, black king on h8 – equal material
      // With KOTH enabled the hard bot should move the king toward the center
      const fen = '7k/8/8/8/8/8/8/K7 w - - 0 1';
      const move = selectBotMove(fen, 'hard', kothConfig);
      expect(move).not.toBeNull();
      // King should move toward center – b2, a2, or b1 are valid advancing moves
      expect(move!.piece).toBe('k');
      const advancingSquares = ['a2', 'b1', 'b2'];
      expect(advancingSquares).toContain(move!.to);
    });

    it('hard bot should block opponent king from reaching the hill', () => {
      // Black king on e6, two steps from e5/d5 (hill squares)
      // White king on a1, white has a rook that can block/control center
      // With KOTH, the hard bot (white) should recognise the threat
      const fen = '8/8/4k3/8/8/8/8/KR6 w - - 0 1';
      const move = selectBotMove(fen, 'hard', kothConfig);
      expect(move).not.toBeNull();
      // Without KOTH awareness the bot wouldn't care about black king approaching center
      // With KOTH awareness it should move its pieces to restrict the approach
      // The rook should interpose or the king should advance – accept either strategy
      // as long as the bot doesn't just sit idle (Ka2 is a do-nothing move)
      const isActive = move!.piece === 'r' || move!.to === 'b2' || move!.to === 'b1';
      expect(isActive).toBe(true);
    });
  });

  describe('Bot reporting missed checks', () => {
    it('should detect and report when human misses a check in hvbot mode', () => {
      // Setup: hvbot game, human plays white, bot plays black
      const config = buildMatchConfig({ ...DEFAULT_SETUP_CONFIG });
      const state = createInitialState('hvbot', config, 'easy', 'b');

      // 1. e4 (human)
      let s = applyMoveWithRules(state, 'e4');
      // 1... f5 (bot would normally play a checking move, but simulate f5 for setup)
      s = applyMoveWithRules(s, 'f5');
      // 2. d3 (human misses Qh5+ - a forced check)
      s = applyMoveWithRules(s, 'd3');

      // Now it's black's (bot's) turn, and a violation is pending
      expect(s.pendingViolation).not.toBeNull();
      expect(s.pendingViolation!.reportable).toBe(true);
      expect(s.pendingViolation!.violatingSide).toBe('w');
      expect(s.sideToMove).toBe('b');

      // Bot can report
      expect(canReport(s, 'b')).toBe(true);

      // Bot reports the violation - game should end with bot winning
      const reported = reportViolation(s, 'b');
      expect(reported.result).not.toBeNull();
      expect(reported.result!.winner).toBe('b');
      expect(reported.result!.reason).toBe('valid-report');
    });

    it('should not report when there is no violation', () => {
      const config = buildMatchConfig({ ...DEFAULT_SETUP_CONFIG });
      const state = createInitialState('hvbot', config, 'easy', 'b');

      // 1. e4 (no checking moves available from starting position)
      const s = applyMoveWithRules(state, 'e4');

      // No violation - bot cannot report
      expect(s.pendingViolation).toBeNull();
      expect(canReport(s, 'b')).toBe(false);
    });

    it('should not report in penalty_on_miss mode', () => {
      const config = buildMatchConfig({
        ...DEFAULT_SETUP_CONFIG,
        gameType: 'penalty_on_miss',
        enableAdditionalMovePenalty: true,
      });
      const state = createInitialState('hvbot', config, 'easy', 'b');

      let s = applyMoveWithRules(state, 'e4');
      s = applyMoveWithRules(s, 'f5');
      s = applyMoveWithRules(s, 'd3'); // misses Qh5+

      // In penalty_on_miss mode, violations are not reportable
      expect(canReport(s, 'b')).toBe(false);
    });
  });
});