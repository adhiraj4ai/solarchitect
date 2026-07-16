import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { join } from 'node:path';

const MAIN = join(process.cwd(), 'out/main/index.js');

let app: ElectronApplication;
let win: Page;

test.beforeAll(async () => {
  app = await electron.launch({ args: [MAIN] });
  win = await app.firstWindow();
  await win.locator('[data-testid="canvas-drop"]').waitFor({ timeout: 15_000 });
  // Sidebar layout persists across launches; start from a known state, then open
  // the Shapes panel (one panel shows at a time in the activity-bar shell).
  await win.evaluate(() => localStorage.clear());
  await win.reload();
  await win.locator('[data-testid="canvas-drop"]').waitFor({ timeout: 15_000 });
  await win.locator('[data-testid="activity-shapes"]').click();
});

test.afterAll(async () => {
  await app.close();
});

const yaml = () => win.locator('textarea[aria-label="Diagram YAML"]');
const search = () => win.locator('input[aria-label="Search shapes"]');

test('the shell boots with an empty diagram and collapsed categories', async () => {
  await expect(yaml()).toHaveValue(/nodes: \[\]/);
  // Categories are collapsed by default: the AWS group header shows, its tiles don't.
  await expect(win.locator('[data-testid="lib-group-aws"]')).toBeVisible();
  await expect(win.locator('text=EC2')).toHaveCount(0);
});

test('searching expands matching categories and reveals shapes', async () => {
  await search().fill('EC2');
  await expect(win.locator('text=EC2')).toBeVisible();
  await search().fill('');
  await expect(win.locator('text=EC2')).toHaveCount(0);
});

test('clicking a category header expands it', async () => {
  await win.locator('[data-testid="lib-group-aws"]').click();
  await expect(win.locator('text=EC2')).toBeVisible();
});

test('dragging a palette node onto the canvas adds it to the YAML', async () => {
  // AWS is expanded from the previous test; EC2 tile is present.
  const dataTransfer = await win.evaluateHandle(() => new DataTransfer());
  await win.locator('text=EC2').first().dispatchEvent('dragstart', { dataTransfer });

  const drop = win.locator('[data-testid="canvas-drop"]');
  const box = await drop.boundingBox();
  if (!box) throw new Error('drop target has no bounding box');
  await drop.dispatchEvent('drop', {
    dataTransfer,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
  });

  await expect(yaml()).toHaveValue(/type: aws\.compute\.EC2/);
  await expect(yaml()).toHaveValue(/label: EC2/);
  // Node id and a numeric position are present (position preserved, not stripped).
  await expect(yaml()).toHaveValue(/id: node-/);
  await expect(yaml()).toHaveValue(/x: -?\d+/);
});
