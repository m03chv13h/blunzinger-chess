import { describe, it, expect } from 'vitest';
import { selectBotMove } from '../bot/botEngine';
import { getCheckingMoves, getLegalMoves } from '../core/blunziger/engine';
import { INITIAL_FEN } from '../core/blunziger/types';

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
  });
});
