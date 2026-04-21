import { beforeEach } from 'vitest';

// Reset browser URL state and localStorage between tests so state doesn't leak.
beforeEach(() => {
  window.location.hash = '';
  localStorage.removeItem('blunziger-chess-game-history');
});
