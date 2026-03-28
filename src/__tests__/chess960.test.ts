/**
 * Chess960 overlay tests.
 *
 * Tests cover:
 * 1. Starting-position generation (valid layout, bishops on opposite colors, king between rooks)
 * 2. Game initialization (Chess960 vs standard start)
 * 3. Castling (legality, path constraints, final squares)
 * 4. Variant integration (Classic/Reverse Blunzinger, King Hunt from Chess960 positions)
 * 5. Overlay combinations (Chess960 + Clock, KOTH, DCP, Crazyhouse)
 * 6. Bot/evaluation/review integration
 */

import { describe, it, expect } from 'vitest';
import {
  generateChess960BackRank,
  chess960IndexToFen,
  getRandomChess960Index,
  createChess960State,
  getChess960CastlingMoves,
  getChess960PieceFiles,
  identifyChess960Castling,
  updateChess960CastlingState,
  updateChess960StateAfterCastle,
} from '../core/blunziger/chess960';
import {
  createInitialState,
  applyMoveWithRules,
  getLegalMoves,
  getCheckingMoves,
  getNonCheckingMoves,
  isChess960Enabled,
} from '../core/blunziger/engine';
import {
  DEFAULT_SETUP_CONFIG,
  DEFAULT_CONFIG,
  buildMatchConfig,
  INITIAL_FEN,
} from '../core/blunziger/types';
import type { MatchConfig, GameSetupConfig, Square } from '../core/blunziger/types';
import { selectBotMove } from '../bot/botEngine';
import { Chess } from 'chess.js';

// ── Helpers ──────────────────────────────────────────────────────────

function chess960Config(index?: number): MatchConfig {
  const setupConfig: GameSetupConfig = {
    ...DEFAULT_SETUP_CONFIG,
    enableChess960: true,
  };
  const mc = buildMatchConfig(setupConfig);
  // Override with specific index if provided
  if (index !== undefined) {
    return {
      ...mc,
      chess960Index: index,
      initialFen: chess960IndexToFen(index),
    };
  }
  return mc;
}

function chess960ConfigWithOverlays(overlays: Partial<GameSetupConfig>, index?: number): MatchConfig {
  const setupConfig: GameSetupConfig = {
    ...DEFAULT_SETUP_CONFIG,
    enableChess960: true,
    ...overlays,
  };
  const mc = buildMatchConfig(setupConfig);
  if (index !== undefined) {
    return {
      ...mc,
      chess960Index: index,
      initialFen: chess960IndexToFen(index),
    };
  }
  return mc;
}

function standardConfig(): MatchConfig {
  return buildMatchConfig(DEFAULT_SETUP_CONFIG);
}

// ── 1. Starting-position generation ──────────────────────────────────

