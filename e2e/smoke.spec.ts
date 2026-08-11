import { test, expect } from '@playwright/test';
import { saveScreenshot } from './screenshot';

// Smoke test with no API keys configured: the app must load and a match must be
// startable purely from local state (LLM features degrade to canned text).
test('the main menu renders and a match can begin without API keys', async ({ page }) => {
  await page.goto('/');

  // The app opens on the fantasy main menu; Quick Play routes to the setup picker.
  const quickPlay = page.getByRole('button', { name: /quick play/i });
  await expect(quickPlay).toBeVisible();
  await saveScreenshot(page, 'main-menu');
  await quickPlay.click();

  const startButton = page.getByRole('button', { name: /start match/i });
  await expect(startButton).toBeVisible();
  await saveScreenshot(page, 'start-screen');

  await startButton.click();

  // Once the match begins the start overlay (and its button) is gone, and the
  // board is live: the scoreboard shows the opening turn.
  await expect(startButton).toBeHidden();
  await expect(page.getByText(/turn 1/i)).toBeVisible();

  // The crystal-ball commentary is collapsed by default and slides open on
  // demand; its content is deterministic local flavor text, no keys involved.
  const commentaryBody = page.getByTestId('commentary-body');
  await expect(commentaryBody.getByText(/"/)).not.toBeInViewport();
  await page.getByTestId('commentary-toggle').click();
  await expect(commentaryBody.getByText(/"/)).toBeInViewport();
  await saveScreenshot(page, 'match-started');
});
