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

test('assigning a color to a selected node writes it to the YAML', async () => {
  await yaml().fill(`nodes:
  - id: a
    type: aws.compute.EC2
    label: API
    x: 240
    y: 240
edges: []
clusters: []
annotations: []
`);
  await canvas().getByText('API').click();
  await expect(win.locator('[data-testid="props-panel"]')).toBeVisible();
  await win.locator('[data-testid="color-violet"]').click();
  await expect(yaml()).toHaveValue(/color: violet/);

  // The "black & white" option clears it again.
  await win.locator('[data-testid="color-none"]').click();
  await expect(yaml()).not.toHaveValue(/color:/);
});

test('multi-selecting nodes colors all of them at once', async () => {
  await yaml().fill(`nodes:
  - id: a
    type: aws.compute.EC2
    label: One
    x: 200
    y: 240
  - id: b
    type: aws.database.RDS
    label: Two
    x: 460
    y: 240
edges: []
clusters: []
annotations: []
`);
  await win.locator('[data-testid="view-visual"]').click(); // wider canvas for two nodes
  // exact:true — a plain getByText('One') also matches the properties-panel title
  // "Component" (case-insensitive substring), which lingers from a prior test.
  const one = await canvas().getByText('One', { exact: true }).boundingBox();
  const two = await canvas().getByText('Two', { exact: true }).boundingBox();
  if (!one || !two) throw new Error('nodes not rendered');
  // Marquee-drag from empty space above-left of both nodes to below-right,
  // selecting both (brush selection — starts on empty canvas).
  const x1 = Math.min(one.x, two.x) - 60;
  const y1 = Math.min(one.y, two.y) - 60;
  const x2 = Math.max(one.x + one.width, two.x + two.width) + 60;
  const y2 = Math.max(one.y + one.height, two.y + two.height) + 60;
  await win.mouse.move(x1, y1);
  await win.mouse.down();
  await win.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 6 });
  await win.mouse.move(x2, y2, { steps: 6 });
  await win.mouse.up();
  await expect(win.locator('[data-testid="props-panel-multi"]')).toBeVisible();
  await win.locator('[data-testid="props-panel-multi"] [data-testid="color-amber"]').click();

  // Back to split to read the source (Visual mode unmounts the editor).
  await win.locator('[data-testid="view-split"]').click();
  // Both nodes gained the color (serializer sorts keys, so assert two matches).
  await expect(yaml()).toHaveValue(/color: amber[\s\S]*color: amber/);
});
