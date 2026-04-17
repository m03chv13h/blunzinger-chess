interface SausageAvatarProps {
  size?: string;
}

const defaultSize = '1em';

/** Krakauer – a smoked, reddish-brown sausage with speckled seasoning. */
export function KrakauerAvatar({ size = defaultSize }: SausageAvatarProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {/* Casing */}
      <ellipse cx="32" cy="32" rx="28" ry="18" fill="#8b3a1a" stroke="#5e2510" strokeWidth="2" />
      {/* Body */}
      <ellipse cx="32" cy="32" rx="25" ry="15" fill="#a0452a" />
      {/* Smoky shading */}
      <ellipse cx="32" cy="28" rx="20" ry="10" fill="#b85636" opacity="0.6" />
      {/* Spice specks */}
      <circle cx="20" cy="30" r="1.5" fill="#2b0e04" opacity="0.7" />
      <circle cx="28" cy="26" r="1" fill="#2b0e04" opacity="0.6" />
      <circle cx="38" cy="34" r="1.5" fill="#2b0e04" opacity="0.7" />
      <circle cx="42" cy="28" r="1" fill="#2b0e04" opacity="0.5" />
      <circle cx="24" cy="36" r="1.2" fill="#2b0e04" opacity="0.6" />
      <circle cx="35" cy="30" r="0.8" fill="#2b0e04" opacity="0.5" />
      {/* End caps */}
      <ellipse cx="5" cy="32" rx="3" ry="12" fill="#6e2e14" />
      <ellipse cx="59" cy="32" rx="3" ry="12" fill="#6e2e14" />
    </svg>
  );
}

/** Blunze (Blunzenwurst) – dark blood sausage cross-section with fat inclusions. */
export function BlunzeAvatar({ size = defaultSize }: SausageAvatarProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {/* Outer casing */}
      <circle cx="32" cy="32" r="30" fill="#2e0a0e" stroke="#1a0508" strokeWidth="3" />
      {/* Inner body */}
      <circle cx="32" cy="32" r="27" fill="#441218" />
      {/* Blood-red marbling */}
      <circle cx="32" cy="32" r="22" fill="#551a22" opacity="0.7" />
      {/* Fat/grain inclusions */}
      <circle cx="20" cy="24" r="4.5" fill="#c8a080" opacity="0.8" />
      <circle cx="40" cy="22" r="3.5" fill="#c8a080" opacity="0.75" />
      <circle cx="16" cy="38" r="3" fill="#c8a080" opacity="0.7" />
      <circle cx="38" cy="40" r="5" fill="#c8a080" opacity="0.8" />
      <circle cx="28" cy="36" r="2.5" fill="#c8a080" opacity="0.65" />
      <circle cx="44" cy="32" r="2" fill="#c8a080" opacity="0.6" />
      <circle cx="24" cy="44" r="2" fill="#c8a080" opacity="0.6" />
      <circle cx="32" cy="20" r="1.8" fill="#c8a080" opacity="0.55" />
    </svg>
  );
}

/** Käsekrainer – grilled sausage with melted cheese bursting through. */
export function KaesekrainerAvatar({ size = defaultSize }: SausageAvatarProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {/* Sausage body */}
      <ellipse cx="32" cy="32" rx="28" ry="17" fill="#8b4513" stroke="#6b3410" strokeWidth="2" />
      {/* Grilled surface */}
      <ellipse cx="32" cy="30" rx="24" ry="13" fill="#a0522d" />
      {/* Grill marks */}
      <line x1="14" y1="26" x2="50" y2="26" stroke="#6b3410" strokeWidth="1.5" opacity="0.4" />
      <line x1="12" y1="32" x2="52" y2="32" stroke="#6b3410" strokeWidth="1.5" opacity="0.4" />
      <line x1="14" y1="38" x2="50" y2="38" stroke="#6b3410" strokeWidth="1.5" opacity="0.4" />
      {/* Melted cheese oozing out */}
      <ellipse cx="25" cy="30" rx="5" ry="4" fill="#f0c040" opacity="0.9" />
      <ellipse cx="40" cy="33" rx="4" ry="3.5" fill="#f0c040" opacity="0.85" />
      <ellipse cx="32" cy="28" rx="3" ry="2.5" fill="#f5d060" opacity="0.7" />
      <circle cx="22" cy="35" r="2" fill="#f0c040" opacity="0.6" />
    </svg>
  );
}

/** Eitrige – Viennese-style cheese sausage with split casing showing cheese. */
export function EitrigeAvatar({ size = defaultSize }: SausageAvatarProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {/* Sausage body */}
      <ellipse cx="32" cy="32" rx="28" ry="16" fill="#9b5523" stroke="#7a4018" strokeWidth="2" />
      {/* Inner meat */}
      <ellipse cx="32" cy="31" rx="24" ry="12" fill="#b06030" />
      {/* Split in casing */}
      <path d="M18 30 Q32 22 46 30" fill="none" stroke="#6b3410" strokeWidth="1.5" />
      {/* Cheese oozing from split */}
      <path d="M20 29 Q32 20 44 29 Q38 26 32 28 Q26 26 20 29Z" fill="#f5d060" opacity="0.9" />
      <ellipse cx="32" cy="25" rx="8" ry="3" fill="#f0c040" opacity="0.8" />
      {/* Cheese drip */}
      <ellipse cx="28" cy="36" rx="2.5" ry="2" fill="#f0c040" opacity="0.6" />
      <ellipse cx="38" cy="35" rx="2" ry="1.5" fill="#f0c040" opacity="0.5" />
    </svg>
  );
}

