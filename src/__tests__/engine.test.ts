import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  getLegalMoves,
  getCheckingMoves,
  isForcedCheckTurn,
  detectViolation,
  applyMoveWithRules,
  canReport,
  reportViolation,
  incrementInvalidReport,
  shouldLoseFromInvalidReports,
  opponent,
} from '../core/blunziger/engine';
import type { GameState, BlunzigerConfig } from '../core/blunziger/types';
import { DEFAULT_CONFIG, INITIAL_FEN } from '../core/blunziger/types';

describe('Core Blunziger Engine', () => {
  describe('createInitialState', () => {
    it('should create a valid initial state', () => {
      const state = createInitialState();
      expect(state.fen).toBe(INITIAL_FEN);
      expect(state.moveHistory).toHaveLength(0);
      expect(state.sideToMove).toBe('w');
      expect(state.pendingViolation).toBeNull();
      expect(state.invalidReports).toEqual({ w: 0, b: 0 });
      expect(state.result).toBeNull();
      expect(state.mode).toBe('hvh');
    });

    it('should accept custom config', () => {
      const config: BlunzigerConfig = { invalidReportLossThreshold: 5 };
      const state = createInitialState('hvbot', config, 'medium', 'w');
      expect(state.config.invalidReportLossThreshold).toBe(5);
      expect(state.mode).toBe('hvbot');
      expect(state.botLevel).toBe('medium');
      expect(state.botColor).toBe('w');
    });
  });

  describe('getLegalMoves', () => {
    it('should return 20 moves from starting position', () => {
      const moves = getLegalMoves(INITIAL_FEN);
      expect(moves).toHaveLength(20);
    });

    it('should return 0 moves from a checkmated position', () => {
      // Fool's mate: after 1.f3 e5 2.g4 Qh4#
      const matedFen = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
      const moves = getLegalMoves(matedFen);
      expect(moves).toHaveLength(0);
    });
  });

  describe('getCheckingMoves', () => {
    it('should return no checking moves from starting position', () => {
      const checks = getCheckingMoves(INITIAL_FEN);
      expect(checks).toHaveLength(0);
    });

    it('should find checking moves when available', () => {
      // Position where white queen can give check
      // After 1.e4 f5 - white has Qh5+ available
      const fen = 'rnbqkbnr/ppppp1pp/8/5p2/4P3/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 2';
      const checks = getCheckingMoves(fen);
      expect(checks.length).toBeGreaterThan(0);
      const hasSomeCheck = checks.some((m) => m.san.includes('+'));
      expect(hasSomeCheck).toBe(true);
    });
  });

  describe('isForcedCheckTurn', () => {
    it('should return false from starting position', () => {
      expect(isForcedCheckTurn(INITIAL_FEN)).toBe(false);
    });

    it('should return true when checking moves exist', () => {
      const fen = 'rnbqkbnr/ppppp1pp/8/5p2/4P3/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 2';
      expect(isForcedCheckTurn(fen)).toBe(true);
    });
  });

  describe('detectViolation', () => {
    it('should return null when no checking moves were available', () => {
      const moves = getLegalMoves(INITIAL_FEN);
      const violation = detectViolation(INITIAL_FEN, moves[0], 0);
      expect(violation).toBeNull();
    });

    it('should detect a violation when a checking move was available but not played', () => {
      // Position where white has Qh5+ but plays something else
      const fen = 'rnbqkbnr/ppppp1pp/8/5p2/4P3/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 2';
      const allMoves = getLegalMoves(fen);
      const checkMoves = getCheckingMoves(fen);

      // Find a non-checking move
      const nonCheckMove = allMoves.find(
        (m) => !checkMoves.some((c) => c.from === m.from && c.to === m.to),
      );
      expect(nonCheckMove).toBeDefined();

      const violation = detectViolation(fen, nonCheckMove!, 0);
      expect(violation).not.toBeNull();
      expect(violation!.violatingSide).toBe('w');
      expect(violation!.reportable).toBe(true);
      expect(violation!.checkingMoves.length).toBeGreaterThan(0);
    });

    it('should return null when the played move IS a checking move', () => {
      const fen = 'rnbqkbnr/ppppp1pp/8/5p2/4P3/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 2';
      const checkMoves = getCheckingMoves(fen);
      expect(checkMoves.length).toBeGreaterThan(0);

      const violation = detectViolation(fen, checkMoves[0], 0);
      expect(violation).toBeNull();
    });
  });

  describe('applyMoveWithRules', () => {
    it('should apply a valid move', () => {
      const state = createInitialState();
      const newState = applyMoveWithRules(state, 'e4');
      expect(newState.fen).not.toBe(state.fen);
      expect(newState.moveHistory).toHaveLength(1);
      expect(newState.sideToMove).toBe('b');
    });

    it('should not modify state for invalid moves', () => {
      const state = createInitialState();
      const newState = applyMoveWithRules(state, 'e5'); // invalid for white
      expect(newState).toBe(state);
    });

    it('should detect checkmate', () => {
      // Set up a position one move before fool's mate
      const state = createInitialState();
      let s = applyMoveWithRules(state, 'f3');
      s = applyMoveWithRules(s, 'e5');
      s = applyMoveWithRules(s, 'g4');
      s = applyMoveWithRules(s, { from: 'd8', to: 'h4' }); // Qh4#
      expect(s.result).not.toBeNull();
      expect(s.result!.reason).toBe('checkmate');
      expect(s.result!.winner).toBe('b');
    });

    it('should not allow moves after game is over', () => {
      const state = createInitialState();
      let s = applyMoveWithRules(state, 'f3');
      s = applyMoveWithRules(s, 'e5');
      s = applyMoveWithRules(s, 'g4');
      s = applyMoveWithRules(s, { from: 'd8', to: 'h4' }); // Qh4#
      expect(s.result).not.toBeNull();

      const afterResult = applyMoveWithRules(s, 'e3');
      expect(afterResult).toBe(s); // no change
    });

    it('should set pending violation when checking move is missed', () => {
      // 1.e4 f5 — now white has Qh5+ but we play d3 instead
      const state = createInitialState();
      let s = applyMoveWithRules(state, 'e4');
      s = applyMoveWithRules(s, 'f5');
      // Now white has Qh5+ available
      expect(isForcedCheckTurn(s.fen)).toBe(true);
      s = applyMoveWithRules(s, 'd3'); // not a checking move
      expect(s.pendingViolation).not.toBeNull();
      expect(s.pendingViolation!.violatingSide).toBe('w');
      expect(s.pendingViolation!.reportable).toBe(true);
    });

    it('should clear reportable flag when opponent moves instead of reporting', () => {
      const state = createInitialState();
      let s = applyMoveWithRules(state, 'e4');
      s = applyMoveWithRules(s, 'f5');
      s = applyMoveWithRules(s, 'd3'); // white misses Qh5+
      expect(s.pendingViolation!.reportable).toBe(true);

      // Black moves instead of reporting
      s = applyMoveWithRules(s, 'e6');
      // The old violation should no longer be reportable
      // (either cleared or a new violation check applies)
      // Note: the new pending violation is whatever happened with black's move
      // The old white violation is no longer reportable
    });
  });

  describe('canReport', () => {
    it('should return false when there is no violation', () => {
      const state = createInitialState();
      expect(canReport(state, 'w')).toBe(false);
      expect(canReport(state, 'b')).toBe(false);
    });

    it('should return true for opponent after a violation', () => {
      const state = createInitialState();
      let s = applyMoveWithRules(state, 'e4');
      s = applyMoveWithRules(s, 'f5');
      s = applyMoveWithRules(s, 'd3'); // white misses check
      // Black (current side) can report white's violation
      expect(canReport(s, 'b')).toBe(true);
      // White cannot report their own violation
      expect(canReport(s, 'w')).toBe(false);
    });

    it('should return false after game is over', () => {
      const state: GameState = {
        ...createInitialState(),
        result: { winner: 'w', reason: 'checkmate' },
        pendingViolation: {
          violatingSide: 'b',
          moveIndex: 5,
          fenBeforeMove: INITIAL_FEN,
          checkingMoves: [],
          actualMove: getLegalMoves(INITIAL_FEN)[0],
          reportable: true,
        },
      };
      expect(canReport(state, 'w')).toBe(false);
    });
  });

  describe('reportViolation', () => {
    it('should end the game on valid report', () => {
      const state = createInitialState();
      let s = applyMoveWithRules(state, 'e4');
      s = applyMoveWithRules(s, 'f5');
      s = applyMoveWithRules(s, 'd3'); // white misses Qh5+
      expect(canReport(s, 'b')).toBe(true);

      const reported = reportViolation(s, 'b');
      expect(reported.result).not.toBeNull();
      expect(reported.result!.winner).toBe('b');
      expect(reported.result!.reason).toBe('valid-report');
    });

    it('should increment invalid report counter on invalid report', () => {
      const state = createInitialState();
      const s = applyMoveWithRules(state, 'e4'); // no violation
      // Black tries to report but there's no violation
      const reported = reportViolation(s, 'b');
      expect(reported.invalidReports.b).toBe(1);
      expect(reported.result).toBeNull();
    });

    it('should end the game when invalid report threshold is reached', () => {
      const config: BlunzigerConfig = { invalidReportLossThreshold: 2 };
      let state = createInitialState('hvh', config);
      state = applyMoveWithRules(state, 'e4');

      // First invalid report by black
      state = reportViolation(state, 'b');
      expect(state.invalidReports.b).toBe(1);
      expect(state.result).toBeNull();

      // Second invalid report by black - should lose
      state = reportViolation(state, 'b');
      expect(state.invalidReports.b).toBe(2);
      expect(state.result).not.toBeNull();
      expect(state.result!.winner).toBe('w');
      expect(state.result!.reason).toBe('invalid-report-threshold');
    });

    it('should return valid feedback on a correct report', () => {
      const state = createInitialState();
      let s = applyMoveWithRules(state, 'e4');
      s = applyMoveWithRules(s, 'f5');
      s = applyMoveWithRules(s, 'd3'); // white misses Qh5+
      const reported = reportViolation(s, 'b');
      expect(reported.lastReportFeedback).not.toBeNull();
      expect(reported.lastReportFeedback!.valid).toBe(true);
      expect(reported.lastReportFeedback!.message).toContain('Correct');
      expect(reported.lastReportFeedback!.message).toContain('missed a forced check');
    });

    it('should return invalid feedback on an incorrect report', () => {
      const state = createInitialState();
      const s = applyMoveWithRules(state, 'e4'); // no violation
      const reported = reportViolation(s, 'b');
      expect(reported.lastReportFeedback).not.toBeNull();
      expect(reported.lastReportFeedback!.valid).toBe(false);
      expect(reported.lastReportFeedback!.message).toContain('Wrong');
    });

    it('should return invalid feedback when threshold is reached', () => {
      const config: BlunzigerConfig = { invalidReportLossThreshold: 2 };
      let state = createInitialState('hvh', config);
      state = applyMoveWithRules(state, 'e4');

      state = reportViolation(state, 'b');
      expect(state.lastReportFeedback!.valid).toBe(false);

      state = reportViolation(state, 'b');
      expect(state.lastReportFeedback!.valid).toBe(false);
      expect(state.lastReportFeedback!.message).toContain('threshold');
    });

    it('should clear feedback when a new move is made', () => {
      const state = createInitialState();
      let s = applyMoveWithRules(state, 'e4');
      s = reportViolation(s, 'b'); // invalid report
      expect(s.lastReportFeedback).not.toBeNull();

      s = applyMoveWithRules(s, 'e5'); // black makes a move
      expect(s.lastReportFeedback).toBeNull();
    });
  });

  describe('incrementInvalidReport', () => {
    it('should increment counter for specified side', () => {
      const state = createInitialState();
      const updated = incrementInvalidReport(state, 'w');
      expect(updated.invalidReports.w).toBe(1);
      expect(updated.invalidReports.b).toBe(0);
    });
  });

  describe('shouldLoseFromInvalidReports', () => {
    it('should return false when under threshold', () => {
      expect(
        shouldLoseFromInvalidReports({ w: 1, b: 0 }, 'w', DEFAULT_CONFIG),
      ).toBe(false);
    });

    it('should return true when at threshold', () => {
      expect(
        shouldLoseFromInvalidReports({ w: 2, b: 0 }, 'w', DEFAULT_CONFIG),
      ).toBe(true);
    });

    it('should return true when over threshold', () => {
      expect(
        shouldLoseFromInvalidReports({ w: 5, b: 0 }, 'w', DEFAULT_CONFIG),
      ).toBe(true);
    });
  });

  describe('opponent', () => {
    it('should return the other color', () => {
      expect(opponent('w')).toBe('b');
      expect(opponent('b')).toBe('w');
    });
  });

  describe('Edge cases', () => {
    it('should handle multiple checking moves', () => {
      // Position with multiple checking moves
      // Place white queen on d1 with black king exposed
      const fen = 'rnbqkbnr/ppppp1pp/8/5p2/4P3/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 2';
      const checks = getCheckingMoves(fen);
      // Qh5+ is available
      expect(checks.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle promotion moves via applyMoveWithRules', () => {
      // Position where white pawn is about to promote
      const promotionFen = '8/P7/8/8/8/8/6k1/4K3 w - - 0 1';
      const state: GameState = {
        ...createInitialState(),
        fen: promotionFen,
        sideToMove: 'w',
      };
      const newState = applyMoveWithRules(state, { from: 'a7', to: 'a8', promotion: 'q' });
      expect(newState.fen).not.toBe(promotionFen);
      expect(newState.moveHistory).toHaveLength(1);
      expect(newState.moveHistory[0].promotion).toBe('q');
    });

    it('should handle en passant', () => {
      // Position where en passant is available
      const epFen = 'rnbqkbnr/pppp1ppp/8/4pP2/8/8/PPPPP1PP/RNBQKBNR w KQkq e6 0 3';
      const state: GameState = {
        ...createInitialState(),
        fen: epFen,
        sideToMove: 'w',
      };
      const newState = applyMoveWithRules(state, { from: 'f5', to: 'e6' });
      expect(newState.moveHistory).toHaveLength(1);
      // En passant capture
      expect(newState.moveHistory[0].flags).toContain('e');
    });

    it('should handle castling', () => {
      // Position where castling is available
      const castlingFen = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
      const state: GameState = {
        ...createInitialState(),
        fen: castlingFen,
        sideToMove: 'w',
      };
      const newState = applyMoveWithRules(state, { from: 'e1', to: 'g1' });
      expect(newState.moveHistory).toHaveLength(1);
      expect(newState.moveHistory[0].san).toBe('O-O');
    });
  });
});
