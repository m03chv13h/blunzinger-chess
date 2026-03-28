import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { evaluatePosition } from '../core/bots/blunznforon/evaluate';
import { searchMoves } from '../core/bots/blunznforon/search';
import { orderMoves } from '../core/bots/blunznforon/moveOrdering';
import type { MatchConfig, Color, Move } from '../core/blunziger/types';
import type { SearchContext, BlunznforonConfig } from '../core/bots/blunznforon/types';

const FEN = 'qnbrknr1/1p1p1p2/2p3pp/p3p3/2P2PP1/4N3/PP1PPb1P/QNBR1K1B w - - 0 9';

const config: MatchConfig = {
  variantMode: 'classic_blunzinger',
  gameType: 'report_based',
  overlays: {
    enableKingOfTheHill: false,
    enableClock: false,
    enableChess960: true,
    enableCrazyhouse: false,
    enableDoubleCheckPressure: false,
  },
  penaltyConfig: {
    enableAdditionalMovePenalty: false,
    additionalMoveCount: 0,
    enablePieceRemovalPenalty: false,
    pieceRemovalCount: 0,
    enableTimeReductionPenalty: false,
    timeReductionSeconds: 0,
  },
  variantSpecific: {
    kingHuntPlyLimit: 0,
    kingHuntGivenCheckTarget: 0,
  },
  chess960Index: 199,
};

const ctx: SearchContext = {
  config,
  side: 'w',
  crazyhouse: null,
  kothEnabled: false,
  isKingHunt: false,
  isReverse: false,
  kingHuntPliesRemaining: 0,
  scores: { w: 0, b: 0 },
};

describe('Negamax debugging', () => {
  it('depth 1 search (no quiescence)', () => {
    const blConfig: BlunznforonConfig = {
      searchDepth: 1,
      quiescenceDepth: 0,
      randomMarginCp: 0,
      violationProbability: 0,
      useTacticalExtensions: false,
    };

    const chess = new Chess(FEN);
    const moves = chess.moves({ verbose: true }) as Move[];
    const scored = searchMoves(FEN, moves, blConfig, ctx, 0, 0);
    
    console.log('Depth 1, no quiescence:');
    for (const s of scored.slice(0, 10)) {
      console.log(`  ${s.move.san}: ${s.score}`);
    }
  });

  it('depth 2 search (no quiescence)', () => {
    const blConfig: BlunznforonConfig = {
      searchDepth: 2,
      quiescenceDepth: 0,
      randomMarginCp: 0,
      violationProbability: 0,
      useTacticalExtensions: false,
    };

    const chess = new Chess(FEN);
    const moves = chess.moves({ verbose: true }) as Move[];
    const scored = searchMoves(FEN, moves, blConfig, ctx, 0, 0);
    
    console.log('Depth 2, no quiescence:');
    for (const s of scored.slice(0, 10)) {
      console.log(`  ${s.move.san}: ${s.score}`);
    }
  });

  it('depth 3 search (no quiescence)', () => {
    const blConfig: BlunznforonConfig = {
      searchDepth: 3,
      quiescenceDepth: 0,
      randomMarginCp: 0,
      violationProbability: 0,
      useTacticalExtensions: false,
    };

    const chess = new Chess(FEN);
    const moves = chess.moves({ verbose: true }) as Move[];
    const scored = searchMoves(FEN, moves, blConfig, ctx, 0, 0);
    
    console.log('Depth 3, no quiescence:');
    for (const s of scored.slice(0, 10)) {
      console.log(`  ${s.move.san}: ${s.score}`);
    }
  });

  it('depth 3 search with quiescence 2', () => {
    const blConfig: BlunznforonConfig = {
      searchDepth: 3,
      quiescenceDepth: 2,
      randomMarginCp: 0,
      violationProbability: 0,
      useTacticalExtensions: false,
    };

    const chess = new Chess(FEN);
    const moves = chess.moves({ verbose: true }) as Move[];
    const scored = searchMoves(FEN, moves, blConfig, ctx, 0, 0);
    
    console.log('Depth 3, quiescence 2:');
    for (const s of scored.slice(0, 10)) {
      console.log(`  ${s.move.san}: ${s.score}`);
    }
  });

  it('depth 3 search with quiescence 2 and tactical ext', () => {
    const blConfig: BlunznforonConfig = {
      searchDepth: 3,
      quiescenceDepth: 2,
      randomMarginCp: 0,
      violationProbability: 0,
      useTacticalExtensions: true,
    };

    const chess = new Chess(FEN);
    const moves = chess.moves({ verbose: true }) as Move[];
    const scored = searchMoves(FEN, moves, blConfig, ctx, 0, 0);
    
    console.log('Depth 3, quiescence 2, tactical ext:');
    for (const s of scored.slice(0, 10)) {
      console.log(`  ${s.move.san}: ${s.score}`);
    }
  });
});
