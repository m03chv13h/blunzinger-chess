/** Format milliseconds as "MM:SS". */
export function formatMsToTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Parse a time string into milliseconds.
 * Accepted formats:
 *   - "M:SS" or "MM:SS" (e.g. "5:00", "03:12")
 *   - Plain number interpreted as minutes (e.g. "5" → 5:00)
 * Returns NaN for unparseable input.
 */
export function parseTimeToMs(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return NaN;

  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    if (parts.length !== 2) return NaN;
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    if (Number.isNaN(minutes) || Number.isNaN(seconds)) return NaN;
    if (seconds < 0 || seconds > 59) return NaN;
    if (minutes < 0) return NaN;
    return (minutes * 60 + seconds) * 1000;
  }

  // Plain number → minutes
  const minutes = parseInt(trimmed, 10);
  if (Number.isNaN(minutes)) return NaN;
  return minutes * 60 * 1000;
}
