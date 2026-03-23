import { useState, useCallback, useRef, useEffect } from 'react';
import type { GameSetupConfig } from '../core/blunziger/types';
import type { GameRecord } from '../core/gameRecord';
import { getResultLabel } from '../core/gameRecord';
import { runSimulatedGame } from '../core/simulation';

export interface SimulationGameEntry {
  /** 1-based game number. */
  index: number;
  /** Current move count (updated only when finished since simulation is sync). */
  moveCount: number;
  /** Whether this game has finished. */
  finished: boolean;
  /** Result label (e.g. "White wins"), available when finished. */
  resultLabel?: string;
  /** The full game record, available when finished. */
  record?: GameRecord;
}

export interface SimulationStanding {
  whiteWins: number;
  blackWins: number;
  draws: number;
  completed: number;
  total: number;
}

export interface UseSimulationReturn {
  /** Whether the simulation is currently running. */
  running: boolean;
  /** All game entries. */
  games: SimulationGameEntry[];
  /** Current standing. */
  standing: SimulationStanding;
  /** The config used for the simulation. */
  config: GameSetupConfig | null;
  /** Start a simulation. */
  start: (config: GameSetupConfig, count: number) => void;
  /** Stop the simulation. */
  stop: () => void;
  /** All completed game records for analysis. */
  completedRecords: GameRecord[];
}

export function useSimulation(): UseSimulationReturn {
  const [running, setRunning] = useState(false);
  const [games, setGames] = useState<SimulationGameEntry[]>([]);
  const [config, setConfig] = useState<GameSetupConfig | null>(null);
  const cancelledRef = useRef(false);

  const standing: SimulationStanding = {
    whiteWins: games.filter((g) => g.record?.result.winner === 'w').length,
    blackWins: games.filter((g) => g.record?.result.winner === 'b').length,
    draws: games.filter((g) => g.record?.result.winner === 'draw').length,
    completed: games.filter((g) => g.finished).length,
    total: games.length,
  };

  const completedRecords = games
    .filter((g): g is SimulationGameEntry & { record: GameRecord } => g.finished && !!g.record)
    .map((g) => g.record);

  // Track pending simulation parameters
  const pendingRef = useRef<{ config: GameSetupConfig; count: number } | null>(null);
  const runningRef = useRef(false);

  const start = useCallback((cfg: GameSetupConfig, count: number) => {
    cancelledRef.current = false;
    setConfig(cfg);
    const initialGames: SimulationGameEntry[] = Array.from({ length: count }, (_, i) => ({
      index: i + 1,
      moveCount: 0,
      finished: false,
    }));
    setGames(initialGames);
    setRunning(true);
    pendingRef.current = { config: cfg, count };
  }, []);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    setRunning(false);
  }, []);

  // Run simulation games one at a time using setTimeout for non-blocking execution
  useEffect(() => {
    if (!running || !pendingRef.current) return;
    if (runningRef.current) return;

    const { config: simConfig, count } = pendingRef.current;
    pendingRef.current = null;
    runningRef.current = true;

    let currentGame = 0;

    const runNext = () => {
      if (cancelledRef.current || currentGame >= count) {
        runningRef.current = false;
        setRunning(false);
        return;
      }

      const gameIndex = currentGame;
      currentGame++;

      // Run the game synchronously (each game is fast for easy/medium bots)
      const record = runSimulatedGame(simConfig);

      setGames((prev) => {
        const updated = [...prev];
        updated[gameIndex] = {
          index: gameIndex + 1,
          moveCount: record.moveCount,
          finished: true,
          resultLabel: getResultLabel(record.result),
          record,
        };
        return updated;
      });

      // Yield to the browser between games so the UI can render updates
      setTimeout(runNext, 0);
    };

    // Kick off the first game on the next microtask to allow the React
    // state update (game list initialisation) to render first.
    setTimeout(runNext, 0);

    return () => {
      cancelledRef.current = true;
    };
  }, [running]);

  return {
    running,
    games,
    standing,
    config,
    start,
    stop,
    completedRecords,
  };
}
