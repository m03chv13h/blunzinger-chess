import { describe, it, expect } from 'vitest';
import { AVATAR_PRESETS, getAvatarEmoji } from '../../components/avatarPresets';

describe('avatarPresets', () => {
  it('contains 15 sausage-themed presets', () => {
    expect(AVATAR_PRESETS).toHaveLength(15);
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

  it('includes the new sausage avatar presets', () => {
    const ids = AVATAR_PRESETS.map(p => p.id);
    expect(ids).toContain('krakauer');
    expect(ids).toContain('blunze');
    expect(ids).toContain('kaesekrainer');
    expect(ids).toContain('eitrige');
    expect(ids).toContain('currywurst');
    expect(ids).toContain('depreziner');
    expect(ids).toContain('fleischwurst');
  });

  it('marks sausage SVG avatars with hasSvg flag', () => {
    const svgPresets = AVATAR_PRESETS.filter(p => p.hasSvg);
    expect(svgPresets.length).toBe(8);
    const svgIds = svgPresets.map(p => p.id);
    expect(svgIds).toContain('bratwurst');
    expect(svgIds).toContain('krakauer');
    expect(svgIds).toContain('blunze');
    expect(svgIds).toContain('kaesekrainer');
    expect(svgIds).toContain('eitrige');
    expect(svgIds).toContain('currywurst');
    expect(svgIds).toContain('depreziner');
    expect(svgIds).toContain('fleischwurst');
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
