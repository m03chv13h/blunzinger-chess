import { describe, it, expect } from 'vitest';
import { selectBotMove } from '../bot/botEngine';
import type { Chess960State, MatchConfig } from '../core/blunziger/types';
import { DEFAULT_CONFIG, buildMatchConfig, DEFAULT_SETUP_CONFIG } from '../core/blunziger/types';
import { applyMoveWithRules, createInitialState } from '../core/blunziger/engine';
import { identifyChess960Castling } from '../core/blunziger/chess960';

const CHESS960_FEN = 'nrbbqkrn/pp1p1p1p/B1p3p1/8/4pP2/2P4P/PP1PP1P1/NRB1QKRN b - - 1 7';

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
