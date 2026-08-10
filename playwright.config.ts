import { defineConfig, devices } from '@playwright/test';

// End-to-end layer: drives a real Chromium browser against the Vite dev server.
// Specs live in `e2e/`. Playwright starts the dev server itself (reusing one if
// already running) so `npm run test:e2e` works from a clean checkout.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:51789',
    trace: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Dedicated, uncommon port with --strictPort so the e2e run always drives its
  // own Vite instance rather than silently reusing whatever else is on :3000.
  webServer: {
    command: 'npm run dev -- --port 51789 --strictPort',
    url: 'http://localhost:51789',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
