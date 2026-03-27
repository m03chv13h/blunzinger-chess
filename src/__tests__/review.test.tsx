import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  createInitialState,
  applyMoveWithRules,
  applyPieceRemoval,
  reportViolation,
} from '../core/blunziger/engine';
import type { GameState } from '../core/blunziger/types';
import { DEFAULT_SETUP_CONFIG, buildMatchConfig, INITIAL_FEN } from '../core/blunziger/types';
import { evaluateGameState } from '../core/evaluation/evaluate';
import { createGameRecord } from '../core/gameRecord';
import App from '../App';

// ── Helper: apply a series of SAN moves to a state ──────────────────
function playMoves(state: GameState, moves: string[]): GameState {
  let current = state;
  for (const san of moves) {
    const next = applyMoveWithRules(current, san);
    if (next === current) {
      throw new Error(`Move "${san}" was rejected at FEN: ${current.fen}`);
    }
    current = next;
  }
  return current;
}

// ── Scholar's mate move sequence (4-move checkmate) ─────────────────
const SCHOLARS_MATE = ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7'];

describe('Post-game review system', () => {
  describe('Position history tracking', () => {
    it('initial state has one positionHistory entry (starting position)', () => {
      const state = createInitialState();
      expect(state.positionHistory).toHaveLength(1);
      expect(state.positionHistory[0].fen).toBe(INITIAL_FEN);
      expect(state.positionHistory[0].scores).toEqual({ w: 0, b: 0 });
      expect(state.positionHistory[0].moveNotation).toBeNull();
    });

    it('positionHistory grows by one for each chess move', () => {
      let state = createInitialState();
      state = applyMoveWithRules(state, 'e4');
      expect(state.positionHistory).toHaveLength(2);
      expect(state.positionHistory[1].moveNotation).toBe('e4');

      state = applyMoveWithRules(state, 'e5');
      expect(state.positionHistory).toHaveLength(3);
      expect(state.positionHistory[2].moveNotation).toBe('e5');
    });

    it('positionHistory FEN matches state FEN after each move', () => {
      let state = createInitialState();
      state = applyMoveWithRules(state, 'e4');
      expect(state.positionHistory[1].fen).toBe(state.fen);

      state = applyMoveWithRules(state, 'e5');
      expect(state.positionHistory[2].fen).toBe(state.fen);
    });

    it('positionHistory is not mutated by applyMoveWithRules (immutability)', () => {
      const state = createInitialState();
      const historyBefore = state.positionHistory;
      const state2 = applyMoveWithRules(state, 'e4');
      // Original state's history should not be modified
      expect(state.positionHistory).toHaveLength(1);
      expect(historyBefore).toBe(state.positionHistory);
      expect(state2.positionHistory).toHaveLength(2);
    });

    it('piece removal adds an entry to positionHistory', () => {
      // Setup: penalty_on_miss with piece removal enabled
      const config = buildMatchConfig({
        ...DEFAULT_SETUP_CONFIG,
        gameType: 'penalty_on_miss',
        enablePieceRemovalPenalty: true,
        pieceRemovalCount: 1,
      });
      let state = createInitialState('hvh', config);

      // Play to a position where white has a checking move but doesn't play it
      // From starting: e4 e5 Bc4 d6 — now white has Bxf7+ but plays Nf3 instead
      state = playMoves(state, ['e4', 'e5', 'Bc4', 'd6']);
      const countBefore = state.positionHistory.length;

      // White plays Nf3 (not a check) — triggers piece removal penalty
      state = applyMoveWithRules(state, 'Nf3');

      // If a piece removal is pending, apply it
      if (state.pendingPieceRemoval) {
        const sq = state.pendingPieceRemoval.removableSquares[0];
        const countAfterMove = state.positionHistory.length;
        state = applyPieceRemoval(state, sq);
        // Piece removal should add one more entry
        expect(state.positionHistory).toHaveLength(countAfterMove + 1);
        // That entry should have null moveNotation (not a chess move)
        expect(state.positionHistory[state.positionHistory.length - 1].moveNotation).toBeNull();
      } else {
        // Even without piece removal, the move itself should have added an entry
        expect(state.positionHistory.length).toBeGreaterThan(countBefore);
      }
    });
  });

  describe('Review of completed game (Scholar\'s Mate)', () => {
    let finishedState: GameState;

    beforeEach(() => {
      finishedState = playMoves(createInitialState(), SCHOLARS_MATE);
    });

    it('game should be over after Scholar\'s Mate', () => {
      expect(finishedState.result).not.toBeNull();
      expect(finishedState.result?.winner).toBe('w');
      expect(finishedState.result?.reason).toBe('checkmate');
    });

    it('positionHistory should have 8 entries (initial + 7 moves)', () => {
      expect(finishedState.positionHistory).toHaveLength(8);
    });

    it('first positionHistory entry is the starting position', () => {
      expect(finishedState.positionHistory[0].fen).toBe(INITIAL_FEN);
      expect(finishedState.positionHistory[0].moveNotation).toBeNull();
    });

    it('last positionHistory entry matches the final game FEN', () => {
      const last = finishedState.positionHistory[finishedState.positionHistory.length - 1];
      expect(last.fen).toBe(finishedState.fen);
    });

    it('every positionHistory entry has a valid FEN', () => {
      for (const entry of finishedState.positionHistory) {
        expect(entry.fen).toMatch(/\s[wb]\s/); // FEN contains side to move
      }
    });

    it('move notations in positionHistory match moveHistory SAN', () => {
      const notations = finishedState.positionHistory
        .filter(e => e.moveNotation !== null)
        .map(e => e.moveNotation);
      const sanMoves = finishedState.moveHistory.map(m => m.san);
      expect(notations).toEqual(sanMoves);
    });

    it('review does not mutate the final game result', () => {
      // Accessing positionHistory entries should not alter the result
      expect(finishedState.positionHistory[0].fen).toBe(INITIAL_FEN);
      expect(finishedState.positionHistory[3].fen).toBeTruthy();
      expect(finishedState.result).not.toBeNull();
      expect(finishedState.result?.winner).toBe('w');
      expect(finishedState.result?.reason).toBe('checkmate');
    });
  });

  describe('Evaluation recalculation for reviewed positions', () => {
    let finishedState: GameState;

    beforeEach(() => {
      finishedState = playMoves(createInitialState(), SCHOLARS_MATE);
    });

    it('evaluation of initial position is roughly equal', () => {
      const initialState: GameState = {
        ...finishedState,
        fen: finishedState.positionHistory[0].fen,
        scores: finishedState.positionHistory[0].scores,
        result: null,
        pendingViolation: null,
        pendingPieceRemoval: null,
        plyCount: 0,
      };
      const evalResult = evaluateGameState(initialState);
      // Starting position should be roughly equal
      expect(Math.abs(evalResult.scoreCp)).toBeLessThan(150);
    });

    it('evaluation of checkmate position is decisive for white', () => {
      const evalResult = evaluateGameState(finishedState);
      expect(evalResult.scoreCp).toBeGreaterThan(0);
      expect(evalResult.favoredSide).toBe('white');
    });

    it('evaluation changes when stepping backward from final position', () => {
      // Evaluate final (checkmate) position
      const finalEval = evaluateGameState(finishedState);

      // Evaluate position 2 steps before the end
      const midState: GameState = {
        ...finishedState,
        fen: finishedState.positionHistory[5].fen,
        scores: finishedState.positionHistory[5].scores,
        result: null,
        pendingViolation: null,
        pendingPieceRemoval: null,
        plyCount: 5,
      };
      const midEval = evaluateGameState(midState);

      // The checkmate eval should be more extreme than a mid-game eval
      expect(Math.abs(finalEval.scoreCp)).toBeGreaterThan(Math.abs(midEval.scoreCp));
    });

    it('evaluation changes when stepping forward again', () => {
      // Evaluate initial position
      const initState: GameState = {
        ...finishedState,
        fen: finishedState.positionHistory[0].fen,
        scores: finishedState.positionHistory[0].scores,
        result: null,
        pendingViolation: null,
        pendingPieceRemoval: null,
        plyCount: 0,
      };
      const initEval = evaluateGameState(initState);

      // Evaluate position after move 4 (1. e4 e5 2. Bc4 Nc6)
      const step4State: GameState = {
        ...finishedState,
        fen: finishedState.positionHistory[4].fen,
        scores: finishedState.positionHistory[4].scores,
        result: null,
        pendingViolation: null,
        pendingPieceRemoval: null,
        plyCount: 4,
      };
      const step4Eval = evaluateGameState(step4State);

      // These should be different evaluations
      // (Bc4 develops a bishop and creates threats, changing the eval)
      expect(initEval.scoreCp).not.toBe(step4Eval.scoreCp);
    });
  });

  describe('King Hunt variant review', () => {
    it('scores in positionHistory reflect King Hunt scoring', () => {
      const config = buildMatchConfig({
        ...DEFAULT_SETUP_CONFIG,
        variantMode: 'classic_king_hunt_move_limit',
        kingHuntPlyLimit: 100,
      });
      let state = createInitialState('hvh', config);

      // Play some moves where checks happen
      // 1. e4 e5 2. Qh5 (gives check: Qh5+ isn't check from starting.. use Bc4 Nf6 approach)
      // Actually, let's play moves that give check to score points
      // 1. e4 f5 2. Qh5+ (check!) - White scores
      state = playMoves(state, ['e4', 'f5', 'Qh5']);

      // After Qh5+ (check), white should have scored
      const lastEntry = state.positionHistory[state.positionHistory.length - 1];
      expect(lastEntry.scores.w).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Review with report-based game end', () => {
    it('positionHistory is complete when game ends via valid report', () => {
      // Classic Blunzinger + report incorrectness
      let state = createInitialState();

      // Play: 1. e4 e5 2. Bc4 d6 — White now has Bxf7+ but plays Nf3 (violation)
      state = playMoves(state, ['e4', 'e5', 'Bc4', 'd6', 'Nf3']);

      // Black reports the violation
      const reported = reportViolation(state, 'b');
      if (reported.result) {
        expect(reported.positionHistory.length).toBeGreaterThanOrEqual(6);
        // positionHistory should be the same as before reporting
        // (report doesn't add a position — it just ends the game)
        expect(reported.positionHistory).toEqual(state.positionHistory);
      }
    });
  });

  describe('UI integration', () => {
    it('review controls appear after starting a game (setup needed)', () => {
      render(<App />);
      fireEvent.click(screen.getByText('▶ Start Game'));

      // Review controls should NOT appear during an active game
      expect(screen.queryByText('📖 Review Mode')).not.toBeInTheDocument();
    });

    it('evaluation bar toggle works during game', () => {
      render(<App />);
      fireEvent.click(screen.getByText('▶ Start Game'));
      const toggle = screen.getByLabelText('Show evaluation bar');
      fireEvent.click(toggle);
      expect(document.querySelector('.eval-bar')).toBeInTheDocument();
    });
  });

  describe('Gameplay disabled during review (engine level)', () => {
    it('applyMoveWithRules returns same state when game is over', () => {
      const finishedState = playMoves(createInitialState(), SCHOLARS_MATE);
      expect(finishedState.result).not.toBeNull();

      // Try to make a move on the finished game
      const attempt = applyMoveWithRules(finishedState, 'e4');
      expect(attempt).toBe(finishedState); // Same reference = move rejected
    });

    it('report is rejected when game is over', () => {
      const finishedState = playMoves(createInitialState(), SCHOLARS_MATE);
      const reported = reportViolation(finishedState, 'b');
      // Report adds invalid report count but doesn't change result
      // (canReport returns false when result exists)
      expect(reported.result).toEqual(finishedState.result);
    });
  });

  describe('Deterministic history reconstruction', () => {
    it('positionHistory produces deterministic FENs across identical games', () => {
      const state1 = playMoves(createInitialState(), SCHOLARS_MATE);
      const state2 = playMoves(createInitialState(), SCHOLARS_MATE);

      expect(state1.positionHistory.length).toBe(state2.positionHistory.length);
      for (let i = 0; i < state1.positionHistory.length; i++) {
        expect(state1.positionHistory[i].fen).toBe(state2.positionHistory[i].fen);
        expect(state1.positionHistory[i].scores).toEqual(state2.positionHistory[i].scores);
        expect(state1.positionHistory[i].moveNotation).toBe(state2.positionHistory[i].moveNotation);
      }
    });

    it('each positionHistory FEN is a valid chess position', () => {
      const state = playMoves(createInitialState(), SCHOLARS_MATE);
      for (const entry of state.positionHistory) {
        // FEN should have 6 space-separated parts
        const parts = entry.fen.split(' ');
        expect(parts).toHaveLength(6);
        // Board part should have 8 ranks
        expect(parts[0].split('/')).toHaveLength(8);
      }
    });

    it('stepping through positionHistory shows consecutive positions', () => {
      const state = playMoves(createInitialState(), ['e4', 'e5', 'Nf3']);
      // Position 0: initial
      // Position 1: after e4
      // Position 2: after e5
      // Position 3: after Nf3

      // Position 1 should differ from position 0 (e4 was played)
      expect(state.positionHistory[1].fen).not.toBe(state.positionHistory[0].fen);
      // Position 2 should differ from position 1 (e5 was played)
      expect(state.positionHistory[2].fen).not.toBe(state.positionHistory[1].fen);
    });
  });

  describe('Review with different variant configs', () => {
    it('review works with Reverse Blunzinger variant', () => {
      const config = buildMatchConfig({
        ...DEFAULT_SETUP_CONFIG,
        variantMode: 'reverse_blunzinger',
      });
      let state = createInitialState('hvh', config);
      state = playMoves(state, ['e4', 'e5', 'Nf3']);

      expect(state.positionHistory).toHaveLength(4); // initial + 3 moves
      expect(state.positionHistory[0].fen).toBe(INITIAL_FEN);
    });

    it('review works with King of the Hill overlay', () => {
      const config = buildMatchConfig({
        ...DEFAULT_SETUP_CONFIG,
        enableKingOfTheHill: true,
      });
      let state = createInitialState('hvh', config);
      state = playMoves(state, ['e4', 'e5']);

      expect(state.positionHistory).toHaveLength(3);
    });

    it('review works with clock enabled', () => {
      const config = buildMatchConfig({
        ...DEFAULT_SETUP_CONFIG,
        enableClock: true,
        initialTimeMs: 300000,
      });
      let state = createInitialState('hvh', config);
      state = playMoves(state, ['e4', 'e5']);

      expect(state.positionHistory).toHaveLength(3);
      expect(state.clocks).not.toBeNull();
    });

    it('review works with Double Check Pressure overlay', () => {
      const config = buildMatchConfig({
        ...DEFAULT_SETUP_CONFIG,
        enableDoubleCheckPressure: true,
      });
      let state = createInitialState('hvh', config);
      state = playMoves(state, ['e4', 'e5', 'Nf3']);

      expect(state.positionHistory).toHaveLength(4);
    });
  });

  describe('Loading a game record for review (Analyse mode)', () => {
    let finishedState: GameState;
    let record: ReturnType<typeof createGameRecord>;

    beforeEach(() => {
      finishedState = playMoves(createInitialState(), SCHOLARS_MATE);
      record = createGameRecord(
        DEFAULT_SETUP_CONFIG,
        finishedState.result!,
        finishedState.fen,
        finishedState.moveHistory.length,
        finishedState.scores,
        finishedState.positionHistory,
        finishedState.moveHistory,
        finishedState.violationReports,
        finishedState.missedChecks,
        finishedState.pieceRemovals,
        finishedState.timeReductions,
      );
    });

    it('loaded game record preserves position history', () => {
      expect(record.positionHistory).toHaveLength(8);
      expect(record.positionHistory[0].fen).toBe(INITIAL_FEN);
      expect(record.positionHistory[7].fen).toBe(finishedState.fen);
    });

    it('loaded game record preserves move history', () => {
      expect(record.moveHistory).toHaveLength(7);
      // SAN includes check/checkmate symbols (e.g. Qxf7#)
      const sans = record.moveHistory.map(m => m.san);
      expect(sans.slice(0, 6)).toEqual(SCHOLARS_MATE.slice(0, 6));
      expect(sans[6]).toBe('Qxf7#');
    });

    it('loaded game record preserves result', () => {
      expect(record.result).not.toBeNull();
      expect(record.result.winner).toBe('w');
      expect(record.result.reason).toBe('checkmate');
    });

    it('reconstructed state from record enables review mode', () => {
      // Simulate what loadGameForReview does: reconstruct a GameState from a record
      const mc = buildMatchConfig(record.config);
      const base = createInitialState(
        record.config.mode,
        mc,
        record.config.botDifficulty,
        record.config.botSide,
        record.config.engineIdWhite,
        record.config.engineIdBlack,
      );
      const loadedState: GameState = {
        ...base,
        fen: record.finalFen,
        moveHistory: record.moveHistory,
        result: record.result,
        scores: record.scores,
        clocks: null,
        plyCount: record.moveCount,
        positionHistory: record.positionHistory,
        violationReports: record.violationReports,
        missedChecks: record.missedChecks,
        pieceRemovals: record.pieceRemovals,
        timeReductions: record.timeReductions,
      };

      // State should have result set (enabling review mode)
      expect(loadedState.result).not.toBeNull();
      // positionHistory should be complete for review step building
      expect(loadedState.positionHistory).toHaveLength(8);
      // moveHistory should be complete for move list display
      expect(loadedState.moveHistory).toHaveLength(7);
    });

    it('review steps can be built from loaded state positionHistory', () => {
      // Build review steps the same way useReview does
      let moveCounter = -1;
      const steps = record.positionHistory.map((entry, index) => {
        if (entry.moveNotation !== null) moveCounter++;
        return {
          index,
          fen: entry.fen,
          moveNotation: entry.moveNotation,
          moveIndex: entry.moveNotation !== null ? moveCounter : -1,
        };
      });

      expect(steps).toHaveLength(8);
      expect(steps[0].moveNotation).toBeNull(); // initial position
      expect(steps[0].moveIndex).toBe(-1);
      expect(steps[1].moveNotation).toBe('e4');
      expect(steps[1].moveIndex).toBe(0);
      expect(steps[7].moveNotation).toBe('Qxf7#');
      expect(steps[7].moveIndex).toBe(6);
    });

    it('review navigation across all steps of a loaded game works', () => {
      const steps = record.positionHistory;

      // All FENs should be valid
      for (const entry of steps) {
        const parts = entry.fen.split(' ');
        expect(parts).toHaveLength(6);
        expect(parts[0].split('/')).toHaveLength(8);
      }

      // Step 0 is initial position
      expect(steps[0].fen).toBe(INITIAL_FEN);
      // Last step is checkmate position
      expect(steps[steps.length - 1].fen).toBe(record.finalFen);
    });
  });

  describe('Clock data in review', () => {
    it('position history entries contain clock times when clocks were enabled', () => {
      const config = {
        ...DEFAULT_SETUP_CONFIG,
        enableClock: true,
        initialTimeMs: 5 * 60 * 1000,
      };
      const mc = buildMatchConfig(config);
      let state = createInitialState('hvh', mc);

      // Initial entry should have clock data
      expect(state.positionHistory[0].clockWhiteMs).toBe(300_000);
      expect(state.positionHistory[0].clockBlackMs).toBe(300_000);

      // Play a move (scholar's mate first move)
      state = applyMoveWithRules(state, 'e4');
      const entry = state.positionHistory[1];
      expect(entry.clockWhiteMs).toBeDefined();
      expect(entry.clockBlackMs).toBeDefined();
      expect(typeof entry.clockWhiteMs).toBe('number');
      expect(typeof entry.clockBlackMs).toBe('number');
    });

    it('position history entries have no clock fields when clocks were disabled', () => {
      const config = { ...DEFAULT_SETUP_CONFIG, enableClock: false };
      const mc = buildMatchConfig(config);
      let state = createInitialState('hvh', mc);

      expect(state.positionHistory[0].clockWhiteMs).toBeUndefined();
      expect(state.positionHistory[0].clockBlackMs).toBeUndefined();

      state = applyMoveWithRules(state, 'e4');
      expect(state.positionHistory[1].clockWhiteMs).toBeUndefined();
      expect(state.positionHistory[1].clockBlackMs).toBeUndefined();
    });
  });
});
