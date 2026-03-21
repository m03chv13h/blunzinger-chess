/**
 * Inline SVG icon depicting a German Blutwurst (blood sausage) cross-section.
 * Used as a visual indicator for missed-check violations in the move list.
 */
export function BlutwurstIcon() {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 64 64"
      aria-hidden="true"
      style={{ verticalAlign: 'middle' }}
    >
      {/* Outer casing */}
      <circle cx="32" cy="32" r="30" fill="#3b1117" stroke="#2a0b0f" strokeWidth="3" />
      {/* Inner sausage body */}
      <circle cx="32" cy="32" r="27" fill="#5c1a22" />
      {/* Fat inclusions typical of blutwurst */}
      <circle cx="22" cy="24" r="4" fill="#d4a88c" opacity="0.8" />
      <circle cx="40" cy="20" r="3" fill="#d4a88c" opacity="0.7" />
      <circle cx="18" cy="38" r="3.5" fill="#d4a88c" opacity="0.75" />
      <circle cx="38" cy="40" r="4.5" fill="#d4a88c" opacity="0.8" />
      <circle cx="30" cy="34" r="2.5" fill="#d4a88c" opacity="0.6" />
      <circle cx="44" cy="32" r="2" fill="#d4a88c" opacity="0.65" />
      <circle cx="26" cy="46" r="2" fill="#d4a88c" opacity="0.6" />
      <circle cx="36" cy="28" r="1.5" fill="#d4a88c" opacity="0.5" />
    </svg>
  );
}
