import { test, expect } from '@playwright/test';
import { saveScreenshot } from './screenshot';

// Smoke test with no API keys configured: the app must load and a match must be
// startable purely from local state (LLM features degrade to canned text).
test('the start screen renders and a match can begin without API keys', async ({ page }) => {
  await page.goto('/');

  const startButton = page.getByRole('button', { name: /start match/i });
  await expect(startButton).toBeVisible();
  await saveScreenshot(page, 'start-screen');

  await startButton.click();

  // Once the match begins the start overlay (and its button) is gone, and the
  // board is live: the scoreboard shows the opening turn.
  await expect(startButton).toBeHidden();
  await expect(page.getByText(/turn 1/i)).toBeVisible();
  await saveScreenshot(page, 'match-started');
});
