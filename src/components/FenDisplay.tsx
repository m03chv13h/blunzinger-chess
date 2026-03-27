import { useState, useCallback, useRef, useEffect } from 'react';
import './FenDisplay.css';

interface FenDisplayProps {
  fen: string;
}

export function FenDisplay({ fen }: FenDisplayProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    navigator.clipboard.writeText(fen).then(
      () => {
        setCopied(true);
        timerRef.current = setTimeout(() => setCopied(false), 1500);
      },
      () => {
        /* clipboard access denied — silently ignore */
      },
    );
  }, [fen]);

  return (
    <div className="fen-display" aria-label="Current FEN">
      <label className="fen-label">FEN</label>
      <input
        className="fen-input"
        type="text"
        readOnly
        value={fen}
        onClick={(e) => (e.target as HTMLInputElement).select()}
        aria-label="FEN string"
      />
      <button
        className="fen-copy-btn"
        onClick={handleCopy}
        title="Copy FEN to clipboard"
        aria-label="Copy FEN to clipboard"
      >
        {copied ? '✓' : '📋'}
      </button>
    </div>
  );
}
