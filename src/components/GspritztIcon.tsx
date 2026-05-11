/**
 * Inline SVG icon depicting a wine glass with a German Blutwurst (blood sausage) in it.
 * Used as a visual indicator for Blunzinger G'spritzt reports in the move list.
 */
export function GspritztIcon() {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 64 64"
      aria-hidden="true"
      style={{ verticalAlign: 'middle' }}
    >
      {/* Wine glass bowl */}
      <path
        d="M16 8 L48 8 L40 30 Q38 36 32 38 Q26 36 24 30 Z"
        fill="#e8d4e8"
        stroke="#8B668B"
        strokeWidth="2"
        opacity="0.7"
      />
      {/* Wine liquid */}
      <path
        d="M20 16 L44 16 L40 30 Q38 36 32 38 Q26 36 24 30 Z"
        fill="#722F37"
        opacity="0.8"
      />
      {/* Glass stem */}
      <rect x="30" y="38" width="4" height="14" fill="#8B668B" />
      {/* Glass base */}
      <ellipse cx="32" cy="54" rx="10" ry="3" fill="#8B668B" />
      {/* Blutwurst slice in the glass */}
      <circle cx="32" cy="26" r="7" fill="#3b1117" stroke="#2a0b0f" strokeWidth="1" />
      <circle cx="32" cy="26" r="5.5" fill="#5c1a22" />
      {/* Fat inclusions */}
      <circle cx="29" cy="24" r="1.2" fill="#d4a88c" opacity="0.8" />
      <circle cx="35" cy="23" r="1" fill="#d4a88c" opacity="0.7" />
      <circle cx="30" cy="28" r="1" fill="#d4a88c" opacity="0.75" />
      <circle cx="34" cy="28" r="1.3" fill="#d4a88c" opacity="0.8" />
    </svg>
  );
}
