import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { join } from 'node:path';

const MAIN = join(process.cwd(), 'out/main/index.js');

let app: ElectronApplication;
let win: Page;

test.beforeAll(async () => {
  app = await electron.launch({ args: [MAIN] });
  win = await app.firstWindow();
  await win.locator('[data-testid="canvas-drop"]').waitFor({ timeout: 15_000 });
});

test.afterAll(async () => {
  await app.close();
});

test('the Steps toggle flips the canvas into step-overlay mode', async () => {
  const toggle = win.locator('[data-testid="steps-toggle"]');
  await toggle.click();
  await expect(win.locator('.canvas.steps-on')).toHaveCount(1);
  await toggle.click();
  await expect(win.locator('.canvas.steps-on')).toHaveCount(0);
});

test('presenting hides the chrome and the present bar exits', async () => {
  await expect(win.locator('.app__bar')).toBeVisible();
  await win.locator('[data-testid="present-btn"]').click();
  // Chrome hidden, present bar shown.
  await expect(win.locator('.present-bar')).toBeVisible();
  await expect(win.locator('.app__bar')).toBeHidden();
  // Exit returns to the editor.
  await win.locator('[data-testid="present-exit"]').click();
  await expect(win.locator('.present-bar')).toHaveCount(0);
  await expect(win.locator('.app__bar')).toBeVisible();
});
