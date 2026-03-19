import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  Color,
  GameState,
  GameMode,
  BotLevel,
  VariantConfig,
  Square,
  VariantModeId,
} from '../core/blunziger/types';
import { DEFAULT_CONFIG } from '../core/blunziger/types';
import {
  createInitialState,
  applyMoveWithRules,
  canReport,
  reportViolation,
  getLegalMoves,
  applyTimeout,
} from '../core/blunziger/engine';
import { selectBotMove } from '../bot/botEngine';

export interface UseGameReturn {
  state: GameState;
  makeMove: (from: Square, to: Square, promotion?: string) => boolean;
  report: () => void;
  resetGame: (
    mode?: GameMode,
    config?: VariantConfig,
    botLevel?: BotLevel,
    botColor?: Color,
    variantModeId?: VariantModeId,
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
}

export function useGame(
  initialMode: GameMode = 'hvh',
  initialConfig: VariantConfig = DEFAULT_CONFIG,
  initialBotLevel: BotLevel = 'easy',
  initialBotColor: Color = 'b',
  initialVariantModeId: VariantModeId = 'classic_blunziger',
): UseGameReturn {
  const [state, setState] = useState<GameState>(() =>
    createInitialState(initialMode, initialConfig, initialBotLevel, initialBotColor, initialVariantModeId),
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
    initialConfig.enableClock ? initialConfig.initialTimeMs : 0,
  );
  const [clockBlackMs, setClockBlackMs] = useState(
    initialConfig.enableClock ? initialConfig.initialTimeMs : 0,
  );
  const clockActiveRef = useRef<number | null>(null); // timestamp of last tick

  // Sync display clocks from state whenever state.clocks changes
  useEffect(() => {
    if (state.clocks) {
      setClockWhiteMs(state.clocks.whiteMs);
      setClockBlackMs(state.clocks.blackMs);
      clockActiveRef.current = state.clocks.lastTimestamp;
    }
  }, [state.clocks]);

  // Clock tick interval
  useEffect(() => {
    const cfg = stateRef.current.config;
    if (!cfg.enableClock) return;

    const iv = setInterval(() => {
      const cur = stateRef.current;
      if (cur.result || !cur.clocks) return;
      if (pausedRef.current && cur.mode === 'botvbot') return;

      const now = Date.now();
      const elapsed = clockActiveRef.current ? now - clockActiveRef.current : 0;
      clockActiveRef.current = now;

      if (cur.sideToMove === 'w') {
        const remaining = Math.max(0, cur.clocks.whiteMs - elapsed);
        setClockWhiteMs(remaining);
        if (remaining <= 0) {
          setState((prev) => {
            if (prev.result) return prev;
            return applyTimeout(
              { ...prev, clocks: { ...prev.clocks!, whiteMs: 0, lastTimestamp: now } },
              'w',
            );
          });
        } else {
          // Update clocks in state silently (no re-render cascade)
          stateRef.current = {
            ...cur,
            clocks: { ...cur.clocks, whiteMs: remaining, lastTimestamp: now },
          };
        }
      } else {
        const remaining = Math.max(0, cur.clocks.blackMs - elapsed);
        setClockBlackMs(remaining);
        if (remaining <= 0) {
          setState((prev) => {
            if (prev.result) return prev;
            return applyTimeout(
              { ...prev, clocks: { ...prev.clocks!, blackMs: 0, lastTimestamp: now } },
              'b',
            );
          });
        } else {
          stateRef.current = {
            ...cur,
            clocks: { ...cur.clocks, blackMs: remaining, lastTimestamp: now },
          };
        }
      }
    }, 100);

    return () => clearInterval(iv);
  }, [state.config.enableClock, state.result]);

  // ── Move handling ──────────────────────────────────────────────────

  const makeMove = useCallback(
    (from: Square, to: Square, promotion?: string): boolean => {
      const current = stateRef.current;
      if (current.result) return false;

      // Apply clock time before move
      let stateBeforeMove = current;
      if (current.clocks && clockActiveRef.current) {
        const now = Date.now();
        const elapsed = now - clockActiveRef.current;
        const key = current.sideToMove === 'w' ? 'whiteMs' : 'blackMs';
        const remaining = Math.max(0, current.clocks[key] - elapsed);
        if (remaining <= 0) {
          const timeoutState = applyTimeout(
            { ...current, clocks: { ...current.clocks, [key]: 0, lastTimestamp: now } },
            current.sideToMove,
          );
          setState(timeoutState);
          return false;
        }
        const increment = current.config.incrementMs || 0;
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

      // Reset clock timestamp for the new side
      if (newState.clocks) {
        newState.clocks = { ...newState.clocks, lastTimestamp: Date.now() };
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

  const resetGame = useCallback(
    (
      mode?: GameMode,
      config?: VariantConfig,
      botLevel?: BotLevel,
      botColor?: Color,
      variantModeId?: VariantModeId,
    ) => {
      const newState = createInitialState(
        mode ?? stateRef.current.mode,
        config ?? stateRef.current.config,
        botLevel ?? stateRef.current.botLevel,
        botColor ?? stateRef.current.botColor,
        variantModeId ?? stateRef.current.variantModeId,
      );
      setState(newState);
      setBotThinking(false);
      clockActiveRef.current = newState.clocks ? Date.now() : null;
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
    if (state.mode === 'hvh') return true;
    if (state.mode === 'hvbot') return state.sideToMove !== state.botColor;
    return false;
  })();

  // Bot move effect
  useEffect(() => {
    if (state.result) return;
    if (pausedRef.current && state.mode === 'botvbot') return;

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
      const botMove = selectBotMove(current.fen, current.botLevel, current.config);
      if (botMove) {
        // Apply clock time for bot
        let stateBeforeMove = current;
        if (current.clocks && clockActiveRef.current) {
          const now = Date.now();
          const elapsed = now - clockActiveRef.current;
          const key = current.sideToMove === 'w' ? 'whiteMs' : 'blackMs';
          const remaining = Math.max(0, current.clocks[key] - elapsed);
          if (remaining <= 0) {
            setState(applyTimeout(
              { ...current, clocks: { ...current.clocks, [key]: 0, lastTimestamp: now } },
              current.sideToMove,
            ));
            setBotThinking(false);
            return;
          }
          const increment = current.config.incrementMs || 0;
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
          newState.clocks = { ...newState.clocks, lastTimestamp: Date.now() };
        }

        setState(newState);
      }
      setBotThinking(false);
    }, delay);

    return () => clearTimeout(timer);
  }, [state.fen, state.result, state.mode, state.botColor, state.botLevel, paused]);

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
  };
}
