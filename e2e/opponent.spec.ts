import { test, expect } from '@playwright/test';
import { saveScreenshot } from './screenshot';

// The rules-based Computer opponent, end to end, with no API keys. Two paths are
// covered: a Quick Play match against the Computer, and a Campaign player-fixture
// (whose other team is always the Computer). In both, the player ends their turn
// and the built-in opponent brain takes over, plays out its side, and hands
// control back, all without any language model.

test('Quick Play against the Computer opponent auto-plays the AWAY turn', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('main-menu')).toBeVisible();

  // Quick Play -> setup. Computer is the default opponent; the Hotseat/Computer
  // picker is present and Computer is pre-selected.
  await page.getByRole('button', { name: /quick play/i }).click();
  const picker = page.getByTestId('opponent-picker');
  await expect(picker).toBeVisible();
  await expect(picker.getByRole('button', { name: /hotseat/i })).toBeVisible();
  const computerChoice = picker.getByRole('button', { name: /computer/i });
  await expect(computerChoice).toHaveAttribute('aria-pressed', 'true');
  await saveScreenshot(page, 'opponent-picker');

  // Kick off and end the player's (HOME) turn. The computer indicator appears
  // while the opponent works, then control returns and the turn advances.
  await page.getByRole('button', { name: /start match/i }).click();
  await expect(page.getByText(/turn 1/i)).toBeVisible();

  await page.getByRole('button', { name: /end turn/i }).click();
  await expect(page.getByTestId('opponent-indicator')).toBeVisible();
  await saveScreenshot(page, 'opponent-turn');

  // The computer finishes its turn on its own: the indicator clears and it is
  // the player's (HOME) turn again on turn 2.
  await expect(page.getByTestId('opponent-indicator')).toBeHidden({ timeout: 20_000 });
  await expect(page.getByText(/current:\s*home/i)).toBeVisible();
  await expect(page.getByText(/turn 2/i)).toBeVisible();
});

test('a Campaign player-fixture is played against the Computer', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('main-menu')).toBeVisible();
  await page.getByRole('button', { name: /campaign/i }).click();
  await expect(page.getByTestId('campaign-hub')).toBeVisible();

  // Simulate AI-vs-AI fixtures until the player's own fixture is up next, then
  // play it. The other club is computer-controlled.
  const advance = page.getByTestId('campaign-advance');
  for (let i = 0; i < 12; i++) {
    if (/play your match/i.test((await advance.textContent()) ?? '')) break;
    await advance.click();
    await expect(advance).toBeVisible();
  }
  await expect(advance).toContainText(/play your match/i);
  await advance.click();

  // In the live campaign match, end the player's turn and let the Computer play.
  await expect(page.getByText(/turn 1/i)).toBeVisible();
  await page.getByRole('button', { name: /end turn/i }).click();
  await expect(page.getByTestId('opponent-indicator')).toBeVisible();
  await expect(page.getByTestId('opponent-indicator')).toBeHidden({ timeout: 20_000 });
  await expect(page.getByText(/turn 2/i)).toBeVisible();
  await saveScreenshot(page, 'opponent-campaign');
});
