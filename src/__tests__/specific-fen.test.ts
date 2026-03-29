import { describe, it, expect } from 'vitest';
import { selectBotMove } from '../bot/botEngine';
import type { Chess960State, MatchConfig, Square } from '../core/blunziger/types';
import { DEFAULT_CONFIG, buildMatchConfig, DEFAULT_SETUP_CONFIG } from '../core/blunziger/types';
import { applyMoveWithRules, createInitialState } from '../core/blunziger/engine';
import { identifyChess960Castling } from '../core/blunziger/chess960';

const CHESS960_FEN = 'nrbbqkrn/pp1p1p1p/B1p3p1/8/4pP2/2P4P/PP1PP1P1/NRB1QKRN b - - 1 7';

/**
 * Issue: Chess960 + Crazyhouse bot vs bot stopped playing at this FEN.
 *
 * White king on b1 is in check from bishop on c2. The legal escape Kc1
 * (b1→c1) was misidentified as a queenside castling attempt (the king
 * starts on file b=1 and c1 is file c=2, the queenside castling target).
 * Since castling while in check is illegal, the move was rejected entirely
 * instead of falling through to regular move handling.
 */
const ISSUE_FEN = '1knqnb1r/rpppppp1/4P2p/8/8/1N3P2/PPbPP1PP/RK1QNB1R w - - 0 5';

/** Chess960 state matching the issue position (king on b-file). */
const issueChess960State: Chess960State = {
  positionIndex: 0,
  kingFile: 1,          // b-file
  queenSideRookFile: 0, // a-file
  kingSideRookFile: 7,  // h-file
  castling: {
    whiteKingSide: true,
    whiteQueenSide: true,
    blackKingSide: true,
    blackQueenSide: true,
  },
};

// Chess960 state for NRBBQKRN arrangement (king on f-file, rooks on b and g)
const chess960State: Chess960State = {
  positionIndex: 0,
  kingFile: 5,
  queenSideRookFile: 1,
  kingSideRookFile: 6,
  castling: {
    whiteKingSide: false,
    whiteQueenSide: false,
    blackKingSide: false,
    blackQueenSide: false,
  },
};

const kothConfig: MatchConfig = buildMatchConfig({
  ...DEFAULT_SETUP_CONFIG,
  enableKingOfTheHill: true,
  enableChess960: true,
});

describe('Specific FEN position', () => {
  it('should return a move for Chess960 position with no checking moves', () => {
    // Test without Chess960 state (standard mode)
    for (const level of ['easy', 'medium', 'hard'] as const) {
      const move = selectBotMove(CHESS960_FEN, level, DEFAULT_CONFIG, null);
      expect(move, `Bot should find a move at level ${level}`).not.toBeNull();
    }
  });

  it('should return a move with Chess960 state', () => {
    for (const level of ['easy', 'medium', 'hard'] as const) {
      const move = selectBotMove(CHESS960_FEN, level, DEFAULT_CONFIG, chess960State);
      expect(move, `Bot should find a move at level ${level} with Chess960 state`).not.toBeNull();
      if (move) {
        expect(move.san).toBeDefined();
        expect(move.from).toBeDefined();
        expect(move.to).toBeDefined();
      }
    }
  });

  it('should not misidentify king moves to adjacent ranks as castling', () => {
    // King on f8 moving to g7 should NOT be identified as castling.
    // The destination rank (7) differs from the back rank (8).
    expect(identifyChess960Castling(chess960State, 'b', 'f8', 'g7')).toBeNull();
    expect(identifyChess960Castling(chess960State, 'b', 'f8', 'c7')).toBeNull();

    // King on f1 moving to g2/c2 should NOT be castling either (white)
    expect(identifyChess960Castling(chess960State, 'w', 'f1', 'g2')).toBeNull();
    expect(identifyChess960Castling(chess960State, 'w', 'f1', 'c2')).toBeNull();

    // But actual castling destinations on the same rank should still be identified
    expect(identifyChess960Castling(chess960State, 'b', 'f8', 'g8')).toBe('kingSide');
    expect(identifyChess960Castling(chess960State, 'b', 'f8', 'c8')).toBe('queenSide');
    expect(identifyChess960Castling(chess960State, 'w', 'f1', 'g1')).toBe('kingSide');
    expect(identifyChess960Castling(chess960State, 'w', 'f1', 'c1')).toBe('queenSide');
  });

  it('should apply king move Kg7 in Chess960 mode without misidentifying as castling', () => {
    const state = createInitialState('hvbot', kothConfig);

    // Override state to match the reported position
    const testState = {
      ...state,
      fen: CHESS960_FEN,
      sideToMove: 'b' as const,
      chess960: chess960State,
    };

    // King f8 to g7 should be accepted as a regular move
    const afterMove = applyMoveWithRules(testState, { from: 'f8', to: 'g7' });
    expect(afterMove).not.toBe(testState); // State should change (move applied)
    expect(afterMove.sideToMove).toBe('w'); // Side should switch to white
  });

  it('bot move at KOTH + Chess960 is accepted by applyMoveWithRules', () => {
    const state = createInitialState('hvbot', kothConfig);

    const testState = {
      ...state,
      fen: CHESS960_FEN,
      sideToMove: 'b' as const,
      chess960: chess960State,
      config: kothConfig,
    };

    // The bot should select a move that is then accepted by the engine
    for (const level of ['easy', 'medium', 'hard'] as const) {
      const move = selectBotMove(CHESS960_FEN, level, kothConfig, chess960State);
      expect(move, `Bot should find a move at level ${level}`).not.toBeNull();
      if (move) {
        const afterMove = applyMoveWithRules(testState, {
          from: move.from,
          to: move.to,
          promotion: move.promotion,
        });
        expect(afterMove, `Move ${move.san} should be accepted at level ${level}`).not.toBe(testState);
      }
    }
  });
});

