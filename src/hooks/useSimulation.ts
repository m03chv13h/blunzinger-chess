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

/** A single simulation instance tracked by the hook. */
export interface SimulationInstance {
  id: string;
  config: GameSetupConfig;
  games: SimulationGameEntry[];
  standing: SimulationStanding;
  running: boolean;
  completedRecords: GameRecord[];
  savedRecord: SimulationRecord | null;
}

export interface UseSimulationReturn {
  /** All tracked simulation instances (running and recently completed). */
  simulations: SimulationInstance[];
  /** Whether any simulation is currently running. */
  hasRunning: boolean;
  /** Start a new simulation. Multiple can run concurrently. */
  start: (config: GameSetupConfig, count: number) => void;
  /** Stop a specific simulation by ID. */
  stop: (id: string) => void;
  /** Stop all running simulations. */
  stopAll: () => void;
  /** Remove a completed simulation from the tracked list. */
  remove: (id: string) => void;
}

/** Polling interval for checking simulation progress in connected mode. */
const POLL_INTERVAL_MS = 4000;

/** Internal mutable state per simulation (not tracked in React state). */
interface SimulationInternalState {
  cancelled: boolean;
  pollTimer: ReturnType<typeof setInterval> | null;
  backendId: string | null;
}

function computeStanding(games: SimulationGameEntry[]): SimulationStanding {
  return {
    whiteWins: games.filter((g) => g.record?.result.winner === 'w').length,
    blackWins: games.filter((g) => g.record?.result.winner === 'b').length,
    draws: games.filter((g) => g.record?.result.winner === 'draw').length,
    completed: games.filter((g) => g.finished).length,
    total: games.length,
  };
}

function computeCompletedRecords(games: SimulationGameEntry[]): GameRecord[] {
  return games
    .filter((g): g is SimulationGameEntry & { record: GameRecord } => g.finished && !!g.record)
    .map((g) => g.record);
}

let nextLocalId = 0;

