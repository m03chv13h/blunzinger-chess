import { beforeEach } from 'vitest';

// Reset browser URL state between tests so navigation hash doesn't leak.
beforeEach(() => {
  window.location.hash = '';
});
