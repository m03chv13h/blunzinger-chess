import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  Color,
  GameState,
  GameMode,
  BotLevel,
  MatchConfig,
  Square,
  CrazyhousePieceType,
  DropMove,
} from '../core/blunziger/types';
import type { EngineId } from '../core/engine/types';
import type { GameRecord } from '../core/gameRecord';
import { DEFAULT_CONFIG, buildMatchConfig } from '../core/blunziger/types';
import {
  createInitialState,
  applyMoveWithRules,
  applyDropMoveWithRules,
  canReport,
  reportViolation,
  getLegalMoves,
  getLegalDropSquares as coreLegalDropSquares,
  applyTimeout,
  applyPieceRemoval,
  selectBestPieceForRemoval,
} from '../core/blunziger/engine';
import { selectBotMove, selectBotDropMove, shouldBotReport } from '../bot/botEngine';

export interface UseGameReturn {
  state: GameState;
  makeMove: (from: Square, to: Square, promotion?: string) => boolean;
  /** Make a crazyhouse drop move. */
  makeDropMove: (piece: CrazyhousePieceType, to: Square) => boolean;
  /** Get legal drop squares for a piece type (Crazyhouse). */
  getDropSquares: (piece: CrazyhousePieceType) => Square[];
  report: () => void;
  resetGame: (
    mode?: GameMode,
    config?: MatchConfig,
    botLevel?: BotLevel,
    botColor?: Color,
    engineIdWhite?: EngineId,
    engineIdBlack?: EngineId,
    botLevelWhite?: BotLevel,
    botLevelBlack?: BotLevel,
  ) => void;
  canReportNow: boolean;
  legalMovesFrom: (square: Square) => Square[];
  isPlayerTurn: boolean;
  botThinking: boolean;
  paused: boolean;
  setPaused: (p: boolean) => void;
  moveDelay: number;
  setMoveDelay: (d: number) => void;
  /** Live clock values (updated every 100ms during active play). */
  clockWhiteMs: number;
  clockBlackMs: number;
  /** Select a piece to remove during piece removal penalty. */
  selectPieceForRemoval: (square: Square) => boolean;
  /** Whether the game is waiting for a piece removal selection. */
  pendingPieceRemoval: boolean;
  /** Squares that are valid targets for piece removal. */
  removableSquares: Square[];
  /** Load a completed game record for review/analysis. */
  loadGameForReview: (record: GameRecord) => void;
}

