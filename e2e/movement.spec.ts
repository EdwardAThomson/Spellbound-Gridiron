import { test, expect, Page } from '@playwright/test';
import { saveScreenshot } from './screenshot';

// Click-to-move, end to end: selecting a unit and clicking a distant reachable
// tile walks it there along the shortest path, spending one Move point per
// square. Runs on the default Grass / Clear field so movement is deterministic
// and needs no API keys.

const clickTile = (page: Page, x: number, y: number) =>
  page.getByTestId(`tile-${x}-${y}`).click();

test('a unit walks to a clicked distant tile, spending one Move per square', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /start match/i }).click();
  await expect(page.getByText(/turn 1/i)).toBeVisible();

  // The HOME Catcher starts at (8, 1) with Move 8.
  await clickTile(page, 8, 1);
  await expect(page.getByText('8 / 8')).toBeVisible();

  // One click, four squares: (8,1) -> (8,5) costs 4 Move points.
  await clickTile(page, 8, 5);
  await expect(page.getByText('4 / 8')).toBeVisible();

  // The unit really stands on (8, 5) now: clicking its old tile deselects
  // nothing and clicking the new tile re-selects the same Catcher.
  await clickTile(page, 8, 5);
  await expect(page.getByText(/catcher/i).first()).toBeVisible();
  await saveScreenshot(page, 'movement-click-to-move');

  // A tile beyond the remaining Move budget is refused with a log message.
  await clickTile(page, 8, 15);
  await expect(page.getByText("Can't reach that tile this turn.")).toBeVisible();
  await expect(page.getByText('4 / 8')).toBeVisible();
});
