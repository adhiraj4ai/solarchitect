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

test('nodes without x/y are auto-laid-out and render', async () => {
  await yaml().fill(`nodes:
  - id: a
    type: aws.compute.EC2
    label: Alpha
  - id: b
    type: aws.database.RDS
    label: Beta
edges:
  - id: e1
    from: a
    to: b
    direction: forward
clusters: []
annotations: []
`);
  // Both coordinate-free nodes render on the canvas without error.
  await expect(canvas().getByText('Alpha')).toBeVisible();
  await expect(canvas().getByText('Beta')).toBeVisible();
  // The app stays alive (no crash from missing coordinates).
  await expect(win.locator('.app')).toBeVisible();
});

test('coordinate-free nodes stay coordinate-free in YAML until moved', async () => {
  // A YAML-only round-trip must not inject x/y the user never wrote.
  await yaml().fill(`nodes:
  - id: a
    type: aws.compute.EC2
    label: Alpha
edges: []
clusters: []
annotations: []
`);
  await expect(canvas().getByText('Alpha')).toBeVisible();
  await expect(yaml()).not.toHaveValue(/x:/);
});
