/** Preset avatar options – all sausage-themed. */
export const AVATAR_PRESETS = [
  { id: 'bratwurst', emoji: '🌭', label: 'Bratwurst' },
  { id: 'salami', emoji: '🍖', label: 'Salami' },
  { id: 'blutwurst', emoji: '🩸', label: 'Blutwurst' },
  { id: 'weisswurst', emoji: '🥖', label: 'Weißwurst' },
  { id: 'frankfurter', emoji: '🫕', label: 'Frankfurter' },
  { id: 'chorizo', emoji: '🌶️', label: 'Chorizo' },
  { id: 'knackwurst', emoji: '🥩', label: 'Knackwurst' },
  { id: 'bockwurst', emoji: '🍗', label: 'Bockwurst' },
] as const;

/** Look up the emoji for a given avatar preset ID. Returns undefined if not found. */
export function getAvatarEmoji(avatarId: string | undefined | null): string | undefined {
  if (!avatarId) return undefined;
  return AVATAR_PRESETS.find(a => a.id === avatarId)?.emoji;
}
