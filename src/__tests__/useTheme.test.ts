import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../hooks/useTheme';
import type { ThemeMode } from '../hooks/useTheme';

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to system theme', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('system');
  });

  it('persists theme to localStorage', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme('dark'));
    expect(result.current.theme).toBe('dark');
    expect(localStorage.getItem('blunzinger-chess-theme')).toBe('dark');
  });

  it('resolvedTheme matches mode when explicitly set', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme('blunznstyle'));
    expect(result.current.resolvedTheme).toBe('blunznstyle');
    act(() => result.current.setTheme('light'));
    expect(result.current.resolvedTheme).toBe('light');
  });

  it('sets data-theme attribute on document element', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme('dark'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('resolvedTheme follows system when mode is system', () => {
    const { result } = renderHook(() => useTheme());
    // In jsdom, matchMedia defaults to not matching, so system → light
    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toBe('light');
  });

  it('reads stored theme from localStorage', () => {
    localStorage.setItem('blunzinger-chess-theme', 'blunznstyle');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('blunznstyle');
    expect(result.current.resolvedTheme).toBe('blunznstyle');
  });

  it('returns correct type for setTheme', () => {
    const { result } = renderHook(() => useTheme());
    const modes: ThemeMode[] = ['system', 'light', 'dark', 'blunznstyle'];
    for (const mode of modes) {
      act(() => result.current.setTheme(mode));
      expect(result.current.theme).toBe(mode);
    }
  });
});
