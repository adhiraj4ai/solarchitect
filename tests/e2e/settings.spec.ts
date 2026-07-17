import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openPanel } from './helpers';

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
  await openPanel(win, 'settings');

  await expect(win.locator('[data-testid="setting-grid"]')).toBeChecked(); // grid on by default
  await expect(win.locator('[data-testid="setting-autosave"]')).not.toBeChecked(); // autosave off by default
  await expect(win.locator('[data-testid="setting-node-borders"]')).not.toBeChecked(); // borderless by default
  await expect(win.locator('[data-testid="setting-node-fill"]')).toBeChecked(); // filled by default

  await win.locator('[data-testid="setting-grid"]').uncheck();
  await win.locator('[data-testid="setting-autosave"]').check();
  await win.locator('[data-testid="setting-node-borders"]').check();
  await win.locator('[data-testid="setting-node-fill"]').uncheck();
  await win.locator('[data-testid="setting-provider"]').selectOption('aws');
  await win.waitForTimeout(400); // let the async writeSettings flush to disk

  // Reload the app; settings are read back from the user-data file.
  await win.reload();
  await win.locator('[data-testid="canvas-drop"]').waitFor({ timeout: 15_000 });
  await openPanel(win, 'settings');

  await expect(win.locator('[data-testid="setting-grid"]')).not.toBeChecked();
  await expect(win.locator('[data-testid="setting-autosave"]')).toBeChecked();
  await expect(win.locator('[data-testid="setting-node-borders"]')).toBeChecked();
  await expect(win.locator('[data-testid="setting-node-fill"]')).not.toBeChecked();
  await expect(win.locator('[data-testid="setting-provider"]')).toHaveValue('aws');
});

test('the default provider filter narrows the Shapes panel', async () => {
  await openPanel(win, 'settings');
  await win.locator('[data-testid="setting-provider"]').selectOption('aws');

  // With aws chosen, the Shapes panel shows AWS but not, say, Azure.
  await openPanel(win, 'shapes');
  await expect(win.locator('[data-testid="lib-group-aws"]')).toBeVisible();
  await expect(win.locator('[data-testid="lib-group-azure"]')).toHaveCount(0);

  // Clearing the filter brings every provider back.
  await openPanel(win, 'settings');
  await win.locator('[data-testid="setting-provider"]').selectOption('');
  await openPanel(win, 'shapes');
  await expect(win.locator('[data-testid="lib-group-azure"]')).toBeVisible();
});

test('a corrupt settings file falls back to defaults with a non-blocking toast', async () => {
  // Corrupt the settings file, then reload so the renderer re-reads it.
  await writeFile(join(userData, 'settings.json'), '{ not valid json', 'utf-8');
  await win.reload();
  await win.locator('[data-testid="canvas-drop"]').waitFor({ timeout: 15_000 });

  // A non-blocking toast warns; the app is still usable.
  await expect(win.locator('.toast')).toContainText(/unreadable/i);
  await openPanel(win, 'settings');
  await expect(win.locator('[data-testid="setting-grid"]')).toBeChecked(); // reverted to defaults
});
