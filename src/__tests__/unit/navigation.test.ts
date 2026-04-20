import { describe, it, expect, beforeEach } from 'vitest';
import { getScreenFromHash } from '../../hooks/useNavigation';

describe('useNavigation', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  describe('getScreenFromHash', () => {
    it('returns null when no hash is present', () => {
      window.location.hash = '';
      expect(getScreenFromHash()).toBeNull();
    });

    it('returns null for empty hash', () => {
      window.location.hash = '#';
      expect(getScreenFromHash()).toBeNull();
    });

    it('returns null for root hash', () => {
      window.location.hash = '#/';
      expect(getScreenFromHash()).toBeNull();
    });

    it('returns quick-start for #/quick-start', () => {
      window.location.hash = '#/quick-start';
      expect(getScreenFromHash()).toBe('quick-start');
    });

    it('returns new-game for #/new-game', () => {
      window.location.hash = '#/new-game';
      expect(getScreenFromHash()).toBe('new-game');
    });

    it('returns online for #/online', () => {
      window.location.hash = '#/online';
      expect(getScreenFromHash()).toBe('online');
    });

    it('returns games for #/games', () => {
      window.location.hash = '#/games';
      expect(getScreenFromHash()).toBe('games');
    });

    it('returns analyse for #/analyse', () => {
      window.location.hash = '#/analyse';
      expect(getScreenFromHash()).toBe('analyse');
    });

    it('returns simulate for #/simulate', () => {
      window.location.hash = '#/simulate';
      expect(getScreenFromHash()).toBe('simulate');
    });

    it('returns rules for #/rules', () => {
      window.location.hash = '#/rules';
      expect(getScreenFromHash()).toBe('rules');
    });

    it('returns profile for #/profile', () => {
      window.location.hash = '#/profile';
      expect(getScreenFromHash()).toBe('profile');
    });

    it('returns null for unknown hash paths', () => {
      window.location.hash = '#/unknown';
      expect(getScreenFromHash()).toBeNull();
    });

    it('returns null for hash without slash prefix', () => {
      window.location.hash = '#rules';
      expect(getScreenFromHash()).toBeNull();
    });
  });
});
