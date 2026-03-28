import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { selectBotMove } from '../src/bot/botEngine';
import { getLegalMoves, getCheckingMoves } from '../src/core/blunziger/engine';
import { selectBlunznforonMove } from '../src/core/bots/blunznforon';
import type { MatchConfig, Chess960State } from '../src/core/blunziger/types';
import { DEFAULT_CONFIG } from '../src/core/blunziger/types';

const FEN = 'nrbbqkrn/pp1p1p1p/B1p3p1/8/4pP2/2P4P/PP1PP1P1/NRB1QKRN b - - 1 7';

// Chess960 state for NRBBQKRN arrangement
const chess960State: Chess960State = {
  kingFile: 5,           // f-file (0-indexed)
  queenSideRookFile: 1,  // b-file
  kingSideRookFile: 6,   // g-file
  castling: {
    whiteKingSide: false,
    whiteQueenSide: false,
    blackKingSide: false,
    blackQueenSide: false,
  },
};

const kothConfig: MatchConfig = {
  ...DEFAULT_CONFIG,
  overlays: {
    ...DEFAULT_CONFIG.overlays,
    enableKingOfTheHill: true,
  },
};

describe('Bug repro: bot stops at specific Chess960 position', () => {
  it('chess.js generates legal moves for this FEN', () => {
    const chess = new Chess(FEN);
    const moves = chess.moves({ verbose: true });
    expect(moves.length).toBeGreaterThan(0);
    console.log('Legal moves:', moves.map(m => m.san).join(', '));
  });

  it('getLegalMoves returns moves for this FEN', () => {
    const moves = getLegalMoves(FEN, chess960State);
    expect(moves.length).toBeGreaterThan(0);
  });

  it('getCheckingMoves works for this FEN', () => {
    const moves = getCheckingMoves(FEN, chess960State);
    console.log('Checking moves:', moves.map(m => m.san).join(', '));
  });

  it('selectBotMove returns a move (no config)', () => {
    const move = selectBotMove(FEN, 'easy');
    expect(move).not.toBeNull();
    console.log('Easy bot move (no config):', move?.san);
  });

  it('selectBotMove returns a move with config + chess960', () => {
    const move = selectBotMove(FEN, 'easy', kothConfig, chess960State);
    expect(move).not.toBeNull();
    console.log('Easy bot move:', move?.san);
  });

  it('selectBotMove returns a move with medium + config + chess960', () => {
    const move = selectBotMove(FEN, 'medium', kothConfig, chess960State);
    expect(move).not.toBeNull();
    console.log('Medium bot move:', move?.san);
  });

  it('selectBotMove returns a move with hard + config + chess960', () => {
    const move = selectBotMove(FEN, 'hard', kothConfig, chess960State);
    expect(move).not.toBeNull();
    console.log('Hard bot move:', move?.san);
  });

  it('selectBlunznforonMove returns a move', () => {
    const move = selectBlunznforonMove(FEN, 'hard', kothConfig, 'b', null, undefined, undefined, 0, 0, chess960State);
    expect(move).not.toBeNull();
    console.log('Blunznforon move:', move?.san);
  });
});
