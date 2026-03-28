import { describe, it, expect } from 'vitest';
import { selectBotMove } from '../bot/botEngine';
import { DEFAULT_CONFIG } from '../core/blunziger/types';
import { createInitialState } from '../core/blunziger/engine';

describe('Specific FEN position', () => {
  it('should return a move for Chess960 position with no checking moves', () => {
    const fen = 'nrbbqkrn/pp1p1p1p/B1p3p1/8/4pP2/2P4P/PP1PP1P1/NRB1QKRN b - - 1 7';

    // Test without Chess960 state (standard mode)
    for (const level of ['easy', 'medium', 'hard'] as const) {
      const move = selectBotMove(fen, level, DEFAULT_CONFIG, null);
      expect(move, `Bot should find a move at level ${level}`).not.toBeNull();
    }
  });

  it('should return a move with Chess960 state', () => {
    const fen = 'nrbbqkrn/pp1p1p1p/B1p3p1/8/4pP2/2P4P/PP1PP1P1/NRB1QKRN b - - 1 7';

    // Create a Chess960 state for this position
    const chess960 = {
      positionIndex: 0,
      kingFile: 5, // f-file (where the king is)
      queenSideRookFile: 1, // b-file
      kingSideRookFile: 6, // g-file
      castling: {
        whiteKingSide: false,
        whiteQueenSide: false,
        blackKingSide: false,
        blackQueenSide: false,
      },
    };

    for (const level of ['easy', 'medium', 'hard'] as const) {
      const move = selectBotMove(fen, level, DEFAULT_CONFIG, chess960);
      expect(move, `Bot should find a move at level ${level} with Chess960 state`).not.toBeNull();
      if (move) {
        expect(move.san).toBeDefined();
        expect(move.from).toBeDefined();
        expect(move.to).toBeDefined();
      }
    }
  });
});