/** Currywurst – sliced sausage pieces with curry-ketchup sauce drizzled on top. */
export function CurrywurstAvatar({ size = defaultSize }: SausageAvatarProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {/* Sliced sausage pieces */}
      <ellipse cx="18" cy="38" rx="10" ry="7" fill="#8b4020" stroke="#6b3010" strokeWidth="1.5" />
      <ellipse cx="32" cy="36" rx="10" ry="7" fill="#8b4020" stroke="#6b3010" strokeWidth="1.5" />
      <ellipse cx="46" cy="38" rx="10" ry="7" fill="#8b4020" stroke="#6b3010" strokeWidth="1.5" />
      {/* Inner meat visible */}
      <ellipse cx="18" cy="37" rx="7" ry="4.5" fill="#a85535" />
      <ellipse cx="32" cy="35" rx="7" ry="4.5" fill="#a85535" />
      <ellipse cx="46" cy="37" rx="7" ry="4.5" fill="#a85535" />
      {/* Curry-ketchup sauce */}
      <path d="M8 30 Q18 26 28 30 Q38 26 48 30 Q54 28 58 30" fill="none" stroke="#cc3300" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
      <path d="M10 25 Q20 22 30 26 Q40 22 50 25" fill="none" stroke="#cc3300" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      {/* Curry powder specks */}
      <circle cx="16" cy="28" r="1.2" fill="#e8a000" opacity="0.8" />
      <circle cx="26" cy="26" r="1" fill="#e8a000" opacity="0.7" />
      <circle cx="36" cy="28" r="1.2" fill="#e8a000" opacity="0.8" />
      <circle cx="44" cy="26" r="1" fill="#e8a000" opacity="0.7" />
      <circle cx="22" cy="24" r="0.8" fill="#e8a000" opacity="0.6" />
    </svg>
  );
}

/** Depreziner (Debreziner) – spicy red paprika sausage, slender and bright. */
export function DeprezinerAvatar({ size = defaultSize }: SausageAvatarProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {/* Sausage body – bright paprika red */}
      <ellipse cx="32" cy="32" rx="28" ry="14" fill="#c0392b" stroke="#962d22" strokeWidth="2" />
      {/* Highlight sheen */}
      <ellipse cx="32" cy="28" rx="22" ry="8" fill="#d94f42" opacity="0.6" />
      {/* Paprika specks */}
      <circle cx="18" cy="30" r="1.2" fill="#7b241c" opacity="0.6" />
      <circle cx="28" cy="28" r="0.8" fill="#7b241c" opacity="0.5" />
      <circle cx="40" cy="32" r="1" fill="#7b241c" opacity="0.6" />
      <circle cx="46" cy="29" r="0.8" fill="#7b241c" opacity="0.5" />
      <circle cx="24" cy="35" r="1" fill="#7b241c" opacity="0.5" />
      {/* End twist */}
      <ellipse cx="5" cy="32" rx="3" ry="10" fill="#a63125" />
      <ellipse cx="59" cy="32" rx="3" ry="10" fill="#a63125" />
    </svg>
  );
}

/** Bratwurst – golden-brown grilled sausage with char marks. */
export function BratwurstAvatar({ size = defaultSize }: SausageAvatarProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {/* Sausage body */}
      <ellipse cx="32" cy="32" rx="28" ry="16" fill="#c8943c" stroke="#a07030" strokeWidth="2" />
      {/* Golden surface */}
      <ellipse cx="32" cy="30" rx="24" ry="12" fill="#daa855" />
      {/* Char marks from grill */}
      <line x1="14" y1="27" x2="50" y2="27" stroke="#8b6020" strokeWidth="2" opacity="0.35" strokeLinecap="round" />
      <line x1="12" y1="33" x2="52" y2="33" stroke="#8b6020" strokeWidth="2" opacity="0.35" strokeLinecap="round" />
      <line x1="14" y1="39" x2="50" y2="39" stroke="#8b6020" strokeWidth="2" opacity="0.35" strokeLinecap="round" />
      {/* Shine highlight */}
      <ellipse cx="30" cy="26" rx="12" ry="4" fill="#e8c070" opacity="0.5" />
    </svg>
  );
}

/** Fleischwurst – smooth, pink bologna-style ring sausage. */
export function FleischwurstAvatar({ size = defaultSize }: SausageAvatarProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {/* Ring shape – outer */}
      <circle cx="32" cy="32" r="28" fill="#e8a0a0" stroke="#c07878" strokeWidth="2" />
      {/* Ring hole – inner */}
      <circle cx="32" cy="32" r="12" fill="#f5f0e8" stroke="#c07878" strokeWidth="1.5" />
      {/* Smooth meat surface shading */}
      <path d="M32 4 A28 28 0 0 1 60 32 A28 28 0 0 1 32 60 A28 28 0 0 1 4 32 A28 28 0 0 1 32 4 Z M32 20 A12 12 0 0 0 20 32 A12 12 0 0 0 32 44 A12 12 0 0 0 44 32 A12 12 0 0 0 32 20 Z" fill="#f0b0b0" opacity="0.5" />
      {/* Fat specks typical of fleischwurst */}
      <circle cx="22" cy="18" r="2" fill="#f5e0d8" opacity="0.7" />
      <circle cx="46" cy="24" r="1.5" fill="#f5e0d8" opacity="0.6" />
      <circle cx="18" cy="40" r="1.8" fill="#f5e0d8" opacity="0.65" />
      <circle cx="44" cy="42" r="2" fill="#f5e0d8" opacity="0.7" />
      <circle cx="38" cy="14" r="1.2" fill="#f5e0d8" opacity="0.5" />
      <circle cx="14" cy="28" r="1.5" fill="#f5e0d8" opacity="0.55" />
    </svg>
  );
}