export function useGame(
  initialMode: GameMode = 'hvh',
  initialConfig: MatchConfig = DEFAULT_CONFIG,
  initialBotLevel: BotLevel = 'easy',
  initialBotColor: Color = 'b',
  initialEngineIdWhite: EngineId = 'heuristic',
  initialEngineIdBlack: EngineId = 'heuristic',
  initialBotLevelWhite?: BotLevel,
  initialBotLevelBlack?: BotLevel,
): UseGameReturn {
  const [state, setState] = useState<GameState>(() =>
    createInitialState(initialMode, initialConfig, initialBotLevel, initialBotColor, initialEngineIdWhite, initialEngineIdBlack, initialBotLevelWhite, initialBotLevelBlack),
  );
  const [botThinking, setBotThinking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [moveDelay, setMoveDelay] = useState(800);
  const stateRef = useRef(state);
  stateRef.current = state;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const moveDelayRef = useRef(moveDelay);
  moveDelayRef.current = moveDelay;

  // ── Clock state (live display) ─────────────────────────────────────
  const [clockWhiteMs, setClockWhiteMs] = useState(
    initialConfig.overlays.enableClock ? initialConfig.overlays.initialTimeMs : 0,
  );
  const [clockBlackMs, setClockBlackMs] = useState(
    initialConfig.overlays.enableClock ? initialConfig.overlays.initialTimeMs : 0,
  );
  const clockActiveRef = useRef<number | null>(null); // wall-clock timestamp when the active side's clock started ticking
  // Committed clock values — survives React re-renders (unlike stateRef which
  // gets overwritten with state on every render).  Updated only on moves,
  // penalties, resets, and other state-committed events.
  const clockCommittedRef = useRef<{ whiteMs: number; blackMs: number } | null>(null);

  // Sync display clocks and committed ref from state whenever state.clocks changes.
  // When lastTimestamp is null (fresh game), fall back to Date.now() so the
  // clock tick interval starts counting immediately.
  useEffect(() => {
    if (state.clocks) {
      clockCommittedRef.current = { whiteMs: state.clocks.whiteMs, blackMs: state.clocks.blackMs };
      setClockWhiteMs(state.clocks.whiteMs);
      setClockBlackMs(state.clocks.blackMs);
      clockActiveRef.current = state.clocks.lastTimestamp ?? Date.now();
    } else {
      clockCommittedRef.current = null;
    }
  }, [state.clocks]);

  // Clock tick interval.
  //
  // Uses a timestamp-based model:  display = committedTime - (now - turnStart).
  // The interval only triggers re-renders; it never mutates refs or stateRef.
  // This avoids the stale-state bug where stateRef.current gets overwritten
  // by React re-renders, resetting the incremental clock deductions.
  //
  // Clock semantics during complex penalty flows:
  // - During normal play: the side to move has the active (running) clock.
  // - During pending piece removal: the chooser is the active side for clock
  //   purposes (they must take the next required action).
  // - Extra consecutive turns: the side with extra turns has the active clock.
  // - If a terminal condition is reached (timeout, checkmate, check limit, etc.),
  //   the clocks stop immediately.
  useEffect(() => {
    const cfg = stateRef.current.config;
    if (!cfg.overlays.enableClock) return;
    if (state.result) return; // no interval needed once the game is over

    const intervalId = setInterval(() => {
      const cur = stateRef.current;
      if (cur.result || !clockCommittedRef.current) return;
      if (pausedRef.current && cur.mode === 'botvbot') return;

      const now = Date.now();
      // clockActiveRef is null only on the very first tick of a fresh game
      // (before the sync effect has run). Falling back to `now` yields
      // elapsed = 0 which is correct — no time has been consumed yet.
      const turnStart = clockActiveRef.current ?? now;
      const elapsed = now - turnStart;

      // The active clock side is always sideToMove:
      // - normal turn → side to move
      // - pending piece removal → chooser (= sideToMove, set by engine)
      // - extra turns → the side that still has turns (= sideToMove)
      const side = cur.sideToMove;
      const key = side === 'w' ? 'whiteMs' : 'blackMs';
      const remaining = Math.max(0, clockCommittedRef.current[key] - elapsed);

      if (side === 'w') setClockWhiteMs(remaining);
      else setClockBlackMs(remaining);

      if (remaining <= 0) {
        setState((prev) => {
          if (prev.result) return prev;
          return applyTimeout(
            {
              ...prev,
              clocks: prev.clocks
                ? { ...prev.clocks, [key]: 0, lastTimestamp: now }
                : { whiteMs: 0, blackMs: 0, lastTimestamp: now },
            },
            side,
          );
        });
      }
    }, 100);

    return () => clearInterval(intervalId);
  }, [state.config.overlays.enableClock, state.result]);

  // ── Move handling ──────────────────────────────────────────────────

  const makeMove = useCallback(
    (from: Square, to: Square, promotion?: string): boolean => {
      const current = stateRef.current;
      if (current.result) return false;
      // Block normal moves while a piece removal selection is pending
      if (current.pendingPieceRemoval) return false;

      // Apply clock time before move
      let stateBeforeMove = current;
      if (current.clocks && clockCommittedRef.current && clockActiveRef.current) {
        const now = Date.now();
        const elapsed = now - clockActiveRef.current;
        const key = current.sideToMove === 'w' ? 'whiteMs' : 'blackMs';
        const remaining = Math.max(0, clockCommittedRef.current[key] - elapsed);
        if (remaining <= 0) {
          const timeoutState = applyTimeout(
            { ...current, clocks: { ...current.clocks, [key]: 0, lastTimestamp: now } },
            current.sideToMove,
          );
          setState(timeoutState);
          return false;
        }
        const increment = current.config.overlays.incrementMs || 0;
        const decrement = current.config.overlays.decrementMs || 0;
        stateBeforeMove = {
          ...current,
          clocks: {
            ...current.clocks,
            [key]: Math.max(0, remaining + increment - decrement),
            lastTimestamp: now,
          },
        };
      }

      const newState = applyMoveWithRules(stateBeforeMove, { from, to, promotion });
      if (newState === stateBeforeMove) return false;

      // Reset clock timestamp for the new side and commit to refs
      if (newState.clocks) {
        const ts = Date.now();
        newState.clocks = { ...newState.clocks, lastTimestamp: ts };
        clockActiveRef.current = ts;
        clockCommittedRef.current = { whiteMs: newState.clocks.whiteMs, blackMs: newState.clocks.blackMs };
      }

      setState(newState);
      return true;
    },
    [],
  );

  const makeDropMove = useCallback(
    (piece: CrazyhousePieceType, to: Square): boolean => {
      const current = stateRef.current;
      if (current.result) return false;
      if (current.pendingPieceRemoval) return false;
      if (!current.crazyhouse) return false;

      const dropMove: DropMove = { type: 'drop', piece, to, color: current.sideToMove };

      // Apply clock time before drop
      let stateBeforeDrop = current;
      if (current.clocks && clockCommittedRef.current && clockActiveRef.current) {
        const now = Date.now();
        const elapsed = now - clockActiveRef.current;
        const key = current.sideToMove === 'w' ? 'whiteMs' : 'blackMs';
        const remaining = Math.max(0, clockCommittedRef.current[key] - elapsed);
        if (remaining <= 0) {
          const timeoutState = applyTimeout(
            { ...current, clocks: { ...current.clocks, [key]: 0, lastTimestamp: now } },
            current.sideToMove,
          );
          setState(timeoutState);
          return false;
        }
        const increment = current.config.overlays.incrementMs || 0;
        const decrement = current.config.overlays.decrementMs || 0;
        stateBeforeDrop = {
          ...current,
          clocks: {
            ...current.clocks,
            [key]: Math.max(0, remaining + increment - decrement),
            lastTimestamp: now,
          },
        };
      }

      const newState = applyDropMoveWithRules(stateBeforeDrop, dropMove);
      if (newState === stateBeforeDrop) return false;

      if (newState.clocks) {
        const ts = Date.now();
        newState.clocks = { ...newState.clocks, lastTimestamp: ts };
        clockActiveRef.current = ts;
        clockCommittedRef.current = { whiteMs: newState.clocks.whiteMs, blackMs: newState.clocks.blackMs };
      }

      setState(newState);
      return true;
    },
    [],
  );

  const getDropSquares = useCallback(
    (piece: CrazyhousePieceType): Square[] => {
      if (!state.crazyhouse) return [];
      return coreLegalDropSquares(state.fen, state.crazyhouse, state.sideToMove, piece);
    },
    [state.fen, state.crazyhouse, state.sideToMove],
  );

  const report = useCallback(() => {
    const current = stateRef.current;
    if (!current.result) {
      const side = current.sideToMove;
      const newState = reportViolation(current, side);
      setState(newState);
    }
  }, []);

  const selectPieceForRemoval = useCallback((square: Square): boolean => {
    const current = stateRef.current;
    if (!current.pendingPieceRemoval) return false;
    const newState = applyPieceRemoval(current, square);
    if (newState === current) return false;
    setState(newState);
    return true;
  }, []);

  const resetGame = useCallback(
    (
      mode?: GameMode,
      config?: MatchConfig,
      botLevel?: BotLevel,
      botColor?: Color,
      engineIdWhite?: EngineId,
      engineIdBlack?: EngineId,
      botLevelWhite?: BotLevel,
      botLevelBlack?: BotLevel,
    ) => {
      const newState = createInitialState(
        mode ?? stateRef.current.mode,
        config ?? stateRef.current.config,
        botLevel ?? stateRef.current.botLevel,
        botColor ?? stateRef.current.botColor,
        engineIdWhite ?? stateRef.current.engineIdWhite,
        engineIdBlack ?? stateRef.current.engineIdBlack,
        botLevelWhite ?? stateRef.current.botLevelWhite,
        botLevelBlack ?? stateRef.current.botLevelBlack,
      );
      setState(newState);
      setBotThinking(false);
      clockActiveRef.current = newState.clocks ? Date.now() : null;
      clockCommittedRef.current = newState.clocks
        ? { whiteMs: newState.clocks.whiteMs, blackMs: newState.clocks.blackMs }
        : null;
      if (newState.clocks) {
        setClockWhiteMs(newState.clocks.whiteMs);
        setClockBlackMs(newState.clocks.blackMs);
      }
    },
    [],
  );

  const loadGameForReview = useCallback((record: GameRecord) => {
    const mc = buildMatchConfig(record.config);
    const base = createInitialState(
      record.config.mode,
      mc,
      record.config.botDifficulty,
      record.config.botSide,
      record.config.engineIdWhite,
      record.config.engineIdBlack,
      record.config.botDifficultyWhite,
      record.config.botDifficultyBlack,
    );
    const sideToMove = (() => {
      const parts = record.finalFen.split(' ');
      return (parts.length >= 2 && parts[1] === 'b') ? 'b' as const : 'w' as const;
    })();
    const lastEntry = record.positionHistory[record.positionHistory.length - 1];
    const finalCrazyhouse = lastEntry?.crazyhouse ?? base.crazyhouse;
    const reviewState: GameState = {
      ...base,
      fen: record.finalFen,
      moveHistory: record.moveHistory,
      sideToMove,
      result: record.result,
      scores: record.scores,
      clocks: null,
      plyCount: record.moveCount,
      positionHistory: record.positionHistory,
      violationReports: record.violationReports,
      missedChecks: record.missedChecks,
      pieceRemovals: record.pieceRemovals,
      timeReductions: record.timeReductions,
      crazyhouse: finalCrazyhouse,
    };
    setState(reviewState);
    setBotThinking(false);
    clockActiveRef.current = null;
    clockCommittedRef.current = null;
    setClockWhiteMs(0);
    setClockBlackMs(0);
  }, []);

  const canReportNow = canReport(state, state.sideToMove);

  const legalMovesFrom = useCallback(
    (square: Square): Square[] => {
      const moves = getLegalMoves(state.fen);
      return moves.filter((m) => m.from === square).map((m) => m.to as Square);
    },
    [state.fen],
  );

  // Determine if it's a human's turn
  const isPlayerTurn = (() => {
    if (state.result) return false;
    if (state.pendingPieceRemoval) {
      // During piece removal, the chooser is the active player
      if (state.mode === 'hvh') return true;
      if (state.mode === 'hvbot') return state.pendingPieceRemoval.chooserSide !== state.botColor;
      return false;
    }
    if (state.mode === 'hvh') return true;
    if (state.mode === 'hvbot') return state.sideToMove !== state.botColor;
    return false;
  })();

  // Bot move effect
  useEffect(() => {
    if (state.result) return;
    if (pausedRef.current && state.mode === 'botvbot') return;

    // Handle pending piece removal when bot is the chooser
    if (state.pendingPieceRemoval && (
      (state.mode === 'hvbot' && state.pendingPieceRemoval.chooserSide === state.botColor) ||
      state.mode === 'botvbot'
    )) {
      setBotThinking(true);
      const delay = state.mode === 'botvbot' ? moveDelayRef.current : 400;
      const timer = setTimeout(() => {
        const current = stateRef.current;
        if (!current.pendingPieceRemoval) {
          setBotThinking(false);
          return;
        }
        const targetSquare = selectBestPieceForRemoval(
          current.fen,
          current.pendingPieceRemoval.targetSide,
          current.config.variantMode,
        );
        if (targetSquare) {
          const newState = applyPieceRemoval(current, targetSquare);
          setState(newState);
        }
        setBotThinking(false);
      }, delay);
      return () => clearTimeout(timer);
    }

    let isBotTurn = false;
    if (state.mode === 'hvbot' && state.sideToMove === state.botColor) {
      isBotTurn = true;
    } else if (state.mode === 'botvbot') {
      isBotTurn = true;
    }

    if (!isBotTurn) return;

    setBotThinking(true);
    const delay = state.mode === 'botvbot' ? moveDelayRef.current : 400;
    const timer = setTimeout(() => {
      const current = stateRef.current;
      if (current.result) {
        setBotThinking(false);
        return;
      }
      const activeBotLevel = current.sideToMove === 'w' ? current.botLevelWhite : current.botLevelBlack;
      // Bot reports the human's violation before making its own move
      if (
        canReport(current, current.sideToMove) &&
        shouldBotReport(activeBotLevel, current.pendingViolation!)
      ) {
        setState(reportViolation(current, current.sideToMove));
        setBotThinking(false);
        return;
      }
      // Crazyhouse: bot tries a drop move first
      if (current.crazyhouse) {
        const dropMove = selectBotDropMove(
          current.fen,
          activeBotLevel,
          current.crazyhouse,
          current.sideToMove,
          current.config,
        );
        if (dropMove) {
          let stateBeforeDrop = current;
          if (current.clocks && clockCommittedRef.current && clockActiveRef.current) {
            const now = Date.now();
            const elapsed = now - clockActiveRef.current;
            const key = current.sideToMove === 'w' ? 'whiteMs' : 'blackMs';
            const remaining = Math.max(0, clockCommittedRef.current[key] - elapsed);
            if (remaining <= 0) {
              setState(applyTimeout(
                { ...current, clocks: { ...current.clocks, [key]: 0, lastTimestamp: now } },
                current.sideToMove,
              ));
              setBotThinking(false);
              return;
            }
            const increment = current.config.overlays.incrementMs || 0;
            const decrement = current.config.overlays.decrementMs || 0;
            stateBeforeDrop = {
              ...current,
              clocks: { ...current.clocks, [key]: Math.max(0, remaining + increment - decrement), lastTimestamp: now },
            };
          }

          const dropState = applyDropMoveWithRules(stateBeforeDrop, dropMove);
          if (dropState !== stateBeforeDrop) {
            if (dropState.clocks) {
              const ts = Date.now();
              dropState.clocks = { ...dropState.clocks, lastTimestamp: ts };
              clockActiveRef.current = ts;
              clockCommittedRef.current = { whiteMs: dropState.clocks.whiteMs, blackMs: dropState.clocks.blackMs };
            }
            setState(dropState);
            setBotThinking(false);
            return;
          }
        }
      }

      const botMove = selectBotMove(current.fen, activeBotLevel, current.config);
      if (botMove) {
        // Apply clock time for bot
        let stateBeforeMove = current;
        if (current.clocks && clockCommittedRef.current && clockActiveRef.current) {
          const now = Date.now();
          const elapsed = now - clockActiveRef.current;
          const key = current.sideToMove === 'w' ? 'whiteMs' : 'blackMs';
          const remaining = Math.max(0, clockCommittedRef.current[key] - elapsed);
          if (remaining <= 0) {
            setState(applyTimeout(
              { ...current, clocks: { ...current.clocks, [key]: 0, lastTimestamp: now } },
              current.sideToMove,
            ));
            setBotThinking(false);
            return;
          }
          const increment = current.config.overlays.incrementMs || 0;
          const decrement = current.config.overlays.decrementMs || 0;
          stateBeforeMove = {
            ...current,
            clocks: { ...current.clocks, [key]: Math.max(0, remaining + increment - decrement), lastTimestamp: now },
          };
        }

        const newState = applyMoveWithRules(stateBeforeMove, {
          from: botMove.from as Square,
          to: botMove.to as Square,
          promotion: botMove.promotion,
        });

        if (newState.clocks) {
          const ts = Date.now();
          newState.clocks = { ...newState.clocks, lastTimestamp: ts };
          clockActiveRef.current = ts;
          clockCommittedRef.current = { whiteMs: newState.clocks.whiteMs, blackMs: newState.clocks.blackMs };
        }

        setState(newState);
      }
      setBotThinking(false);
    }, delay);

    return () => clearTimeout(timer);
  }, [state.fen, state.sideToMove, state.result, state.mode, state.botColor, state.botLevelWhite, state.botLevelBlack, paused, state.pendingPieceRemoval]);

  return {
    state,
    makeMove,
    makeDropMove,
    getDropSquares,
    report,
    resetGame,
    canReportNow,
    legalMovesFrom,
    isPlayerTurn,
    botThinking,
    paused,
    setPaused,
    moveDelay,
    setMoveDelay,
    clockWhiteMs,
    clockBlackMs,
    selectPieceForRemoval,
    pendingPieceRemoval: !!state.pendingPieceRemoval,
    removableSquares: state.pendingPieceRemoval?.removableSquares ?? [],
    loadGameForReview,
  };
}
