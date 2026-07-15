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

test('adding a prebuilt frame writes it to the YAML', async () => {
  await win.locator('[data-testid="add-frame-btn"]').click();
  await win.locator('[data-testid="add-frame-a4-landscape"]').click();

  await expect(yaml()).toHaveValue(/frames:/);
  await expect(yaml()).toHaveValue(/label: A4 Landscape/);
  await expect(yaml()).toHaveValue(/preset: a4-landscape/);
  await expect(yaml()).toHaveValue(/width: 1123/);
});

test('a frame typed in YAML renders on the canvas', async () => {
  await yaml().fill(`nodes: []
edges: []
clusters: []
annotations: []
frames:
  - id: f1
    label: Poster
    x: 40
    y: 40
    width: 800
    height: 600
    preset: custom
`);
  await expect(win.locator('[data-testid="canvas-drop"]').getByText('Poster')).toBeVisible();
});
