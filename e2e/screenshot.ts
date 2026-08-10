import fs from 'fs';
import path from 'path';
import { Page } from '@playwright/test';

// Screenshots are development artifacts, not fixtures: they go to the gitignored
// `screenshots/` dir so runs never dirty the tree. Use this helper from specs to
// capture a full-page shot with a stable name. Playwright runs from the project
// root, so resolve against cwd (this package is ESM: no __dirname).
const SCREENSHOT_DIR = path.resolve(process.cwd(), 'screenshots');

export async function saveScreenshot(page: Page, name: string): Promise<string> {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const file = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}
