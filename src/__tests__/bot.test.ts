import { describe, it, expect } from 'vitest';
import { selectBotMove } from '../bot/botEngine';
import { getCheckingMoves, getLegalMoves } from '../core/blunziger/engine';
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
  });
});