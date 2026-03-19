import { useState, useCallback, useRef, useEffect } from 'react';
import type { Color, GameState, GameMode, BotLevel, BlunzigerConfig, Square } from '../core/blunziger/types';
import { DEFAULT_CONFIG } from '../core/blunziger/types';
import {
  createInitialState,
  applyMoveWithRules,
  canReport,
  reportViolation,
  getLegalMoves,
} from '../core/blunziger/engine';
import { selectBotMove } from '../bot/botEngine';

export interface UseGameReturn {
  state: GameState;
  makeMove: (from: Square, to: Square, promotion?: string) => boolean;
  report: () => void;
  resetGame: (mode?: GameMode, config?: BlunzigerConfig, botLevel?: BotLevel, botColor?: Color) => void;
  canReportNow: boolean;
  legalMovesFrom: (square: Square) => Square[];
  isPlayerTurn: boolean;
  botThinking: boolean;
  paused: boolean;
  setPaused: (p: boolean) => void;
  moveDelay: number;
  setMoveDelay: (d: number) => void;
}

export function useGame(
  initialMode: GameMode = 'hvh',
  initialConfig: BlunzigerConfig = DEFAULT_CONFIG,
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

  const makeMove = useCallback(
    (from: Square, to: Square, promotion?: string): boolean => {
      const current = stateRef.current;
      if (current.result) return false;

      const newState = applyMoveWithRules(current, { from, to, promotion });
      if (newState === current) return false; // move was invalid

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
      config?: BlunzigerConfig,
      botLevel?: BotLevel,
      botColor?: Color,
    ) => {
      setState(
        createInitialState(
          mode ?? stateRef.current.mode,
          config ?? stateRef.current.config,
          botLevel ?? stateRef.current.botLevel,
          botColor ?? stateRef.current.botColor,
        ),
      );
      setBotThinking(false);
    },
    [],
  );

  const canReportNow = canReport(state, state.sideToMove);

  const legalMovesFrom = useCallback(
    (square: Square): Square[] => {
      const moves = getLegalMoves(stateRef.current.fen);
      return moves.filter((m) => m.from === square).map((m) => m.to as Square);
    },
    [state.fen],
  );

  // Determine if it's a human's turn
  const isPlayerTurn = (() => {
    if (state.result) return false;
    if (state.mode === 'hvh') return true;
    if (state.mode === 'hvbot') return state.sideToMove !== state.botColor;
    return false; // botvbot - never player turn
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
      const botMove = selectBotMove(current.fen, current.botLevel);
      if (botMove) {
        const newState = applyMoveWithRules(current, {
          from: botMove.from as Square,
          to: botMove.to as Square,
          promotion: botMove.promotion,
        });
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
  };
}
