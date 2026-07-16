import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAIN = join(process.cwd(), 'out/main/index.js');

let app: ElectronApplication;
let win: Page;
let userData: string;

test.beforeAll(async () => {
  userData = await mkdtemp(join(tmpdir(), 'solarchitect-settings-'));
  app = await electron.launch({ args: [MAIN, `--user-data-dir=${userData}`] });
  win = await app.firstWindow();
  await win.locator('[data-testid="canvas-drop"]').waitFor({ timeout: 15_000 });
});

test.afterAll(async () => {
  await app.close();
  await rm(userData, { recursive: true, force: true });
});

test('settings default sensibly and persist across a reload', async () => {
  await win.locator('[data-testid="activity-settings"]').click();

  const grid = win.locator('[data-testid="setting-grid"]');
  const autosave = win.locator('[data-testid="setting-autosave"]');
  await expect(grid).toBeChecked(); // grid on by default
  await expect(autosave).not.toBeChecked(); // autosave off by default

  // Change both settings.
  await grid.uncheck();
  await autosave.check();
  await win.locator('[data-testid="setting-provider"]').selectOption('aws');

  // Reload the app; settings are read back from the user-data file.
  await win.reload();
  await win.locator('[data-testid="canvas-drop"]').waitFor({ timeout: 15_000 });
  await win.locator('[data-testid="activity-settings"]').click();

  await expect(win.locator('[data-testid="setting-grid"]')).not.toBeChecked();
  await expect(win.locator('[data-testid="setting-autosave"]')).toBeChecked();
  await expect(win.locator('[data-testid="setting-provider"]')).toHaveValue('aws');
});

test('the default provider filter narrows the Shapes panel', async () => {
  // With aws chosen above, the Shapes panel shows AWS but not, say, Azure.
  await win.locator('[data-testid="activity-shapes"]').click();
  await expect(win.locator('[data-testid="lib-group-aws"]')).toBeVisible();
  await expect(win.locator('[data-testid="lib-group-azure"]')).toHaveCount(0);
});
