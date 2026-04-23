import { test, expect } from '@playwright/test';

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Navigate past the welcome screen if it is shown (connected mode).
 * In static mode the app starts directly at Quick Start, so we just
 * verify the sidebar is visible.
 */
async function skipWelcome(page: import('@playwright/test').Page) {
  const guestBtn = page.getByRole('button', { name: /Continue as Guest/i });
  // In connected mode the welcome screen shows; click through it.
  // In static mode the button doesn't exist — just continue.
  if (await guestBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await guestBtn.click();
  }
  // Wait for the sidebar to appear, confirming we left the welcome screen.
  await expect(page.getByRole('navigation')).toBeVisible();
}

/**
 * Ensure "Play Online" is unchecked before starting a game.
 * In connected mode the Quick Start / New Game screens default to
 * online play, which navigates to the lobby instead of starting a
 * local game.  This helper deselects the checkbox if it exists.
 */
async function ensureLocalPlay(page: import('@playwright/test').Page) {
  const checkbox = page.getByRole('checkbox', { name: /Play Online/i });
  if (await checkbox.isVisible({ timeout: 1000 }).catch(() => false)) {
    if (await checkbox.isChecked()) {
      await checkbox.uncheck();
    }
  }
}

/**
 * Expand the collapsed left panel during active gameplay.
 * During a game the left panel (GameSummaryPanel, GameControls, etc.)
 * is collapsed behind a "Show details" toggle.
 */
async function expandLeftPanel(page: import('@playwright/test').Page) {
  const toggle = page.getByText(/Show details/);
  if (await toggle.isVisible({ timeout: 1000 }).catch(() => false)) {
    await toggle.click();
  }
}

// ── 1. Smoke Test ────────────────────────────────────────────────────

test.describe('Smoke', () => {
  test('app loads and shows the correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Blunziger Chess');
  });
});

// ── 2. Welcome Screen ────────────────────────────────────────────────
// These tests only apply in connected mode where the welcome screen is shown.

test.describe('Welcome Screen', () => {
  test('displays the welcome heading or Quick Start heading', async ({ page }) => {
    await page.goto('/');
    // In connected mode, the welcome screen shows first.
    // In static mode, the app goes straight to Quick Start.
    const welcome = page.getByText('A chess variant where every check counts.');
    const quickStart = page.getByRole('heading', { name: /Quick Start/i });
    await expect(welcome.or(quickStart)).toBeVisible();
  });

  test('shows Continue as Guest button or Quick Start screen', async ({ page }) => {
    await page.goto('/');
    const guestBtn = page.getByRole('button', { name: /Continue as Guest/i });
    const quickStart = page.getByRole('heading', { name: /Quick Start/i });
    await expect(guestBtn.or(quickStart)).toBeVisible();
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
    await ensureLocalPlay(page);
    await page.getByRole('button', { name: /Start Game/i }).click();
    await expect(page.getByRole('grid', { name: /Chess board/i })).toBeVisible();
  });

  test('switching to HvBot shows bot difficulty selector', async ({ page }) => {
    await page.locator('#qs-mode-select').selectOption('hvbot');
    const botLevel = page.locator('#qs-bot-level-select');
    await expect(botLevel).toBeVisible();
    await expect(botLevel).toHaveValue('easy');
  });

  test('switching to HvBot shows Play As selector', async ({ page }) => {
    await page.locator('#qs-mode-select').selectOption('hvbot');
    const playAs = page.locator('#qs-play-as-select');
    await expect(playAs).toBeVisible();
    await expect(playAs).toHaveValue('w');
  });

  test('shows clock settings with enable toggle', async ({ page }) => {
    await expect(page.getByText('Clock', { exact: true })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Enable clock/i })).toBeVisible();
  });

  test('shows mode description text', async ({ page }) => {
    await expect(page.getByText('Two players take turns on the same device.')).toBeVisible();
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
    await expect(nav.getByText('Games')).toBeVisible();
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

  test('navigating to Games shows played games section', async ({ page }) => {
    await page.getByRole('button', { name: /Games/i }).click();
    await expect(page.getByRole('heading', { name: '🎮 Played Games' })).toBeVisible();
  });

  test('Lobby button is visible in the sidebar', async ({ page }) => {
    const nav = page.getByRole('navigation');
    await expect(nav.getByText(/Lobby/i)).toBeVisible();
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

  test('shows overlays fieldset with checkboxes', async ({ page }) => {
    await expect(page.getByText('Overlays / Options')).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /King of the Hill/i })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Double Check Pressure/i })).toBeVisible();
  });

  test('switching to HvBot mode shows bot difficulty', async ({ page }) => {
    await page.locator('#mode-select').selectOption('hvbot');
    const botLevel = page.locator('#bot-level-select');
    await expect(botLevel).toBeVisible();
    await expect(botLevel).toHaveValue('easy');
  });

  test('switching to Penalty on Miss shows penalty checkboxes', async ({ page }) => {
    await page.locator('#game-type-select').selectOption('penalty_on_miss');
    await expect(page.getByText('Penalties on missed move')).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Additional move/i })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Piece removal/i })).toBeVisible();
  });

  test('selecting King Hunt Move Limit shows ply limit input', async ({ page }) => {
    await page.locator('#variant-mode-select').selectOption('classic_king_hunt_move_limit');
    await expect(page.getByLabel('Ply Limit')).toBeVisible();
  });

  test('selecting King Hunt Given Check Limit shows check target input', async ({ page }) => {
    await page.locator('#variant-mode-select').selectOption('classic_king_hunt_given_check_limit');
    await expect(page.getByText('Given Check Target')).toBeVisible();
  });

  test('can start a game from the new game screen', async ({ page }) => {
    await ensureLocalPlay(page);
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

  test('shows overlays / options section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Overlays \/ Options/i })).toBeVisible();
  });

  test('shows player modes section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Player Modes/i })).toBeVisible();
  });

  test('shows individual variant mode names', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Classic Blunzinger/i }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Reverse Blunzinger/i })).toBeVisible();
  });

  test('shows individual game type names', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Report Incorrectness/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Penalty on Miss/i })).toBeVisible();
  });

  test('shows overlay details', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /King of the Hill/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Clock/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Chess960/i })).toBeVisible();
  });
});

