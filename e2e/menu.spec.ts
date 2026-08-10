import { test, expect } from '@playwright/test';
import { saveScreenshot } from './screenshot';

// Main-menu navigation, end to end. The app opens on the fantasy home screen
// offering exactly Quick Play, Campaign, Tutorial and Settings. This drives the
// wired paths (Quick Play -> setup -> match, Settings modal) and the in-match
// return to the menu, all with no API keys. Tutorial is wired up (its own spec
// drives it end to end); Campaign is wired up by a later task, so here it is
// present but disabled.

test('the main menu offers the four modes and Quick Play round-trips to the menu', async ({ page }) => {
  await page.goto('/');

  // The home screen shows exactly the four modes.
  await expect(page.getByTestId('main-menu')).toBeVisible();
  await expect(page.getByRole('button', { name: /quick play/i })).toBeEnabled();
  await expect(page.getByRole('button', { name: /settings/i })).toBeEnabled();
  await expect(page.getByRole('button', { name: /campaign/i })).toBeDisabled();
  await expect(page.getByRole('button', { name: /tutorial/i })).toBeEnabled();
  await saveScreenshot(page, 'menu-home');

  // Settings opens the existing modal over the menu, then closes back to it.
  await page.getByRole('button', { name: /settings/i }).click();
  await expect(page.getByText(/game settings/i)).toBeVisible();
  await page.getByRole('button', { name: /save & close/i }).click();
  await expect(page.getByText(/game settings/i)).toBeHidden();
  await expect(page.getByTestId('main-menu')).toBeVisible();

  // Quick Play routes to the terrain/weather picker; Back returns to the menu.
  await page.getByRole('button', { name: /quick play/i }).click();
  await expect(page.getByRole('button', { name: /start match/i })).toBeVisible();
  await page.getByRole('button', { name: /back to menu/i }).click();
  await expect(page.getByTestId('main-menu')).toBeVisible();

  // Quick Play again, then kick off the match proper.
  await page.getByRole('button', { name: /quick play/i }).click();
  await page.getByRole('button', { name: /start match/i }).click();
  await expect(page.getByText(/turn 1/i)).toBeVisible();
  await expect(page.getByTestId('main-menu')).toBeHidden();

  // Quit to Menu returns home without ending or corrupting the running match.
  await page.getByRole('button', { name: /quit to menu/i }).click();
  await expect(page.getByTestId('main-menu')).toBeVisible();

  // The paused match is resumable and still on turn 1.
  const resume = page.getByRole('button', { name: /resume match/i });
  await expect(resume).toBeVisible();
  await resume.click();
  await expect(page.getByText(/turn 1/i)).toBeVisible();
  await saveScreenshot(page, 'menu-resumed-match');
});
