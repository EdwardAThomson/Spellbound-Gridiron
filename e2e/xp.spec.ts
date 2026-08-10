import { test, expect, Page } from '@playwright/test';
import { saveScreenshot } from './screenshot';

// XP accrual, end to end: drive a HOME player to a touchdown and assert the
// unit card's XP visibly climbs from 0. The default pitch is Grass / Clear, on
// which movement is fully deterministic (no mud slip, ice slide or weather
// penalty), so a fixed click path scores reliably with no API keys.

const clickTile = (page: Page, x: number, y: number) =>
  page.getByTestId(`tile-${x}-${y}`).click();

// Walk the selected player through a path of adjacent (king-move) tiles.
const walk = async (page: Page, path: [number, number][]) => {
  for (const [x, y] of path) {
    await clickTile(page, x, y);
  }
};

test('a player earns XP after scoring a touchdown', async ({ page }) => {
  await page.goto('/');

  // Kick off on the default Grass / Clear field (no terrain/weather selection).
  // Pick Hotseat so the AWAY turn is human-controlled: this test hands the turn
  // to AWAY and expects it to sit still rather than have the computer play it.
  await page.getByRole('button', { name: /quick play/i }).click();
  await page.getByTestId('opponent-picker').getByRole('button', { name: /hotseat/i }).click();
  await page.getByRole('button', { name: /start match/i }).click();
  await expect(page.getByText(/turn 1/i)).toBeVisible();

  // Select the HOME Catcher (Move 8) at (8, 1) and confirm it starts at 0 XP.
  await clickTile(page, 8, 1);
  const xp = page.getByTestId('unit-xp');
  await expect(xp).toHaveText('0 XP');

  // Turn 1: cross the field to collect the loose ball at centre (6, 9).
  await walk(page, [[7, 2], [6, 3], [6, 4], [6, 5], [6, 6], [6, 7], [6, 8], [6, 9]]);

  // Hand over to AWAY, who simply ends their turn, returning control to HOME.
  const endTurn = page.getByRole('button', { name: /end turn/i });
  await endTurn.click(); // HOME -> AWAY
  await endTurn.click(); // AWAY -> HOME (turn 2)
  await expect(page.getByText(/turn 2/i)).toBeVisible();

  // Turn 2: re-select the ball carrier and run it into the HOME endzone (row 17),
  // stepping around the AWAY player parked on (6, 16).
  await clickTile(page, 6, 9);
  await expect(xp).toHaveText('0 XP');
  await walk(page, [[6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [6, 15], [5, 16], [5, 17]]);

  // The touchdown award (5 XP) lands on the scorer's still-selected unit card.
  await expect(xp).toHaveText('5 XP');
  await saveScreenshot(page, 'xp-after-touchdown');
});
