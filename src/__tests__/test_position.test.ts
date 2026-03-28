import { describe, it, expect } from 'vitest';
import { createChess960State, generateChess960BackRank } from '../core/blunziger/chess960';
import { getFilteredCandidates } from '../core/bots/blunznforon/blunziger';
import { searchMoves } from '../core/bots/blunznforon/search';
import { getBlunznforonConfig } from '../core/bots/blunznforon/config';
import { selectBotMove } from '../bot/botEngine';
import type { MatchConfig } from '../core/blunziger/types';
import { DEFAULT_SETUP_CONFIG, buildMatchConfig } from '../core/blunziger/types';
import type { SearchContext } from '../core/bots/blunznforon/types';

/**
 * Regression test for: "hard bot misses easy check in chess960"
 *
 * FEN: qnbrknr1/1p1p1p2/2p3pp/p3p3/2P2PP1/4N3/PP1PPb1P/QNBR1K1B w - - 0 9
 *
 * The black bishop on f2 threatens the white king on f1.  The obvious best
 * move is Kxf2 (capturing the bishop).  Before the fix, the quiescence
 * search's fail-hard behaviour caused every root move to score identically,
 * making the hard bot pick randomly among all 26 legal moves.
 */
const FEN = 'qnbrknr1/1p1p1p2/2p3pp/p3p3/2P2PP1/4N3/PP1PPb1P/QNBR1K1B w - - 0 9';

function findIndex(): number {
  for (let i = 0; i < 960; i++) {
    const backRank = generateChess960BackRank(i);
    if (backRank.join('') === 'qnbrknrb') return i;
  }
  return -1;
}

function makeConfig(idx: number): MatchConfig {
  const base = buildMatchConfig({
    ...DEFAULT_SETUP_CONFIG,
    variantMode: 'classic_blunzinger',
    enableChess960: true,
  });
  return { ...base, chess960Index: idx };
}

describe('Hard bot finds best move in Chess960 position', () => {
  it('searchMoves produces differentiated scores with quiescence', () => {
    const idx = findIndex();
    const state = createChess960State(idx);
    const config = makeConfig(idx);
    const blConfig = getBlunznforonConfig('hard');

    const { regularMoves } = getFilteredCandidates(FEN, config, null, 'w', state);

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

    const scored = searchMoves(FEN, regularMoves, blConfig, ctx, 0, 0);

    // Kxf2 should be among the top moves
    expect(scored[0].move.san).toBe('Kxf2');

    // Scores should be differentiated — not all the same (the bug was that
    // fail-hard quiescence caused all 26 moves to score identically)
    const uniqueScores = new Set(scored.map(s => s.score));
    expect(uniqueScores.size).toBeGreaterThan(scored.length / 2);
  });

  it('selectBotMove picks a strong move with Chess960 config', () => {
    const idx = findIndex();
    const state = createChess960State(idx);
    const config = makeConfig(idx);

    // Run bot 10 times — with differentiated scores, weak moves like Na3/b4/a3 should not appear
    const moves: string[] = [];
    for (let i = 0; i < 10; i++) {
      const move = selectBotMove(FEN, 'hard', config, state);
      if (move) moves.push(move.san);
    }

    // The top moves (Kxf2, Nc2, Ng2) should dominate selections
    const topMoves = new Set(['Kxf2', 'Nc2', 'Ng2']);
    const topCount = moves.filter(m => topMoves.has(m)).length;
    expect(topCount).toBeGreaterThanOrEqual(8);
  }, 30000);
});
