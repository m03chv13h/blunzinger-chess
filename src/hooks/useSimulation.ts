import { useState, useCallback, useRef, useEffect } from 'react';
import type { GameSetupConfig } from '../core/blunziger/types';
import type { GameRecord, SimulationRecord } from '../core/gameRecord';
import { getResultLabel } from '../core/gameRecord';
import { runSimulatedGame } from '../core/simulation';
import { isConnectedMode } from '../config/deployMode';
import { runBatchSimulationRemote, getSimulationStatus } from '../services/simulationService';

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
  /** The saved SimulationRecord returned by the backend (connected mode only). */
  savedSimulationRecord: SimulationRecord | null;
}

/** Polling interval for checking simulation progress in connected mode. */
const POLL_INTERVAL_MS = 4000;

export function useSimulation(): UseSimulationReturn {
  const [running, setRunning] = useState(false);
  const [games, setGames] = useState<SimulationGameEntry[]>([]);
  const [config, setConfig] = useState<GameSetupConfig | null>(null);
  const [savedSimulationRecord, setSavedSimulationRecord] = useState<SimulationRecord | null>(null);
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

  // Track active simulation ID for polling in connected mode
  const simulationIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback((cfg: GameSetupConfig, count: number) => {
    cancelledRef.current = false;
    simulationIdRef.current = null;
    setConfig(cfg);
    setSavedSimulationRecord(null);
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
    simulationIdRef.current = null;
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setRunning(false);
  }, []);

  // Run simulation games.
  // In connected mode, enqueue the batch on the backend and poll for progress.
  // In static mode, games run locally one at a time.
  useEffect(() => {
    if (!running || !pendingRef.current) return;
    if (runningRef.current) return;

    const { config: simConfig, count } = pendingRef.current;
    pendingRef.current = null;
    runningRef.current = true;

    if (isConnectedMode) {
      // Enqueue the batch on the backend and poll for progress.
      const startBatch = async () => {
        try {
          const { id } = await runBatchSimulationRemote(simConfig, count);
          if (cancelledRef.current) {
            runningRef.current = false;
            return;
          }
          simulationIdRef.current = id;

          // Start polling every 4 seconds for simulation progress
          const poll = async () => {
            if (cancelledRef.current || !simulationIdRef.current) return;

            try {
              const status = await getSimulationStatus(simulationIdRef.current);
              if (cancelledRef.current) return;

              // Update game entries from the returned records
              const updatedGames: SimulationGameEntry[] = Array.from(
                { length: count },
                (_, i) => {
                  const record = status.games[i];
                  if (record) {
                    return {
                      index: i + 1,
                      moveCount: record.moveCount,
                      finished: true,
                      resultLabel: getResultLabel(record.result),
                      record,
                    };
                  }
                  return { index: i + 1, moveCount: 0, finished: false };
                },
              );
              setGames(updatedGames);

              if (status.status === 'completed') {
                // Simulation done — build the SimulationRecord
                const simRecord: SimulationRecord = {
                  id: status.id,
                  completedAt: status.completedAt ?? Date.now(),
                  config: status.config,
                  games: status.games,
                  standing: status.standing,
                };
                setSavedSimulationRecord(simRecord);
                simulationIdRef.current = null;
                if (pollTimerRef.current) {
                  clearInterval(pollTimerRef.current);
                  pollTimerRef.current = null;
                }
                runningRef.current = false;
                setRunning(false);
              }
            } catch {
              // Polling errors are non-fatal; retry on next interval
            }
          };

          // Poll immediately, then every 4 seconds
          poll();
          pollTimerRef.current = setInterval(poll, POLL_INTERVAL_MS);
        } catch {
          if (cancelledRef.current) {
            runningRef.current = false;
            return;
          }
          // Fall back to local simulation if the backend call fails
          const records: GameRecord[] = [];
          for (let i = 0; i < count; i++) {
            if (cancelledRef.current) break;
            records.push(runSimulatedGame(simConfig));
          }
          const finishedGames: SimulationGameEntry[] = records.map((record, i) => ({
            index: i + 1,
            moveCount: record.moveCount,
            finished: true,
            resultLabel: getResultLabel(record.result),
            record,
          }));
          setGames(finishedGames);
          runningRef.current = false;
          setRunning(false);
        }
      };
      startBatch();
    } else {
      // Static mode: run games locally one at a time
      let currentGame = 0;

      const completeGame = (gameIndex: number, record: GameRecord) => {
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
      };

      const runNext = () => {
        if (cancelledRef.current || currentGame >= count) {
          runningRef.current = false;
          setRunning(false);
          return;
        }

        const gameIndex = currentGame;
        currentGame++;

        const record = runSimulatedGame(simConfig);
        completeGame(gameIndex, record);

        // Yield to the browser between games via setTimeout chaining
        // so the UI can render updates between synchronous game runs.
        setTimeout(runNext, 0);
      };

      // Kick off the first game on the next microtask
      setTimeout(runNext, 0);
    }

    return () => {
      cancelledRef.current = true;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
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
    savedSimulationRecord,
  };
}
