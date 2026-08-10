import { test, expect } from '@playwright/test';
import { saveScreenshot } from './screenshot';

// The guided tutorial, end to end. Launched from the menu, it rides on top of a
// live Grass/Clear board with no API keys, walking the player through the core
// loop with anchored coachmarks. This drives the happy path to completion and
// back to the menu: some steps advance by the real action (select a unit, move
// it, end the turn) and the rest advance with Next, proving both the
// teach-by-doing auto-advance and the never-stuck escape hatch.

test('the tutorial runs from the menu through the core loop and back', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('main-menu')).toBeVisible();

  // Tutorial is launchable from the menu.
  const tutorialButton = page.getByRole('button', { name: /tutorial/i });
  await expect(tutorialButton).toBeEnabled();
  await tutorialButton.click();

  // The live board comes up with the first coachmark greeting the player.
  await expect(page.getByText(/turn 1/i)).toBeVisible();
  const coach = page.getByTestId('tutorial-coachmark');
  await expect(coach).toBeVisible();
  await expect(coach.getByText(/welcome to spellbound gridiron/i)).toBeVisible();
  await saveScreenshot(page, 'tutorial-welcome');

  // Step 1 (welcome): an informational step, dismissed with Next.
  await page.getByTestId('tutorial-next').click();

  // Step 2 (select a unit): clicking a real HOME token advances by doing.
  await expect(coach.getByText(/click one of your units/i)).toBeVisible();
  await page.getByTestId('tile-8-1').click(); // HOME Catcher starts at (8, 1)
  await expect(coach.getByText(/click a highlighted tile to move/i)).toBeVisible();

  // Step 3 (move): clicking a reachable tile advances by doing.
  await page.getByTestId('tile-8-4').click();
  await expect(coach.getByText(/move a unit onto the ball/i)).toBeVisible();

  // Steps 4 (pick up the ball) and 5 (score) are explained here; advance with
  // Next rather than staging a full carry.
  await page.getByTestId('tutorial-next').click();
  await expect(coach.getByText(/carry the ball into the opponent/i)).toBeVisible();
  await page.getByTestId('tutorial-next').click();

  // Step 6 (end the turn): use the real End Turn button; the coachmark advances.
  await expect(coach.getByText(/finished moving your units/i)).toBeVisible();
  await page.getByRole('button', { name: /end turn/i }).click();

  // Step 7 (find Help): the final coachmark. Finish returns to the menu.
  await expect(coach.getByText(/open help any time/i)).toBeVisible();
  await saveScreenshot(page, 'tutorial-final');
  await page.getByTestId('tutorial-next').click(); // labelled "Finish" on the last step

  await expect(page.getByTestId('main-menu')).toBeVisible();
  await expect(page.getByTestId('tutorial-coachmark')).toBeHidden();
});

test('the tutorial is skippable at any time and returns to the menu', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /tutorial/i }).click();

  const coach = page.getByTestId('tutorial-coachmark');
  await expect(coach).toBeVisible();

  // Skip from the very first step drops the overlay and returns to the menu,
  // with the running-match save untouched (no Resume Match offered).
  await page.getByTestId('tutorial-skip').click();
  await expect(page.getByTestId('main-menu')).toBeVisible();
  await expect(coach).toBeHidden();
  await expect(page.getByRole('button', { name: /resume match/i })).toHaveCount(0);
});
