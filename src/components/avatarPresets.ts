import type { ReactNode } from 'react';
import {
  KrakauerAvatar,
  BlunzeAvatar,
  KaesekrainerAvatar,
  EitrigeAvatar,
  CurrywurstAvatar,
  DeprezinerAvatar,
  BratwurstAvatar,
  FleischwurstAvatar,
} from './sausageAvatars';

export interface AvatarPreset {
  readonly id: string;
  readonly emoji: string;
  readonly label: string;
  /** When true, this avatar has a custom SVG component in sausageAvatars.tsx. */
  readonly hasSvg?: boolean;
}

/** Map of avatar ID → SVG component for sausage avatars with custom artwork. */
const SAUSAGE_SVG: Record<string, (props: { size?: string }) => ReactNode> = {
  krakauer: KrakauerAvatar,
  blunze: BlunzeAvatar,
  kaesekrainer: KaesekrainerAvatar,
  eitrige: EitrigeAvatar,
  currywurst: CurrywurstAvatar,
  depreziner: DeprezinerAvatar,
  bratwurst: BratwurstAvatar,
  fleischwurst: FleischwurstAvatar,
};

/** Preset avatar options – all sausage-themed. */
export const AVATAR_PRESETS: readonly AvatarPreset[] = [
  { id: 'bratwurst', emoji: '🌭', label: 'Bratwurst', hasSvg: true },
  { id: 'salami', emoji: '🍖', label: 'Salami' },
  { id: 'blutwurst', emoji: '🩸', label: 'Blutwurst' },
  { id: 'weisswurst', emoji: '🥖', label: 'Weißwurst' },
  { id: 'frankfurter', emoji: '🫕', label: 'Frankfurter' },
  { id: 'chorizo', emoji: '🌶️', label: 'Chorizo' },
  { id: 'knackwurst', emoji: '🥩', label: 'Knackwurst' },
  { id: 'bockwurst', emoji: '🍗', label: 'Bockwurst' },
  { id: 'krakauer', emoji: '🌭', label: 'Krakauer', hasSvg: true },
  { id: 'blunze', emoji: '🩸', label: 'Blunze', hasSvg: true },
  { id: 'kaesekrainer', emoji: '🧀', label: 'Käsekrainer', hasSvg: true },
  { id: 'eitrige', emoji: '🧀', label: 'Eitrige', hasSvg: true },
  { id: 'currywurst', emoji: '🍛', label: 'Currywurst', hasSvg: true },
  { id: 'depreziner', emoji: '🌶️', label: 'Depreziner', hasSvg: true },
  { id: 'fleischwurst', emoji: '🔴', label: 'Fleischwurst', hasSvg: true },
];

/** Look up the emoji for a given avatar preset ID. Returns undefined if not found. */
export function getAvatarEmoji(avatarId: string | undefined | null): string | undefined {
  if (!avatarId) return undefined;
  return AVATAR_PRESETS.find(a => a.id === avatarId)?.emoji;
}

/**
 * Get the display element for an avatar – returns the SVG component when available,
 * falls back to the emoji string. Returns undefined if the ID is not found.
 */
export function getAvatarDisplay(avatarId: string | undefined | null, size?: string): ReactNode | undefined {
  if (!avatarId) return undefined;
  const SvgComponent = SAUSAGE_SVG[avatarId];
  if (SvgComponent) return SvgComponent({ size });
  return AVATAR_PRESETS.find(a => a.id === avatarId)?.emoji;
}

