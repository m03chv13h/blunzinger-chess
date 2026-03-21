import { useState, useRef, useCallback } from 'react';
import { formatMsToTime, parseTimeToMs } from '../utils/timeFormat';

interface TimeInputProps {
  id?: string;
  /** Current value in milliseconds */
  valueMs: number;
  /** Called with validated value in milliseconds */
  onChange: (ms: number) => void;
  /** Minimum value in seconds */
  minSeconds?: number;
  /** Maximum value in seconds */
  maxSeconds?: number;
  /** Fallback value in milliseconds (used when input is invalid on blur) */
  fallbackMs: number;
}

/**
 * A time input (MM:SS) that keeps local string state while the user
 * is editing, and commits a validated millisecond value on blur.
 */
export function TimeInput({
  id,
  valueMs,
  onChange,
  minSeconds,
  maxSeconds,
  fallbackMs,
}: TimeInputProps) {
  const [raw, setRaw] = useState(formatMsToTime(valueMs));
  const prevValueRef = useRef(valueMs);

  if (valueMs !== prevValueRef.current) {
    prevValueRef.current = valueMs;
    setRaw(formatMsToTime(valueMs));
  }

  const clampMs = useCallback(
    (ms: number) => {
      let v = ms;
      if (minSeconds !== undefined) v = Math.max(minSeconds * 1000, v);
      if (maxSeconds !== undefined) v = Math.min(maxSeconds * 1000, v);
      return v;
    },
    [minSeconds, maxSeconds],
  );

  const handleChange = useCallback(
    (text: string) => {
      setRaw(text);
      const parsed = parseTimeToMs(text);
      if (!Number.isNaN(parsed)) {
        onChange(clampMs(parsed));
      }
    },
    [onChange, clampMs],
  );

  const handleBlur = useCallback(
    (text: string) => {
      const parsed = parseTimeToMs(text);
      const finalMs = Number.isNaN(parsed) ? fallbackMs : clampMs(parsed);
      setRaw(formatMsToTime(finalMs));
      onChange(finalMs);
    },
    [onChange, clampMs, fallbackMs],
  );

  return (
    <input
      id={id}
      type="text"
      placeholder="M:SS"
      value={raw}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={(e) => handleBlur(e.target.value)}
    />
  );
}
