import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'http://localhost:4173';
const isLocal = baseURL.includes('localhost');

/**
 * Playwright configuration for system tests.
 *
 * By default tests run against a local Vite preview build (port 4173).
 * Override with:  BASE_URL=https://example.com npx playwright test
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  // Start a local preview server when testing against localhost.
  ...(isLocal
    ? {
        webServer: {
          command: 'npx vite preview --port 4173',
          port: 4173,
          reuseExistingServer: !process.env.CI,
        },
      }
    : {}),

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
