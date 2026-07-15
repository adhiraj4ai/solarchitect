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

const yaml = () => win.locator('textarea[aria-label="Diagram YAML"]');
const canvas = () => win.locator('[data-testid="canvas-drop"]');

test('defaults to split — canvas and source both visible', async () => {
  await expect(canvas()).toBeVisible();
  await expect(yaml()).toBeVisible();
  await expect(win.locator('[data-testid="view-split"]')).toHaveAttribute('aria-selected', 'true');
});

test('visual mode shows the canvas and hides the source', async () => {
  await win.locator('[data-testid="view-visual"]').click();
  await expect(canvas()).toBeVisible();
  await expect(yaml()).toHaveCount(0);
});

test('code mode shows the editor and hides the canvas', async () => {
  await win.locator('[data-testid="view-code"]').click();
  await expect(yaml()).toBeVisible();
  await expect(canvas()).toHaveCount(0);
});

test('typing invalid YAML in code mode shows an error without crashing', async () => {
  await win.locator('[data-testid="view-code"]').click();
  await yaml().fill('nodes:\n  - id: a\n    type: aws.compute.EC2\n  bad: [unclosed');
  // The inline parse error appears; the app shell stays mounted and responsive.
  await expect(win.locator('.code__error')).toBeVisible();
  await expect(win.locator('.app')).toBeVisible();

  // Fixing the YAML clears the error and returning to split still works.
  await yaml().fill('nodes:\n  - id: a\n    type: aws.compute.EC2\nedges: []\nclusters: []\nannotations: []');
  await expect(win.locator('.code__error')).toHaveCount(0);
  await win.locator('[data-testid="view-split"]').click();
  await expect(canvas()).toBeVisible();
  await expect(yaml()).toBeVisible();
});