describe('Issue: Chess960+Crazyhouse bot vs bot stopped playing', () => {
  const issueConfig: MatchConfig = buildMatchConfig({
    ...DEFAULT_SETUP_CONFIG,
    enableChess960: true,
    enableCrazyhouse: true,
  });

  it('Kc1 should not be misidentified as castling when king is in check', () => {
    // identifyChess960Castling sees b1→c1 as queenside castling,
    // but applyMoveWithRules should still accept it as a regular king move
    // when castling is not legal (king in check).
    const result = identifyChess960Castling(issueChess960State, 'w', 'b1' as Square, 'c1' as Square);
    // It IS identified as queenside castling by the function...
    expect(result).toBe('queenSide');

    // ...but applyMoveWithRules should fall through to regular move handling
    const state = createInitialState('botvbot', issueConfig);
    const testState = {
      ...state,
      fen: ISSUE_FEN,
      sideToMove: 'w' as const,
      chess960: issueChess960State,
      config: issueConfig,
    };

    const afterMove = applyMoveWithRules(testState, { from: 'b1' as Square, to: 'c1' as Square });
    expect(afterMove).not.toBe(testState); // Move should be accepted
    expect(afterMove.fen).not.toBe(testState.fen); // FEN should change
  });

  it('bot finds a move that is accepted by applyMoveWithRules', () => {
    const state = createInitialState('botvbot', issueConfig);
    const testState = {
      ...state,
      fen: ISSUE_FEN,
      sideToMove: 'w' as const,
      chess960: issueChess960State,
      config: issueConfig,
    };

    for (const level of ['easy', 'medium', 'hard'] as const) {
      const move = selectBotMove(ISSUE_FEN, level, issueConfig, issueChess960State);
      expect(move, `Bot should find a move at level ${level}`).not.toBeNull();
      if (move) {
        const afterMove = applyMoveWithRules(testState, {
          from: move.from as Square,
          to: move.to as Square,
          promotion: move.promotion,
        });
        expect(afterMove, `Move ${move.san} should be accepted at level ${level}`).not.toBe(testState);
      }
    }
  });

  it('all legal moves are accepted (not just non-Kc1 moves)', () => {
    const state = createInitialState('botvbot', issueConfig);
    const testState = {
      ...state,
      fen: ISSUE_FEN,
      sideToMove: 'w' as const,
      chess960: issueChess960State,
      config: issueConfig,
    };

    // All four legal moves should be accepted
    const legalInputs: { from: Square; to: Square }[] = [
      { from: 'b1', to: 'c1' },  // Kc1 (was rejected before fix)
      { from: 'b1', to: 'c2' },  // Kxc2
      { from: 'd1', to: 'c2' },  // Qxc2
      { from: 'e1', to: 'c2' },  // Nxc2
    ];

    for (const input of legalInputs) {
      const afterMove = applyMoveWithRules(testState, input);
      expect(afterMove, `Move ${input.from}-${input.to} should be accepted`).not.toBe(testState);
    }
  });
});
