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

test('the shell boots with an empty diagram and a full palette', async () => {
  await expect(yaml()).toHaveValue(/nodes: \[\]/);
  await expect(win.locator('text=EC2')).toBeVisible();
  await expect(win.locator('text=Compute Engine')).toBeVisible();
});

test('dragging a palette node onto the canvas adds it to the YAML', async () => {
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
