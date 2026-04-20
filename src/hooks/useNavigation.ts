/**
 * useNavigation – Syncs the AppScreen type with the URL hash.
 *
 * Provides URL-based navigation so that refreshing the page restores the
 * user to the screen they were on. Stateful screens (playing, online-playing,
 * etc.) that cannot be fully restored from the URL alone are mapped to their
 * parent section on refresh.
 *
 * Uses hash-based routing (e.g. `#/rules`, `#/new-game`) which works with
 * any static hosting without server-side configuration.
 */

import { useEffect, useRef } from 'react';

/** Screen types that can be restored from URL alone (no extra state needed). */
export type NavigableScreen =
  | 'quick-start'
  | 'new-game'
  | 'online'
  | 'games'
  | 'analyse'
  | 'simulate'
  | 'rules'
  | 'profile';

/** All screen types recognized in the URL (some map to a parent on restore). */
type ScreenType =
  | NavigableScreen
  | 'welcome'
  | 'playing'
  | 'online-playing'
  | 'online-lobby'
  | 'games-review'
  | 'analyse-review'
  | 'simulation-running';

/** Map from screen type → URL hash path segment. */
const SCREEN_TO_PATH: Record<NavigableScreen, string> = {
  'quick-start': '/quick-start',
  'new-game': '/new-game',
  'online': '/online',
  'games': '/games',
  'analyse': '/analyse',
  'simulate': '/simulate',
  'rules': '/rules',
  'profile': '/profile',
};

/** Map from URL hash path → screen type. */
const PATH_TO_SCREEN: Record<string, NavigableScreen> = {
  '/quick-start': 'quick-start',
  '/new-game': 'new-game',
  '/online': 'online',
  '/games': 'games',
  '/analyse': 'analyse',
  '/simulate': 'simulate',
  '/rules': 'rules',
  '/profile': 'profile',
};

/**
 * Map stateful screens to their parent navigable section.
 * These screens carry config/state that can't be restored from URL alone.
 */
const STATEFUL_SCREEN_PARENT: Record<string, NavigableScreen> = {
  'playing': 'quick-start',
  'online-playing': 'quick-start',
  'online-lobby': 'online',
  'games-review': 'games',
  'analyse-review': 'analyse',
  'simulation-running': 'simulate',
};

/**
 * Read the initial screen type from the URL hash.
 * Returns the screen type if it maps to a navigable screen, otherwise null.
 */
export function getScreenFromHash(): NavigableScreen | null {
  const hash = window.location.hash;
  if (!hash || hash === '#' || hash === '#/') {
    return null;
  }
  // Strip the leading '#'
  const path = hash.slice(1);
  return PATH_TO_SCREEN[path] ?? null;
}

/**
 * Get the hash path for a given screen type.
 * Stateful screens return their parent's path.
 */
function getPathForScreen(screenType: ScreenType): string {
  if (screenType in SCREEN_TO_PATH) {
    return SCREEN_TO_PATH[screenType as NavigableScreen];
  }
  const parent = STATEFUL_SCREEN_PARENT[screenType];
  if (parent) {
    return SCREEN_TO_PATH[parent];
  }
  // Fallback: welcome or unknown screens get quick-start path
  return '/quick-start';
}

interface UseNavigationOptions {
  /** Current screen type. */
  screenType: ScreenType | 'welcome';
  /** Callback to update screen state from a hash change (browser back/forward). */
  onNavigate: (screen: NavigableScreen) => void;
}

/**
 * Hook that syncs the URL hash with the current screen state.
 * - Updates the hash when `screenType` changes.
 * - Listens for `popstate` to handle browser back/forward.
 */
export function useNavigation({ screenType, onNavigate }: UseNavigationOptions): void {
  const isInternalNavRef = useRef(false);

  // Update the URL hash when screen changes (push to history).
  useEffect(() => {
    if (screenType === 'welcome') {
      // Don't push welcome screen to URL — it's transient.
      return;
    }

    const targetPath = getPathForScreen(screenType);
    const targetHash = `#${targetPath}`;
    const currentHash = window.location.hash || '#/quick-start';

    if (currentHash !== targetHash) {
      isInternalNavRef.current = true;
      window.history.pushState(null, '', targetHash);
    }
  }, [screenType]);

  // Listen for popstate (browser back/forward buttons).
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

  useEffect(() => {
    function handlePopState() {
      if (isInternalNavRef.current) {
        isInternalNavRef.current = false;
      }
      const screen = getScreenFromHash();
      if (screen) {
        onNavigateRef.current(screen);
      } else {
        // No valid hash — navigate to quick-start.
        onNavigateRef.current('quick-start');
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Set initial hash if none exists and we're not on welcome.
  useEffect(() => {
    if (screenType !== 'welcome' && (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/')) {
      const targetPath = getPathForScreen(screenType);
      window.history.replaceState(null, '', `#${targetPath}`);
    }
    // Only run on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
