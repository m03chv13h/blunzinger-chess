import { describe, it, expect } from 'vitest';
import { buildMatchConfig, DEFAULT_SETUP_CONFIG } from '../core/blunziger/types';
import type { GameState, MatchConfig, Square, Color } from '../core/blunziger/types';
import { createInitialState, applyMoveWithRules, isAtomicEnabled } from '../core/blunziger/engine';
import { chess960IndexToFen } from '../core/blunziger/chess960';
import { applyExplosionToFen, wouldExplodeKing, fenHasKing } from '../core/blunziger/atomic';
import { runSimulatedGame } from '../core/simulation';

// Chess960 index 716 = back rank RBKQNNBR
const CHESS960_INDEX = 716;

function makeAtomicConfig(overrides: Partial<typeof DEFAULT_SETUP_CONFIG> = {}): MatchConfig {
  return buildMatchConfig({
    ...DEFAULT_SETUP_CONFIG,
    enableAtomic: true,
    ...overrides,
  });
}

function makeState(fen: string, config: MatchConfig): GameState {
  const c = { ...config, initialFen: fen };
  return createInitialState('botvbot', c);
}

describe('Issue: Atomic Chess with Chess960+Crazyhouse+KOTH', () => {
  describe('Explosion correctly ends game when king is adjacent', () => {
    it('Bxc7 in Chess960 position 716 should win by king explosion', () => {
      const startFen = chess960IndexToFen(CHESS960_INDEX);
      const config = buildMatchConfig({
        ...DEFAULT_SETUP_CONFIG,
        variantMode: 'classic_blunzinger',
        gameType: 'report_incorrectness',
        enableKingOfTheHill: true,
        enableClock: true,
        initialTimeMs: 300000,
        enableCrazyhouse: true,
        enableChess960: true,
        enableAtomic: true,
      });
      const configWithFen = { ...config, initialFen: startFen, chess960Index: CHESS960_INDEX };

      let state = createInitialState('botvbot', configWithFen);

      // Play 1. f4 a6 2. Bc5 b6 3. Bd6 f5 4. Bxc7
      state = applyMoveWithRules(state, { from: 'f2' as Square, to: 'f4' as Square });
      state = applyMoveWithRules(state, { from: 'a7' as Square, to: 'a6' as Square });
      state = applyMoveWithRules(state, { from: 'g1' as Square, to: 'c5' as Square });
      state = applyMoveWithRules(state, { from: 'b7' as Square, to: 'b6' as Square });
      state = applyMoveWithRules(state, { from: 'c5' as Square, to: 'd6' as Square });
      state = applyMoveWithRules(state, { from: 'f7' as Square, to: 'f5' as Square });
      state = applyMoveWithRules(state, { from: 'd6' as Square, to: 'c7' as Square });

      // Game must end with white winning by king explosion
      expect(state.result).not.toBeNull();
      expect(state.result?.winner).toBe('w');
      expect(state.result?.reason).toBe('atomic_king_explosion');
      
      // FEN should match the explosion result
      expect(state.fen).toBe('r3nnbr/3pp1pp/pp6/5p2/5P2/8/PPPPP1PP/RBKQNN1R b - - 0 4');
      
      // No more moves should be possible
      const afterResult = applyMoveWithRules(state, { from: 'a6' as Square, to: 'a5' as Square });
      expect(afterResult).toBe(state); // Should return unchanged state
    });
  });

  describe('Crazyhouse reserves after atomic capture', () => {
    it('captured piece goes to reserve even in atomic capture', () => {
      const startFen = chess960IndexToFen(CHESS960_INDEX);
      const config = buildMatchConfig({
        ...DEFAULT_SETUP_CONFIG,
        enableCrazyhouse: true,
        enableChess960: true,
        enableAtomic: true,
      });
      const configWithFen = { ...config, initialFen: startFen, chess960Index: CHESS960_INDEX };
      let state = createInitialState('botvbot', configWithFen);

      state = applyMoveWithRules(state, { from: 'f2' as Square, to: 'f4' as Square });
      state = applyMoveWithRules(state, { from: 'a7' as Square, to: 'a6' as Square });
      state = applyMoveWithRules(state, { from: 'g1' as Square, to: 'c5' as Square });
      state = applyMoveWithRules(state, { from: 'b7' as Square, to: 'b6' as Square });
      state = applyMoveWithRules(state, { from: 'c5' as Square, to: 'd6' as Square });
      state = applyMoveWithRules(state, { from: 'f7' as Square, to: 'f5' as Square });
      state = applyMoveWithRules(state, { from: 'd6' as Square, to: 'c7' as Square });

      // Even though game is over, Crazyhouse reserve should have the captured pawn
      expect(state.crazyhouse).not.toBeNull();
      expect(state.crazyhouse!.whiteReserve.p).toBe(1); // captured pawn
      expect(state.crazyhouse!.blackReserve.p).toBe(0); // no black captures
    });

    it('explosion victims should NOT be added to Crazyhouse reserve', () => {
      const startFen = chess960IndexToFen(CHESS960_INDEX);
      const config = buildMatchConfig({
        ...DEFAULT_SETUP_CONFIG,
        enableCrazyhouse: true,
        enableChess960: true,
        enableAtomic: true,
      });
      const configWithFen = { ...config, initialFen: startFen, chess960Index: CHESS960_INDEX };
      let state = createInitialState('botvbot', configWithFen);

      state = applyMoveWithRules(state, { from: 'f2' as Square, to: 'f4' as Square });
      state = applyMoveWithRules(state, { from: 'a7' as Square, to: 'a6' as Square });
      state = applyMoveWithRules(state, { from: 'g1' as Square, to: 'c5' as Square });
      state = applyMoveWithRules(state, { from: 'b7' as Square, to: 'b6' as Square });
      state = applyMoveWithRules(state, { from: 'c5' as Square, to: 'd6' as Square });
      state = applyMoveWithRules(state, { from: 'f7' as Square, to: 'f5' as Square });
      state = applyMoveWithRules(state, { from: 'd6' as Square, to: 'c7' as Square });

      // Explosion destroyed b8 bishop, c8 king, d8 queen
      // These should NOT be in any reserve
      expect(state.crazyhouse!.whiteReserve.b).toBe(0);
      expect(state.crazyhouse!.whiteReserve.q).toBe(0);
      expect(state.crazyhouse!.whiteReserve.n).toBe(0);
      expect(state.crazyhouse!.whiteReserve.r).toBe(0);
    });
  });

  describe('Without atomic: no explosion', () => {
    it('Bxc7 without atomic should be a normal capture', () => {
      const startFen = chess960IndexToFen(CHESS960_INDEX);
      const config = buildMatchConfig({
        ...DEFAULT_SETUP_CONFIG,
        enableKingOfTheHill: true,
        enableClock: true,
        initialTimeMs: 300000,
        enableCrazyhouse: true,
        enableChess960: true,
        enableAtomic: false,
      });
      const configWithFen = { ...config, initialFen: startFen, chess960Index: CHESS960_INDEX };
      let state = createInitialState('botvbot', configWithFen);

      state = applyMoveWithRules(state, { from: 'f2' as Square, to: 'f4' as Square });
      state = applyMoveWithRules(state, { from: 'a7' as Square, to: 'a6' as Square });
      state = applyMoveWithRules(state, { from: 'g1' as Square, to: 'c5' as Square });
      state = applyMoveWithRules(state, { from: 'b7' as Square, to: 'b6' as Square });
      state = applyMoveWithRules(state, { from: 'c5' as Square, to: 'd6' as Square });
      state = applyMoveWithRules(state, { from: 'f7' as Square, to: 'f5' as Square });
      state = applyMoveWithRules(state, { from: 'd6' as Square, to: 'c7' as Square });

      // Bishop should be on c7
      const rank7 = state.fen.split(' ')[0].split('/')[1];
      expect(rank7).toContain('B');

      // Black king should still be on c8
      const rank8 = state.fen.split(' ')[0].split('/')[0];
      expect(rank8).toContain('k');

      // Game should NOT be over
      expect(state.result).toBeNull();

      // Crazyhouse: pawn captured normally
      expect(state.crazyhouse!.whiteReserve.p).toBe(1);
    });
  });

  describe('Atomic self-explosion prevention', () => {
    it('capture that would explode own king is rejected', () => {
      // White king on d1, white knight on e3, black pawn on d2
      // Nxd2 would explode adjacent white king
      const fen = '4k3/8/8/8/8/4N3/3p4/3K4 w - - 0 1';
      const config = makeAtomicConfig();
      const state = makeState(fen, config);
      
      const newState = applyMoveWithRules(state, { from: 'e3' as Square, to: 'd2' as Square });
      // Move should be rejected (state unchanged)
      expect(newState.fen).toBe(state.fen);
    });
  });

  describe('Simulation with Atomic + Crazyhouse + Chess960', () => {
    it('should complete a simulation game without crashing', () => {
      const simConfig = {
        ...DEFAULT_SETUP_CONFIG,
        mode: 'botvbot' as const,
        botDifficulty: 'easy' as const,
        enableCrazyhouse: true,
        enableChess960: true,
        enableAtomic: true,
      };
      const record = runSimulatedGame(simConfig);
      expect(record.result).toBeDefined();
      expect(record.moveCount).toBeGreaterThan(0);
    });
  });
});
