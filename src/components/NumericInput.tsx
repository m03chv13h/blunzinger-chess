import { useState, useCallback } from 'react';

interface NumericInputProps {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  fallback: number;
}

/**
 * A controlled numeric input that keeps local string state while
 * the user is editing, and commits a validated number on blur.
 *
 * This avoids the common React bug where immediate parseInt coercion
 * on every keystroke prevents the user from clearing or replacing the value.
 */
export function NumericInput({
  id,
  value,
  onChange,
  min,
  max,
  fallback,
}: NumericInputProps) {
  const [raw, setRaw] = useState(String(value));
  // Track the last external value so we only sync when the prop actually changes
  const [prevValue, setPrevValue] = useState(value);

  if (value !== prevValue) {
    setPrevValue(value);
    setRaw(String(value));
  }

  const clamp = useCallback(
    (n: number) => {
      let v = n;
      if (min !== undefined) v = Math.max(min, v);
      if (max !== undefined) v = Math.min(max, v);
      return v;
    },
    [min, max],
  );

  const handleChange = useCallback(
    (text: string) => {
      setRaw(text);
      // Eagerly commit valid integers so config stays in sync.
      // Empty or non-numeric text is allowed in the field during editing
      // and will be normalised on blur.
      const parsed = parseInt(text, 10);
      if (!Number.isNaN(parsed)) {
        onChange(clamp(parsed));
      }
    },
    [onChange, clamp],
  );

  const handleBlur = useCallback(
    (text: string) => {
      const parsed = parseInt(text, 10);
      const final = Number.isNaN(parsed) ? fallback : clamp(parsed);
      setRaw(String(final));
      onChange(final);
    },
    [onChange, clamp, fallback],
  );

  return (
    <input
      id={id}
      type="number"
      min={min}
      max={max}
      value={raw}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={(e) => handleBlur(e.target.value)}
    />
  );
}
