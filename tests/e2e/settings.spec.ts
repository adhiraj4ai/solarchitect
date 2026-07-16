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

// Open a panel deterministically regardless of current state: switch to another
// panel first, then the target, so we never toggle-collapse an already-active one.
async function openPanel(id: string) {
  const other = id === 'project' ? 'help' : 'project';
  await win.locator(`[data-testid="activity-${other}"]`).click();
  await win.locator(`[data-testid="activity-${id}"]`).click();
}

test('settings default sensibly and persist across a reload', async () => {
  await openPanel('settings');

  await expect(win.locator('[data-testid="setting-grid"]')).toBeChecked(); // grid on by default
  await expect(win.locator('[data-testid="setting-autosave"]')).not.toBeChecked(); // autosave off by default

  await win.locator('[data-testid="setting-grid"]').uncheck();
  await win.locator('[data-testid="setting-autosave"]').check();
  await win.locator('[data-testid="setting-provider"]').selectOption('aws');
  await win.waitForTimeout(400); // let the async writeSettings flush to disk

  // Reload the app; settings are read back from the user-data file.
  await win.reload();
  await win.locator('[data-testid="canvas-drop"]').waitFor({ timeout: 15_000 });
  await openPanel('settings');

  await expect(win.locator('[data-testid="setting-grid"]')).not.toBeChecked();
  await expect(win.locator('[data-testid="setting-autosave"]')).toBeChecked();
  await expect(win.locator('[data-testid="setting-provider"]')).toHaveValue('aws');
});

test('the default provider filter narrows the Shapes panel', async () => {
  await openPanel('settings');
  await win.locator('[data-testid="setting-provider"]').selectOption('aws');

  // With aws chosen, the Shapes panel shows AWS but not, say, Azure.
  await openPanel('shapes');
  await expect(win.locator('[data-testid="lib-group-aws"]')).toBeVisible();
  await expect(win.locator('[data-testid="lib-group-azure"]')).toHaveCount(0);

  // Clearing the filter brings every provider back.
  await openPanel('settings');
  await win.locator('[data-testid="setting-provider"]').selectOption('');
  await openPanel('shapes');
  await expect(win.locator('[data-testid="lib-group-azure"]')).toBeVisible();
});
