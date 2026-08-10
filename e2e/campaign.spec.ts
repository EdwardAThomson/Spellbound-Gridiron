import { test, expect } from '@playwright/test';
import { saveScreenshot } from './screenshot';

// The campaign hub, end to end. Entered from the menu with no API keys, it lays
// out a fresh 4-team league, renders the standings table and the next fixture,
// advances a fixture (the opening one is AI-vs-AI, so it resolves instantly via
// the pure simulator), and proves the season survives a full page reload from
// its own versioned localStorage slot.

test('the campaign hub renders, advances a fixture, and persists across a reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('main-menu')).toBeVisible();

  // Campaign is launchable from the menu.
  const campaignButton = page.getByRole('button', { name: /campaign/i });
  await expect(campaignButton).toBeEnabled();
  await campaignButton.click();

  // The hub comes up with a fresh season: the four-team standings table and a
  // zeroed fixtures-played counter.
  const hub = page.getByTestId('campaign-hub');
  await expect(hub).toBeVisible();
  await expect(page.getByTestId('campaign-standings')).toBeVisible();
  await expect(page.getByTestId('standings-row-elves')).toBeVisible();
  await expect(page.getByTestId('standings-row-orcs')).toBeVisible();
  await expect(page.getByTestId('standings-row-dwarves')).toBeVisible();
  await expect(page.getByTestId('standings-row-undead')).toBeVisible();
  await expect(page.getByTestId('campaign-fixtures-played')).toHaveText('0 / 12 fixtures played');
  await saveScreenshot(page, 'campaign-hub-fresh');

  // The opening fixture is AI-vs-AI, so the control simulates it instantly.
  const advance = page.getByTestId('campaign-advance');
  await expect(advance).toContainText(/simulate/i);
  await advance.click();

  // One fixture is now resolved and the standings reflect it.
  await expect(page.getByTestId('campaign-fixtures-played')).toHaveText('1 / 12 fixtures played');
  await saveScreenshot(page, 'campaign-hub-advanced');

  // Reload the whole page: the season must survive from its localStorage slot.
  await page.reload();
  await expect(page.getByTestId('main-menu')).toBeVisible();
  await page.getByRole('button', { name: /campaign/i }).click();

  // The resumed hub still shows the played fixture, proving persistence.
  await expect(page.getByTestId('campaign-hub')).toBeVisible();
  await expect(page.getByTestId('campaign-fixtures-played')).toHaveText('1 / 12 fixtures played');
});