export function useSimulation(): UseSimulationReturn {
  const [instances, setInstances] = useState<SimulationInstance[]>([]);
  const internalStateRef = useRef<Map<string, SimulationInternalState>>(new Map());

  const updateInstance = useCallback(
    (id: string, updater: (inst: SimulationInstance) => SimulationInstance) => {
      setInstances((prev) => prev.map((inst) => (inst.id === id ? updater(inst) : inst)));
    },
    [],
  );

  const start = useCallback(
    (cfg: GameSetupConfig, count: number) => {
      const localId = `sim-${++nextLocalId}-${Date.now()}`;

      const initialGames: SimulationGameEntry[] = Array.from({ length: count }, (_, i) => ({
        index: i + 1,
        moveCount: 0,
        finished: false,
      }));

      const newInstance: SimulationInstance = {
        id: localId,
        config: cfg,
        games: initialGames,
        standing: computeStanding(initialGames),
        running: true,
        completedRecords: [],
        savedRecord: null,
      };

      setInstances((prev) => [newInstance, ...prev]);

      const state: SimulationInternalState = {
        cancelled: false,
        pollTimer: null,
        backendId: null,
      };
      internalStateRef.current.set(localId, state);

      if (isConnectedMode) {
        // Enqueue the batch on the backend and poll for progress.
        runBatchSimulationRemote(cfg, count)
          .then(({ id }) => {
            if (state.cancelled) return;
            state.backendId = id;

            const poll = async () => {
              if (state.cancelled || !state.backendId) return;

              try {
                const status = await getSimulationStatus(state.backendId);
                if (state.cancelled) return;

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

                updateInstance(localId, (inst) => ({
                  ...inst,
                  games: updatedGames,
                  standing: computeStanding(updatedGames),
                  completedRecords: computeCompletedRecords(updatedGames),
                }));

                if (status.status === 'completed' || status.status === 'abandoned') {
                  const simRecord: SimulationRecord = {
                    id: status.id,
                    completedAt: status.completedAt ?? Date.now(),
                    config: status.config,
                    games: status.games,
                    standing: status.standing,
                  };
                  updateInstance(localId, (inst) => ({
                    ...inst,
                    running: false,
                    savedRecord: simRecord,
                  }));
                  if (state.pollTimer) {
                    clearInterval(state.pollTimer);
                    state.pollTimer = null;
                  }
                  internalStateRef.current.delete(localId);
                }
              } catch {
                // Polling errors are non-fatal; retry on next interval
              }
            };

            poll();
            state.pollTimer = setInterval(poll, POLL_INTERVAL_MS);
          })
          .catch(() => {
            if (state.cancelled) return;
            // Fall back to local simulation if the backend call fails
            const records: GameRecord[] = [];
            for (let i = 0; i < count; i++) {
              if (state.cancelled) break;
              records.push(runSimulatedGame(cfg));
            }
            const finishedGames: SimulationGameEntry[] = records.map((record, i) => ({
              index: i + 1,
              moveCount: record.moveCount,
              finished: true,
              resultLabel: getResultLabel(record.result),
              record,
            }));
            updateInstance(localId, (inst) => ({
              ...inst,
              games: finishedGames,
              standing: computeStanding(finishedGames),
              completedRecords: computeCompletedRecords(finishedGames),
              running: false,
            }));
            internalStateRef.current.delete(localId);
          });
      } else {
        // Static mode: run games locally one at a time
        let currentGame = 0;

        const runNext = () => {
          if (state.cancelled || currentGame >= count) {
            updateInstance(localId, (inst) => ({ ...inst, running: false }));
            internalStateRef.current.delete(localId);
            return;
          }

          const gameIndex = currentGame;
          currentGame++;

          const record = runSimulatedGame(cfg);

          updateInstance(localId, (inst) => {
            const updated = [...inst.games];
            updated[gameIndex] = {
              index: gameIndex + 1,
              moveCount: record.moveCount,
              finished: true,
              resultLabel: getResultLabel(record.result),
              record,
            };
            return {
              ...inst,
              games: updated,
              standing: computeStanding(updated),
              completedRecords: computeCompletedRecords(updated),
            };
          });

          setTimeout(runNext, 0);
        };

        setTimeout(runNext, 0);
      }
    },
    [updateInstance],
  );

  const stop = useCallback(
    (id: string) => {
      const state = internalStateRef.current.get(id);
      if (state) {
        state.cancelled = true;
        if (state.pollTimer) {
          clearInterval(state.pollTimer);
          state.pollTimer = null;
        }
        internalStateRef.current.delete(id);
      }
      updateInstance(id, (inst) => ({ ...inst, running: false }));
    },
    [updateInstance],
  );

  const stopAll = useCallback(() => {
    for (const [, state] of internalStateRef.current) {
      state.cancelled = true;
      if (state.pollTimer) {
        clearInterval(state.pollTimer);
        state.pollTimer = null;
      }
    }
    internalStateRef.current.clear();
    setInstances((prev) => prev.map((inst) => ({ ...inst, running: false })));
  }, []);

  const remove = useCallback((id: string) => {
    const state = internalStateRef.current.get(id);
    if (state) {
      state.cancelled = true;
      if (state.pollTimer) {
        clearInterval(state.pollTimer);
        state.pollTimer = null;
      }
      internalStateRef.current.delete(id);
    }
    setInstances((prev) => prev.filter((inst) => inst.id !== id));
  }, []);

  // Cleanup all timers on unmount
  useEffect(() => {
    const stateMap = internalStateRef.current;
    return () => {
      for (const [, state] of stateMap) {
        state.cancelled = true;
        if (state.pollTimer) {
          clearInterval(state.pollTimer);
        }
      }
      stateMap.clear();
    };
  }, []);

  const hasRunning = instances.some((inst) => inst.running);

  return { simulations: instances, hasRunning, start, stop, stopAll, remove };
}
