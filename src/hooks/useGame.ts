import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  Color,
  GameState,
  GameMode,
  BotLevel,
  MatchConfig,
  Square,
} from '../core/blunziger/types';
import { DEFAULT_CONFIG } from '../core/blunziger/types';
import {
  createInitialState,
  applyMoveWithRules,
  canReport,
  reportViolation,
  getLegalMoves,
  applyTimeout,
  applyPieceRemoval,
  selectBestPieceForRemoval,
} from '../core/blunziger/engine';
import { selectBotMove } from '../bot/botEngine';

export interface UseGameReturn {
  state: GameState;
  makeMove: (from: Square, to: Square, promotion?: string) => boolean;
  report: () => void;
  resetGame: (
    mode?: GameMode,
    config?: MatchConfig,
    botLevel?: BotLevel,
    botColor?: Color,
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
}

export function useGame(
  initialMode: GameMode = 'hvh',
  initialConfig: MatchConfig = DEFAULT_CONFIG,
  initialBotLevel: BotLevel = 'easy',
  initialBotColor: Color = 'b',
): UseGameReturn {
  const [state, setState] = useState<GameState>(() =>
    createInitialState(initialMode, initialConfig, initialBotLevel, initialBotColor),
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
        stateBeforeMove = {
          ...current,
          clocks: {
            ...current.clocks,
            [key]: remaining + increment,
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
    ) => {
      const newState = createInitialState(
        mode ?? stateRef.current.mode,
        config ?? stateRef.current.config,
        botLevel ?? stateRef.current.botLevel,
        botColor ?? stateRef.current.botColor,
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
      // Bot reports the human's violation before making its own move
      if (canReport(current, current.sideToMove)) {
        setState(reportViolation(current, current.sideToMove));
        setBotThinking(false);
        return;
      }
      const botMove = selectBotMove(current.fen, current.botLevel, current.config);
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
          stateBeforeMove = {
            ...current,
            clocks: { ...current.clocks, [key]: remaining + increment, lastTimestamp: now },
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
  }, [state.fen, state.result, state.mode, state.botColor, state.botLevel, paused, state.pendingPieceRemoval]);

  return {
    state,
    makeMove,
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
  };
}