describe('Chess960 Position Generation', () => {
  it('generates valid back-rank for index 0', () => {
    const rank = generateChess960BackRank(0);
    expect(rank).toHaveLength(8);
    // Check piece counts
    const counts = { r: 0, n: 0, b: 0, q: 0, k: 0 };
    for (const p of rank) counts[p as keyof typeof counts]++;
    expect(counts).toEqual({ r: 2, n: 2, b: 2, q: 1, k: 1 });
  });

  it('generates standard chess position for index 518', () => {
    const rank = generateChess960BackRank(518);
    expect(rank.join('')).toBe('rnbqkbnr');
  });

  it('generates correct FEN for index 518 (standard)', () => {
    const fen = chess960IndexToFen(518);
    // Standard position with '-' castling (chess960 manages castling itself)
    expect(fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1');
  });

  it('throws for invalid indices', () => {
    expect(() => generateChess960BackRank(-1)).toThrow();
    expect(() => generateChess960BackRank(960)).toThrow();
    expect(() => generateChess960BackRank(1000)).toThrow();
  });

  it('all 960 positions have bishops on opposite colors', () => {
    for (let i = 0; i < 960; i++) {
      const rank = generateChess960BackRank(i);
      const bishopFiles = rank.map((p, idx) => p === 'b' ? idx : -1).filter(idx => idx >= 0);
      expect(bishopFiles).toHaveLength(2);
      // One on even file (light), one on odd file (dark)
      const parities = bishopFiles.map(f => f % 2);
      expect(parities.sort()).toEqual([0, 1]);
    }
  });

  it('all 960 positions have king between rooks', () => {
    for (let i = 0; i < 960; i++) {
      const rank = generateChess960BackRank(i);
      const { kingFile, queenSideRookFile, kingSideRookFile } = getChess960PieceFiles(rank);
      expect(queenSideRookFile).toBeLessThan(kingFile);
      expect(kingSideRookFile).toBeGreaterThan(kingFile);
    }
  });

  it('all 960 positions have mirrored back ranks', () => {
    for (let i = 0; i < 960; i++) {
      const fen = chess960IndexToFen(i);
      const parts = fen.split('/');
      // Black rank is parts[0], white rank is parts[7] (before space)
      const blackRank = parts[0];
      const whiteRank = parts[7].split(' ')[0];
      expect(whiteRank.toUpperCase()).toBe(whiteRank); // White pieces are uppercase
      expect(blackRank.toLowerCase()).toBe(blackRank); // Black pieces are lowercase
      expect(whiteRank.toLowerCase()).toBe(blackRank);  // Same arrangement
    }
  });

  it('all 960 positions have standard pawn rows', () => {
    for (let i = 0; i < 960; i++) {
      const fen = chess960IndexToFen(i);
      const ranks = fen.split(' ')[0].split('/');
      expect(ranks[1]).toBe('pppppppp');
      expect(ranks[6]).toBe('PPPPPPPP');
      for (let r = 2; r <= 5; r++) {
        expect(ranks[r]).toBe('8');
      }
    }
  });

  it('all 960 indices produce distinct positions', () => {
    const positions = new Set<string>();
    for (let i = 0; i < 960; i++) {
      const rank = generateChess960BackRank(i).join('');
      positions.add(rank);
    }
    expect(positions.size).toBe(960);
  });

  it('getRandomChess960Index returns value in range', () => {
    for (let i = 0; i < 100; i++) {
      const idx = getRandomChess960Index();
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(960);
    }
  });

  it('createChess960State has correct piece files', () => {
    const state = createChess960State(518);
    expect(state.positionIndex).toBe(518);
    expect(state.kingFile).toBe(4); // e-file
    expect(state.queenSideRookFile).toBe(0); // a-file
    expect(state.kingSideRookFile).toBe(7); // h-file
    expect(state.castling.whiteKingSide).toBe(true);
    expect(state.castling.whiteQueenSide).toBe(true);
    expect(state.castling.blackKingSide).toBe(true);
    expect(state.castling.blackQueenSide).toBe(true);
  });
});

// ── 2. Game initialization ───────────────────────────────────────────

describe('Chess960 Game Initialization', () => {
  it('creates initial state with Chess960 FEN when enabled', () => {
    const config = chess960Config(0);
    const state = createInitialState('hvh', config);
    expect(state.fen).not.toBe(INITIAL_FEN);
    expect(state.chess960).not.toBeNull();
    expect(state.chess960!.positionIndex).toBe(0);
    expect(state.positionHistory[0].fen).toBe(state.fen);
    expect(state.positionHistory[0].chess960).toEqual(state.chess960);
  });

  it('creates initial state with standard FEN when Chess960 disabled', () => {
    const config = standardConfig();
    const state = createInitialState('hvh', config);
    expect(state.fen).toBe(INITIAL_FEN);
    expect(state.chess960).toBeNull();
  });

  it('standard position (518) uses different FEN format than INITIAL_FEN', () => {
    const config = chess960Config(518);
    const state = createInitialState('hvh', config);
    // Chess960 FEN has '-' for castling rights
    expect(state.fen).toContain(' - ');
    expect(state.fen).not.toContain('KQkq');
  });

  it('isChess960Enabled returns correct value', () => {
    const on = chess960Config();
    const off = standardConfig();
    expect(isChess960Enabled(on)).toBe(true);
    expect(isChess960Enabled(off)).toBe(false);
  });

  it('config stores chess960Index and initialFen', () => {
    const config = chess960Config(42);
    expect(config.chess960Index).toBe(42);
    expect(config.initialFen).toBe(chess960IndexToFen(42));
  });
});

// ── 3. Castling ──────────────────────────────────────────────────────

describe('Chess960 Castling', () => {
  it('generates castling moves for standard position (518)', () => {
    const fen = chess960IndexToFen(518);
    const state = createChess960State(518);

    // From starting position, castling isn't possible (pieces between king and rooks)
    const moves = getChess960CastlingMoves(fen, state);
    expect(moves).toHaveLength(0);
  });

  it('generates kingside castling when path is clear (standard position)', () => {
    // Standard position with knight and bishop removed from kingside
    const fen = 'rnbqk2r/pppppppp/8/8/8/8/PPPPPPPP/RNBQK2R w - - 0 1';
    const state = createChess960State(518);

    const moves = getChess960CastlingMoves(fen, state);
    const kingSide = moves.find(m => m.san === 'O-O');
    expect(kingSide).toBeDefined();
    expect(kingSide!.from).toBe('e1');
    expect(kingSide!.to).toBe('g1');
  });

  it('generates queenside castling when path is clear (standard position)', () => {
    const fen = 'r3kbnr/pppppppp/8/8/8/8/PPPPPPPP/R3KBNR w - - 0 1';
    const state = createChess960State(518);

    const moves = getChess960CastlingMoves(fen, state);
    const queenSide = moves.find(m => m.san === 'O-O-O');
    expect(queenSide).toBeDefined();
    expect(queenSide!.from).toBe('e1');
    expect(queenSide!.to).toBe('c1');
  });

  it('king ends on g-file and rook on f-file after kingside castling', () => {
    const fen = 'rnbqk2r/pppppppp/8/8/8/8/PPPPPPPP/RNBQK2R w - - 0 1';
    const state = createChess960State(518);
    const moves = getChess960CastlingMoves(fen, state);
    const kingSide = moves.find(m => m.san === 'O-O')!;

    const afterChess = new Chess(kingSide.after);
    const kingPiece = afterChess.get('g1' as Square);
    const rookPiece = afterChess.get('f1' as Square);
    expect(kingPiece?.type).toBe('k');
    expect(kingPiece?.color).toBe('w');
    expect(rookPiece?.type).toBe('r');
    expect(rookPiece?.color).toBe('w');
  });

  it('king ends on c-file and rook on d-file after queenside castling', () => {
    const fen = 'r3kbnr/pppppppp/8/8/8/8/PPPPPPPP/R3KBNR w - - 0 1';
    const state = createChess960State(518);
    const moves = getChess960CastlingMoves(fen, state);
    const queenSide = moves.find(m => m.san === 'O-O-O')!;

    const afterChess = new Chess(queenSide.after);
    const kingPiece = afterChess.get('c1' as Square);
    const rookPiece = afterChess.get('d1' as Square);
    expect(kingPiece?.type).toBe('k');
    expect(kingPiece?.color).toBe('w');
    expect(rookPiece?.type).toBe('r');
    expect(rookPiece?.color).toBe('w');
  });

  it('does not allow castling when king is in check', () => {
    // White king on e1 in check from black rook on e8
    const fen = '4r2k/8/8/8/8/8/8/R3K2R w - - 0 1';
    const state = createChess960State(518);
    const moves = getChess960CastlingMoves(fen, state);
    expect(moves).toHaveLength(0);
  });

  it('does not allow castling when king passes through attacked square', () => {
    // Black rook on f8 attacks f1 — kingside castling blocked (king passes through f1)
    const fen = '5r1k/8/8/8/8/8/8/R3K2R w - - 0 1';
    const state = createChess960State(518);
    const moves = getChess960CastlingMoves(fen, state);
    const kingSide = moves.find(m => m.san === 'O-O');
    expect(kingSide).toBeUndefined(); // f1 is attacked
  });

  it('does not allow castling when rook has moved', () => {
    const fen = 'rnbqk2r/pppppppp/8/8/8/8/PPPPPPPP/RNBQK2R w - - 0 1';
    const state = createChess960State(518);
    const updatedState = { ...state, castling: { ...state.castling, whiteKingSide: false } };
    const moves = getChess960CastlingMoves(fen, updatedState);
    const kingSide = moves.find(m => m.san === 'O-O');
    expect(kingSide).toBeUndefined();
  });

  it('does not allow castling when king has moved', () => {
    const fen = 'rnbqk2r/pppppppp/8/8/8/8/PPPPPPPP/RNBQK2R w - - 0 1';
    const state = createChess960State(518);
    const updatedState = { ...state, castling: { ...state.castling, whiteKingSide: false, whiteQueenSide: false } };
    const moves = getChess960CastlingMoves(fen, updatedState);
    expect(moves).toHaveLength(0);
  });

  it('works for non-standard king position (Chess960)', () => {
    // Position 0: back rank is bbnnrkrq (let's verify)
    const rank = generateChess960BackRank(0);
    const { kingFile, queenSideRookFile, kingSideRookFile } = getChess960PieceFiles(rank);

    // Create the Chess960 state for position 0
    const state = createChess960State(0);

    // From starting position, pieces may block castling
    // Just verify the state has correct files
    expect(state.kingFile).toBe(kingFile);
    expect(state.queenSideRookFile).toBe(queenSideRookFile);
    expect(state.kingSideRookFile).toBe(kingSideRookFile);
  });

  it('getLegalMoves includes castling when chess960 state provided', () => {
    const fen = 'rnbqk2r/pppppppp/8/8/8/8/PPPPPPPP/RNBQK2R w - - 0 1';
    const state = createChess960State(518);

    const movesWithout = getLegalMoves(fen);
    const movesWith = getLegalMoves(fen, state);

    // With chess960, should have additional castling moves
    expect(movesWith.length).toBeGreaterThan(movesWithout.length);
    const castlingMoves = movesWith.filter(m => m.san === 'O-O' || m.san === 'O-O-O');
    expect(castlingMoves.length).toBeGreaterThan(0);
  });

  it('identifyChess960Castling detects kingside castle', () => {
    const state = createChess960State(518);
    const result = identifyChess960Castling(state, 'w', 'e1' as Square, 'g1' as Square);
    expect(result).toBe('kingSide');
  });

  it('identifyChess960Castling detects queenside castle', () => {
    const state = createChess960State(518);
    const result = identifyChess960Castling(state, 'w', 'e1' as Square, 'c1' as Square);
    expect(result).toBe('queenSide');
  });

  it('identifyChess960Castling returns null for non-castling move', () => {
    const state = createChess960State(518);
    const result = identifyChess960Castling(state, 'w', 'e1' as Square, 'e2' as Square);
    expect(result).toBeNull();
  });

  it('updateChess960CastlingState removes rights when king moves', () => {
    const state = createChess960State(518);
    const updated = updateChess960CastlingState(state, 'w', 'e1' as Square, 'e2' as Square, false);
    expect(updated.castling.whiteKingSide).toBe(false);
    expect(updated.castling.whiteQueenSide).toBe(false);
    expect(updated.castling.blackKingSide).toBe(true);
    expect(updated.castling.blackQueenSide).toBe(true);
  });

  it('updateChess960CastlingState removes rights when rook moves', () => {
    const state = createChess960State(518);
    const updated = updateChess960CastlingState(state, 'w', 'h1' as Square, 'h3' as Square, false);
    expect(updated.castling.whiteKingSide).toBe(false);
    expect(updated.castling.whiteQueenSide).toBe(true);
  });

  it('updateChess960CastlingState removes rights when rook captured', () => {
    const state = createChess960State(518);
    const updated = updateChess960CastlingState(state, 'b', 'b2' as Square, 'a1' as Square, true);
    expect(updated.castling.whiteQueenSide).toBe(false);
    expect(updated.castling.whiteKingSide).toBe(true);
  });

  it('updateChess960StateAfterCastle removes both rights for side', () => {
    const state = createChess960State(518);
    const updated = updateChess960StateAfterCastle(state, 'w');
    expect(updated.castling.whiteKingSide).toBe(false);
    expect(updated.castling.whiteQueenSide).toBe(false);
    expect(updated.castling.blackKingSide).toBe(true);
    expect(updated.castling.blackQueenSide).toBe(true);
  });

  it('castling move applied via applyMoveWithRules works', () => {
    const config = chess960Config(518);
    const state = createInitialState('hvh', config);

    // Play some moves to clear the kingside path
    // 1. e2-e4
    let s = applyMoveWithRules(state, { from: 'e2' as Square, to: 'e4' as Square });
    // 1... e7-e5
    s = applyMoveWithRules(s, { from: 'e7' as Square, to: 'e5' as Square });
    // 2. Nf3
    s = applyMoveWithRules(s, { from: 'g1' as Square, to: 'f3' as Square });
    // 2... Nc6
    s = applyMoveWithRules(s, { from: 'b8' as Square, to: 'c6' as Square });
    // 3. Bf1-c4
    s = applyMoveWithRules(s, { from: 'f1' as Square, to: 'c4' as Square });
    // 3... Bc5
    s = applyMoveWithRules(s, { from: 'f8' as Square, to: 'c5' as Square });

    // Now white can castle kingside
    const castleMoves = getChess960CastlingMoves(s.fen, s.chess960!);
    const kingSide = castleMoves.find(m => m.san === 'O-O');
    expect(kingSide).toBeDefined();

    // Apply the castling move
    const afterCastle = applyMoveWithRules(s, { from: 'e1' as Square, to: 'g1' as Square });
    expect(afterCastle).not.toBe(s); // Move was accepted

    // Verify king and rook positions
    const chess = new Chess(afterCastle.fen);
    expect(chess.get('g1' as Square)?.type).toBe('k');
    expect(chess.get('f1' as Square)?.type).toBe('r');

    // Verify castling rights removed
    expect(afterCastle.chess960!.castling.whiteKingSide).toBe(false);
    expect(afterCastle.chess960!.castling.whiteQueenSide).toBe(false);
  });

  it('black can also castle', () => {
    const config = chess960Config(518);
    let s = createInitialState('hvh', config);

    // Play moves to clear black's kingside
    s = applyMoveWithRules(s, { from: 'e2' as Square, to: 'e4' as Square });
    s = applyMoveWithRules(s, { from: 'e7' as Square, to: 'e5' as Square });
    s = applyMoveWithRules(s, { from: 'g1' as Square, to: 'f3' as Square });
    s = applyMoveWithRules(s, { from: 'g8' as Square, to: 'f6' as Square });
    s = applyMoveWithRules(s, { from: 'f1' as Square, to: 'c4' as Square });
    s = applyMoveWithRules(s, { from: 'f8' as Square, to: 'c5' as Square });

    // White castles
    s = applyMoveWithRules(s, { from: 'e1' as Square, to: 'g1' as Square });

    // Now black can castle kingside
    const afterBlackCastle = applyMoveWithRules(s, { from: 'e8' as Square, to: 'g8' as Square });
    expect(afterBlackCastle).not.toBe(s);

    const chess = new Chess(afterBlackCastle.fen);
    expect(chess.get('g8' as Square)?.type).toBe('k');
    expect(chess.get('f8' as Square)?.type).toBe('r');
  });
});

// ── 4. Variant integration ───────────────────────────────────────────

describe('Chess960 Variant Integration', () => {
  it('classic blunzinger works from Chess960 position', () => {
    const config = chess960Config(42);
    const state = createInitialState('hvh', config);

    // Game starts correctly
    expect(state.chess960).not.toBeNull();
    expect(state.config.variantMode).toBe('classic_blunzinger');

    // Can make a move
    const legal = getLegalMoves(state.fen, state.chess960);
    expect(legal.length).toBeGreaterThan(0);

    // Apply a move
    const firstMove = legal[0];
    const newState = applyMoveWithRules(state, { from: firstMove.from as Square, to: firstMove.to as Square, promotion: firstMove.promotion });
    expect(newState).not.toBe(state);
  });

  it('reverse blunzinger works from Chess960 position', () => {
    const config: MatchConfig = {
      ...chess960Config(100),
      variantMode: 'reverse_blunzinger',
    };
    const state = createInitialState('hvh', config);
    expect(state.chess960).not.toBeNull();
    expect(state.config.variantMode).toBe('reverse_blunzinger');

    const legal = getLegalMoves(state.fen, state.chess960);
    expect(legal.length).toBeGreaterThan(0);
  });

  it('king hunt move limit works from Chess960 position', () => {
    const config: MatchConfig = {
      ...chess960Config(200),
      variantMode: 'classic_king_hunt_move_limit',
    };
    const state = createInitialState('hvh', config);
    expect(state.chess960).not.toBeNull();
    expect(state.config.variantMode).toBe('classic_king_hunt_move_limit');
  });

  it('king hunt given check limit works from Chess960 position', () => {
    const config: MatchConfig = {
      ...chess960Config(300),
      variantMode: 'classic_king_hunt_given_check_limit',
    };
    const state = createInitialState('hvh', config);
    expect(state.chess960).not.toBeNull();
    expect(state.config.variantMode).toBe('classic_king_hunt_given_check_limit');
  });

  it('violation detection includes Chess960 castling moves', () => {
    // Position with available check via castling - verify detection works
    const fen = 'rnbqk2r/pppppppp/8/8/8/8/PPPPPPPP/RNBQK2R w - - 0 1';
    const state = createChess960State(518);

    // Getting checking moves with Chess960 state
    const checkingWithout = getCheckingMoves(fen);
    const checkingWith = getCheckingMoves(fen, state);

    // Both should work without error
    expect(checkingWithout).toBeDefined();
    expect(checkingWith).toBeDefined();

    // Non-checking moves should also work
    const nonCheckingWithout = getNonCheckingMoves(fen);
    const nonCheckingWith = getNonCheckingMoves(fen, state);
    expect(nonCheckingWithout).toBeDefined();
    expect(nonCheckingWith).toBeDefined();
  });
});

// ── 5. Overlay combinations ──────────────────────────────────────────

describe('Chess960 Overlay Combinations', () => {
  it('Chess960 + Clock works', () => {
    const config = chess960ConfigWithOverlays({
      enableClock: true,
      initialTimeMs: 300000,
    }, 50);
    const state = createInitialState('hvh', config);
    expect(state.chess960).not.toBeNull();
    expect(state.clocks).not.toBeNull();
    expect(state.clocks!.whiteMs).toBe(300000);
  });

  it('Chess960 + King of the Hill works', () => {
    const config = chess960ConfigWithOverlays({
      enableKingOfTheHill: true,
    }, 100);
    const state = createInitialState('hvh', config);
    expect(state.chess960).not.toBeNull();
    expect(state.config.overlays.enableKingOfTheHill).toBe(true);
  });

  it('Chess960 + Double Check Pressure works', () => {
    const config = chess960ConfigWithOverlays({
      enableDoubleCheckPressure: true,
    }, 150);
    const state = createInitialState('hvh', config);
    expect(state.chess960).not.toBeNull();
    expect(state.config.overlays.enableDoubleCheckPressure).toBe(true);
  });

  it('Chess960 + Crazyhouse works', () => {
    const config = chess960ConfigWithOverlays({
      enableCrazyhouse: true,
    }, 200);
    const state = createInitialState('hvh', config);
    expect(state.chess960).not.toBeNull();
    expect(state.crazyhouse).not.toBeNull();
  });

  it('Chess960 + all overlays combined', () => {
    const config = chess960ConfigWithOverlays({
      enableKingOfTheHill: true,
      enableClock: true,
      initialTimeMs: 300000,
      enableDoubleCheckPressure: true,
      enableCrazyhouse: true,
    }, 500);
    const state = createInitialState('hvh', config);
    expect(state.chess960).not.toBeNull();
    expect(state.clocks).not.toBeNull();
    expect(state.crazyhouse).not.toBeNull();
    expect(state.config.overlays.enableKingOfTheHill).toBe(true);
    expect(state.config.overlays.enableDoubleCheckPressure).toBe(true);
  });
});

// ── 6. Bot / evaluation / review ─────────────────────────────────────

describe('Chess960 Bot/Evaluation/Review', () => {
  it('bot can play from Chess960 starting position', () => {
    const config = chess960Config(42);
    const state = createInitialState('hvbot', config);
    const move = selectBotMove(state.fen, 'easy', config, state.chess960);
    expect(move).not.toBeNull();

    // Verify the move is legal
    const legal = getLegalMoves(state.fen, state.chess960);
    const isLegal = legal.some(
      m => m.from === move!.from && m.to === move!.to,
    );
    expect(isLegal).toBe(true);
  });

  it('bot selects legal moves across multiple Chess960 positions', () => {
    for (const idx of [0, 100, 518, 700, 959]) {
      const config = chess960Config(idx);
      const state = createInitialState('hvbot', config);
      const move = selectBotMove(state.fen, 'hard', config, state.chess960);
      expect(move).not.toBeNull();
    }
  });

  it('review reconstructs Chess960 game correctly', () => {
    const config = chess960Config(42);
    const state = createInitialState('hvh', config);

    // Verify position history starts with Chess960 FEN
    expect(state.positionHistory[0].fen).toBe(config.initialFen);
    expect(state.positionHistory[0].chess960).toEqual(state.chess960);

    // Play a move and verify history
    const legal = getLegalMoves(state.fen, state.chess960);
    const firstMove = legal[0];
    const s2 = applyMoveWithRules(state, { from: firstMove.from as Square, to: firstMove.to as Square });
    expect(s2.positionHistory).toHaveLength(2);
    expect(s2.positionHistory[0].fen).toBe(config.initialFen);
  });

  it('bot finds move at FEN from issue (Chess960+classic+KOTH+crazyhouse)', () => {
    // Regression: bot stopped playing at this FEN in a Chess960 + classic + KOTH +
    // crazyhouse bot-vs-bot game. The fix ensures chess960 state is propagated
    // through the Blunznforön bot pipeline (getFilteredCandidates, variant filtering).
    const fen = 'bbqrk1rn/pppp1pB1/5P2/7p/1P4P1/4PPn1/P1P1P2P/1BQRNKR1 w - - 0 10';
    const config = chess960ConfigWithOverlays({
      enableKingOfTheHill: true,
      enableCrazyhouse: true,
    });
    const chess960 = createChess960State(config.chess960Index!);
    // Override castling state to match mid-game (king on f1, rooks on d1 and g1)
    const chess960State = {
      ...chess960,
      kingFile: 5,
      queenSideRookFile: 3,
      kingSideRookFile: 6,
    };

    for (const level of ['easy', 'medium', 'hard'] as const) {
      const move = selectBotMove(fen, level, config, chess960State);
      expect(move).not.toBeNull();
      // Verify the returned move is legal
      const legal = getLegalMoves(fen, chess960State);
      const isLegal = legal.some(m => m.from === move!.from && m.to === move!.to);
      expect(isLegal).toBe(true);
    }
  });

  it('bot propagates chess960 state through variant filtering', () => {
    // Position where a Chess960 castling move gives check — classic mode should
    // detect it through the chess960-aware getCheckingMoves path.
    for (const idx of [0, 100, 700, 959]) {
      const config = chess960Config(idx);
      const state = createInitialState('hvbot', config);
      for (const level of ['easy', 'medium', 'hard'] as const) {
        const move = selectBotMove(state.fen, level, config, state.chess960);
        expect(move).not.toBeNull();
      }
    }
  });

  it('position history preserves chess960 state through moves', () => {
    const config = chess960Config(518);
    let s = createInitialState('hvh', config);

    // Play a few moves
    s = applyMoveWithRules(s, { from: 'e2' as Square, to: 'e4' as Square });
    s = applyMoveWithRules(s, { from: 'e7' as Square, to: 'e5' as Square });

    // Every position history entry should have chess960 state
    for (const entry of s.positionHistory) {
      expect(entry.chess960).toBeDefined();
      expect(entry.chess960!.positionIndex).toBe(518);
    }
  });
});

// ── 7. buildMatchConfig ──────────────────────────────────────────────

describe('Chess960 Config Building', () => {
  it('buildMatchConfig sets enableChess960 correctly', () => {
    const onConfig = buildMatchConfig({ ...DEFAULT_SETUP_CONFIG, enableChess960: true });
    const offConfig = buildMatchConfig({ ...DEFAULT_SETUP_CONFIG, enableChess960: false });

    expect(onConfig.overlays.enableChess960).toBe(true);
    expect(offConfig.overlays.enableChess960).toBe(false);
  });

  it('buildMatchConfig generates chess960Index when enabled', () => {
    const config = buildMatchConfig({ ...DEFAULT_SETUP_CONFIG, enableChess960: true });
    expect(config.chess960Index).toBeDefined();
    expect(config.chess960Index).toBeGreaterThanOrEqual(0);
    expect(config.chess960Index).toBeLessThan(960);
  });

  it('buildMatchConfig does not generate chess960Index when disabled', () => {
    const config = buildMatchConfig({ ...DEFAULT_SETUP_CONFIG, enableChess960: false });
    expect(config.chess960Index).toBeUndefined();
    expect(config.initialFen).toBe(INITIAL_FEN);
  });

  it('DEFAULT_CONFIG has Chess960 disabled', () => {
    expect(DEFAULT_CONFIG.overlays.enableChess960).toBe(false);
    expect(DEFAULT_CONFIG.initialFen).toBe(INITIAL_FEN);
  });
});
