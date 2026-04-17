import { describe, it, expect } from 'vitest';
import { AVATAR_PRESETS, getAvatarEmoji } from '../../components/avatarPresets';

describe('avatarPresets', () => {
  it('contains 8 sausage-themed presets', () => {
    expect(AVATAR_PRESETS).toHaveLength(8);
  });

  it('each preset has id, emoji, and label', () => {
    for (const preset of AVATAR_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.emoji).toBeTruthy();
      expect(preset.label).toBeTruthy();
    }
  });

  it('has unique IDs', () => {
    const ids = AVATAR_PRESETS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('getAvatarEmoji', () => {
  it('returns emoji for a valid avatar ID', () => {
    expect(getAvatarEmoji('bratwurst')).toBe('🌭');
    expect(getAvatarEmoji('salami')).toBe('🍖');
  });

  it('returns undefined for an unknown ID', () => {
    expect(getAvatarEmoji('unknown')).toBeUndefined();
  });

  it('returns undefined for null/undefined', () => {
    expect(getAvatarEmoji(null)).toBeUndefined();
    expect(getAvatarEmoji(undefined)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(getAvatarEmoji('')).toBeUndefined();
  });
});
