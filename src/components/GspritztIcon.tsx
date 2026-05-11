/**
 * Inline SVG icon depicting a German Spritzer glass (Henkel/handled glass)
 * with a German Blutwurst (blood sausage) in it.
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
      {/* Glass body (tall Spritzer glass) */}
      <path
        d="M18 8 L42 8 L42 52 L18 52 Z"
        fill="#ddeeff"
        stroke="#7799aa"
        strokeWidth="2"
        opacity="0.7"
      />
      {/* Spritzer liquid */}
      <path
        d="M20 18 L40 18 L40 50 L20 50 Z"
        fill="#f5e6a0"
        opacity="0.7"
      />
      {/* Handle (Henkel) */}
      <path
        d="M42 18 Q56 18 56 32 Q56 46 42 46"
        fill="none"
        stroke="#7799aa"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Glass base */}
      <rect x="16" y="52" width="28" height="4" rx="1" fill="#7799aa" />
      {/* Blutwurst slice in the glass */}
      <circle cx="30" cy="34" r="8" fill="#3b1117" stroke="#2a0b0f" strokeWidth="1" />
      <circle cx="30" cy="34" r="6.5" fill="#5c1a22" />
      {/* Fat inclusions */}
      <circle cx="27" cy="32" r="1.3" fill="#d4a88c" opacity="0.8" />
      <circle cx="33" cy="31" r="1" fill="#d4a88c" opacity="0.7" />
      <circle cx="28" cy="36" r="1" fill="#d4a88c" opacity="0.75" />
      <circle cx="33" cy="37" r="1.4" fill="#d4a88c" opacity="0.8" />
    </svg>
  );
}
