import { useState, useEffect, useRef } from 'react';
import { checkWorkerStatus } from '../services/simulationService';

export type WorkerAvailability = 'checking' | 'ready' | 'unavailable';

/**
 * Polls the simulation worker status every `intervalMs` milliseconds.
 * Returns the current availability state.
 */
export function useWorkerStatus(intervalMs = 2000): WorkerAvailability {
  const [status, setStatus] = useState<WorkerAvailability>('checking');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await checkWorkerStatus();
        if (!cancelled) {
          setStatus(res.status === 'ready' ? 'ready' : 'unavailable');
        }
      } catch {
        if (!cancelled) {
          setStatus('unavailable');
        }
      }
    };

    poll();
    intervalRef.current = setInterval(poll, intervalMs);

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [intervalMs]);

  return status;
}
