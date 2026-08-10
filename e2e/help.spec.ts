import { test, expect } from '@playwright/test';
import { saveScreenshot } from './screenshot';

// The in-game Help entry is always available during a match and splits into two
// clearly separated sections: Controls and How to play. How-to-play reuses the
// GAME_RULES block, so this drives the real UI with no API keys and asserts both
// sections render their own content.

test('in-game Help shows separate Controls and How-to-play sections', async ({ page }) => {
  await page.goto('/');

  // Get into a running match via Quick Play (no API keys needed).
  await page.getByRole('button', { name: /quick play/i }).click();
  await page.getByRole('button', { name: /start match/i }).click();
  await expect(page.getByText(/turn 1/i)).toBeVisible();

  // Help is reachable from within the match.
  await page.getByRole('button', { name: /help/i }).click();
  const modal = page.getByTestId('help-modal');
  await expect(modal).toBeVisible();

  // Both sections are offered as clearly separated tabs.
  await expect(modal.getByRole('button', { name: /controls/i })).toBeVisible();
  await expect(modal.getByRole('button', { name: /how to play/i })).toBeVisible();

  // Controls section: UI actions, not rule text.
  await expect(page.getByTestId('help-controls')).toBeVisible();
  await expect(page.getByText(/click to move/i)).toBeVisible();
  await expect(page.getByText(/end turn/i).first()).toBeVisible();
  await saveScreenshot(page, 'help-controls');

  // How-to-play section: the shared GAME_RULES content.
  await modal.getByRole('button', { name: /how to play/i }).click();
  await expect(page.getByTestId('help-howto')).toBeVisible();
  await expect(page.getByText(/objective/i).first()).toBeVisible();
  await expect(page.getByText(/spellbound gridiron/i).first()).toBeVisible();
  await saveScreenshot(page, 'help-howto');

  // Closes cleanly back to the match.
  await modal.getByRole('button', { name: /^close$/i }).click();
  await expect(modal).toBeHidden();
  await expect(page.getByText(/turn 1/i)).toBeVisible();
});
