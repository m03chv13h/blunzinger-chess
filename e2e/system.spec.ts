import { test, expect } from '@playwright/test';

// ── Helpers ──────────────────────────────────────────────────────────

/** Navigate past the welcome screen by clicking "Continue as Guest". */
async function skipWelcome(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /Continue as Guest/i }).click();
  // Wait for the sidebar to appear, confirming we left the welcome screen.
  await expect(page.getByRole('navigation')).toBeVisible();
}

// ── 1. Smoke Test ────────────────────────────────────────────────────

test.describe('Smoke', () => {
  test('app loads and shows the correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Blunziger Chess');
  });
});

// ── 2. Welcome Screen ────────────────────────────────────────────────

test.describe('Welcome Screen', () => {
  test('displays the welcome heading and subtitle', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Blunziger Chess/i })).toBeVisible();
    await expect(page.getByText('A chess variant where every check counts.')).toBeVisible();
  });

  test('shows Continue as Guest button', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Continue as Guest/i })).toBeVisible();
  });
});

// ── 3. Guest Login → Quick Start ─────────────────────────────────────

test.describe('Guest Login Flow', () => {
  test('clicking Continue as Guest navigates to Quick Start', async ({ page }) => {
    await page.goto('/');
    await skipWelcome(page);
    await expect(page.getByRole('heading', { name: /Quick Start/i })).toBeVisible();
    await expect(page.getByText('Classic Blunzinger — jump straight in!')).toBeVisible();
  });
});

// ── 4. Quick Start Screen ────────────────────────────────────────────

test.describe('Quick Start Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await skipWelcome(page);
  });

  test('shows Player Mode selector with default HvH', async ({ page }) => {
    const select = page.locator('#qs-mode-select');
    await expect(select).toBeVisible();
    await expect(select).toHaveValue('hvh');
  });

  test('shows Start Game button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Start Game/i })).toBeVisible();
  });

  test('can start a game and see the chessboard', async ({ page }) => {
    await page.getByRole('button', { name: /Start Game/i }).click();
    await expect(page.getByRole('grid', { name: /Chess board/i })).toBeVisible();
  });
});

// ── 5. Sidebar Navigation ────────────────────────────────────────────

test.describe('Sidebar Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await skipWelcome(page);
  });

  test('sidebar shows all nav sections', async ({ page }) => {
    const nav = page.getByRole('navigation');
    await expect(nav.getByText('Quick Start')).toBeVisible();
    await expect(nav.getByText('New Game')).toBeVisible();
    await expect(nav.getByText('Analyse')).toBeVisible();
    await expect(nav.getByText('Simulate')).toBeVisible();
    await expect(nav.getByText('Rules')).toBeVisible();
  });

  test('navigating to New Game shows setup screen', async ({ page }) => {
    await page.getByRole('button', { name: /New Game/i }).click();
    await expect(page.getByRole('heading', { name: /New Game Setup/i })).toBeVisible();
  });

  test('navigating to Analyse shows the analyse section', async ({ page }) => {
    await page.getByRole('button', { name: /Analyse/i }).click();
    await expect(page.getByRole('heading', { name: '📊 Analyse' })).toBeVisible();
  });

  test('navigating to Simulate shows simulation setup', async ({ page }) => {
    await page.getByRole('button', { name: /Simulate/i }).click();
    await expect(page.getByText(/Start Simulation/i)).toBeVisible();
  });

  test('navigating to Rules shows the rules page', async ({ page }) => {
    await page.getByRole('button', { name: /Rules/i }).click();
    await expect(page.getByRole('heading', { name: /Rules/i })).toBeVisible();
  });

  test('navigating back to Quick Start returns to quick start', async ({ page }) => {
    await page.getByRole('button', { name: /Rules/i }).click();
    await page.getByRole('button', { name: /Quick Start/i }).click();
    await expect(page.getByRole('heading', { name: /Quick Start/i })).toBeVisible();
  });
});

// ── 6. New Game Setup ────────────────────────────────────────────────

test.describe('New Game Setup', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await skipWelcome(page);
    await page.getByRole('button', { name: /New Game/i }).click();
  });

  test('shows variant mode selector', async ({ page }) => {
    const select = page.locator('#variant-mode-select');
    await expect(select).toBeVisible();
    await expect(select).toHaveValue('classic_blunzinger');
  });

  test('shows game type selector', async ({ page }) => {
    const select = page.locator('#game-type-select');
    await expect(select).toBeVisible();
    await expect(select).toHaveValue('report_incorrectness');
  });

  test('shows player mode selector', async ({ page }) => {
    const select = page.locator('#mode-select');
    await expect(select).toBeVisible();
    await expect(select).toHaveValue('hvh');
  });

  test('can start a game from the new game screen', async ({ page }) => {
    await page.getByRole('button', { name: /Start Game/i }).click();
    await expect(page.getByRole('grid', { name: /Chess board/i })).toBeVisible();
  });
});

// ── 7. Rules Page ────────────────────────────────────────────────────

test.describe('Rules Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await skipWelcome(page);
    await page.getByRole('button', { name: /Rules/i }).click();
  });

  test('shows rules heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Rules/i })).toBeVisible();
  });

  test('shows variant modes section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Variant Modes/i })).toBeVisible();
  });

  test('shows game types section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Game Types/i })).toBeVisible();
  });
});

// ── 8. Playing a Game ────────────────────────────────────────────────

test.describe('Playing a Game', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await skipWelcome(page);
    await page.getByRole('button', { name: /Start Game/i }).click();
    // Wait for the board to render.
    await expect(page.getByRole('grid', { name: /Chess board/i })).toBeVisible();
  });

  test('chessboard renders 64 squares', async ({ page }) => {
    const squares = page.locator('.chessboard .square');
    await expect(squares).toHaveCount(64);
  });

  test('shows game status area', async ({ page }) => {
    await expect(page.locator('.game-status')).toBeVisible();
  });

  test('shows game controls with New Game and Restart buttons', async ({ page }) => {
    await expect(page.locator('.new-game-btn')).toBeVisible();
    await expect(page.getByRole('button', { name: /Restart/i })).toBeVisible();
  });

  test('shows the FEN display', async ({ page }) => {
    await expect(page.getByLabel('Current FEN')).toBeVisible();
  });

  test('shows rules panel toggle', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Show Rules/i })).toBeVisible();
  });

  test('can make a move by clicking squares', async ({ page }) => {
    // Click e2 then e4 (standard pawn opening)
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();

    // After the move, the FEN should have changed (no longer the initial FEN).
    const fenInput = page.getByRole('textbox', { name: /FEN/i });
    await expect(fenInput).not.toHaveValue(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    );
  });

  test('shows the game summary panel', async ({ page }) => {
    await expect(page.locator('.game-summary')).toBeVisible();
  });
});

// ── 9. Simulate Screen ──────────────────────────────────────────────

test.describe('Simulation Setup', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await skipWelcome(page);
    await page.getByRole('button', { name: /Simulate/i }).click();
  });

  test('shows simulation heading', async ({ page }) => {
    await expect(page.getByText('🔬 Simulation')).toBeVisible();
  });

  test('shows start simulation button', async ({ page }) => {
    await expect(page.getByText('▶ Start Simulation')).toBeVisible();
  });
});
