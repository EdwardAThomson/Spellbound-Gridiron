import { test, expect, Page } from '@playwright/test';
import { saveScreenshot } from './screenshot';

// Persistent-roster rematch, end to end: a HOME player banks XP by scoring, the
// match is run out to full time, and the post-game Rematch button starts a fresh
// match in which that same player returns - at its formation slot - still
// carrying the XP it earned. Runs on the default Grass / Clear field (no API
// keys), where movement is deterministic, so a fixed click path scores reliably.

const clickTile = (page: Page, x: number, y: number) =>
  page.getByTestId(`tile-${x}-${y}`).click();

const walk = async (page: Page, path: [number, number][]) => {
  for (const [x, y] of path) {
    await clickTile(page, x, y);
  }
};

test('a rematch carries a scorer\'s earned XP into the next match', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /quick play/i }).click();
  await page.getByRole('button', { name: /start match/i }).click();
  await expect(page.getByText(/turn 1/i)).toBeVisible();

  // --- Match 1: drive the HOME Catcher (8, 1) to a touchdown for 5 XP. ---
  await clickTile(page, 8, 1);
  const xp = page.getByTestId('unit-xp');
  await expect(xp).toHaveText('0 XP');

  await walk(page, [[7, 2], [6, 3], [6, 4], [6, 5], [6, 6], [6, 7], [6, 8], [6, 9]]);

  const endTurn = page.getByRole('button', { name: /^end turn$/i });
  await endTurn.click(); // HOME -> AWAY
  await endTurn.click(); // AWAY -> HOME (turn 2)
  await expect(page.getByText(/turn 2/i)).toBeVisible();

  await clickTile(page, 6, 9);
  await walk(page, [[6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [6, 15], [5, 16], [5, 17]]);
  await expect(xp).toHaveText('5 XP');

  // --- Run the clock out to full time (16 turns), then rematch. ---
  const rematch = page.getByRole('button', { name: /rematch/i });
  for (let i = 0; i < 60 && !(await rematch.isVisible()); i++) {
    await endTurn.click();
  }
  await expect(rematch).toBeVisible();
  await saveScreenshot(page, 'rematch-game-over');

  // --- Match 2: the veteran Catcher returns at (8, 1) with its XP carried. ---
  await rematch.click();
  await expect(page.getByText(/turn 1/i)).toBeVisible();

  const xp2 = page.getByTestId('unit-xp');
  await clickTile(page, 8, 1);
  await expect(xp2).toHaveText('5 XP');
  await saveScreenshot(page, 'rematch-progression-carried');
});