// ── 8. Playing a Game ────────────────────────────────────────────────

test.describe('Playing a Game', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await skipWelcome(page);
    await ensureLocalPlay(page);
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

  test('shows turn indicator in game status', async ({ page }) => {
    await expect(page.getByText(/to move/i)).toBeVisible();
  });

  test('shows report violation button', async ({ page }) => {
    await expect(page.getByText(/Report Violation/i)).toBeVisible();
  });

  test('shows game controls after expanding left panel', async ({ page }) => {
    await expandLeftPanel(page);
    await expect(page.locator('.new-game-btn')).toBeVisible();
    await expect(page.getByRole('button', { name: /Restart/i })).toBeVisible();
  });

  test('shows the FEN display after expanding left panel', async ({ page }) => {
    await expandLeftPanel(page);
    await expect(page.getByLabel('Current FEN')).toBeVisible();
  });

  test('shows rules panel toggle after expanding left panel', async ({ page }) => {
    await expandLeftPanel(page);
    await expect(page.getByRole('button', { name: /Show Rules/i })).toBeVisible();
  });

  test('can make a move by clicking squares', async ({ page }) => {
    // Click e2 then e4 (standard pawn opening)
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();

    // After the move, the turn should switch to Black.
    await expect(page.getByText(/Black to move/i)).toBeVisible();
  });

  test('shows the game summary panel after expanding left panel', async ({ page }) => {
    await expandLeftPanel(page);
    await expect(page.locator('.game-summary')).toBeVisible();
  });

  test('left panel is collapsed by default during gameplay', async ({ page }) => {
    await expect(page.getByText(/Show details/i)).toBeVisible();
  });

  test('left panel toggle switches between show and hide', async ({ page }) => {
    await page.getByText(/Show details/i).click();
    await expect(page.getByText(/Hide details/i)).toBeVisible();
    await page.getByText(/Hide details/i).click();
    await expect(page.getByText(/Show details/i)).toBeVisible();
  });

  test('shows move list header', async ({ page }) => {
    await expect(page.locator('.move-list-header')).toBeVisible();
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

  test('shows number of games input', async ({ page }) => {
    await expect(page.getByLabel('Number of Games')).toBeVisible();
  });

  test('shows bot difficulty selectors for both sides', async ({ page }) => {
    await expect(page.locator('#sim-bot-level-white')).toBeVisible();
    await expect(page.locator('#sim-bot-level-black')).toBeVisible();
  });

  test('shows variant mode selector', async ({ page }) => {
    const select = page.locator('#sim-variant-mode');
    await expect(select).toBeVisible();
    await expect(select).toHaveValue('classic_blunzinger');
  });

  test('shows game type selector', async ({ page }) => {
    const select = page.locator('#sim-game-type');
    await expect(select).toBeVisible();
    await expect(select).toHaveValue('report_incorrectness');
  });

  test('switching to Penalty on Miss shows penalty fieldset', async ({ page }) => {
    await page.locator('#sim-game-type').selectOption('penalty_on_miss');
    await expect(page.getByText('Penalties on missed move')).toBeVisible();
  });
});

// ── 10. Analyse Section ─────────────────────────────────────────────

test.describe('Analyse Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await skipWelcome(page);
    await page.getByRole('button', { name: /Analyse/i }).click();
  });

  test('shows analyse heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '📊 Analyse' })).toBeVisible();
  });

  test('shows empty state subtitle', async ({ page }) => {
    await expect(page.getByText(/Analyse a specific position/i)).toBeVisible();
  });

  test('shows analyse position form', async ({ page }) => {
    await expect(page.getByText(/Analyse Position/i)).toBeVisible();
  });

  test('shows FEN input for position analysis', async ({ page }) => {
    await expect(page.getByLabel('FEN string for analysis')).toBeVisible();
  });

  test('shows Start Analysis button', async ({ page }) => {
    await expect(page.getByText('▶ Start Analysis')).toBeVisible();
  });
});

// ── 11. Games Section ───────────────────────────────────────────────

test.describe('Games Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await skipWelcome(page);
    await page.getByRole('button', { name: /Games/i }).click();
  });

  test('shows played games heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '🎮 Played Games' })).toBeVisible();
  });

  test('shows empty state message when no games played', async ({ page }) => {
    await expect(page.getByText(/No games played yet/i)).toBeVisible();
  });
});
