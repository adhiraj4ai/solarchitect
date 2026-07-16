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

const diagramCanvas = () => win.locator('[data-testid="canvas-drop"]');
const whiteboard = () => win.locator('[data-testid="whiteboard"]');

test('defaults to the Diagram surface', async () => {
  await expect(win.locator('[data-testid="surface-diagram"]')).toHaveAttribute('aria-selected', 'true');
  await expect(diagramCanvas()).toBeVisible();
  await expect(whiteboard()).toHaveCount(0);
});

test('switching to Whiteboard shows a separate freeform canvas', async () => {
  await win.locator('[data-testid="surface-whiteboard"]').click();
  await expect(whiteboard()).toBeVisible();
  // The structured diagram canvas is not present on the whiteboard surface.
  await expect(diagramCanvas()).toHaveCount(0);
  // Visual/Split/Code is a Diagram-only control — hidden on the whiteboard.
  await expect(win.locator('[data-testid="view-split"]')).toHaveCount(0);
});

test('switching back to Diagram restores the structured canvas', async () => {
  await win.locator('[data-testid="surface-diagram"]').click();
  await expect(diagramCanvas()).toBeVisible();
  await expect(whiteboard()).toHaveCount(0);
  await expect(win.locator('[data-testid="view-split"]')).toBeVisible();
});

test('the whiteboard shows a read-only diagram backdrop that toggles', async () => {
  // Give the diagram some content, then open the whiteboard.
  await win.locator('[data-testid="surface-diagram"]').click();
  await win.locator('textarea[aria-label="Diagram YAML"]').fill(`nodes:
  - id: a
    type: aws.compute.EC2
    label: API
    x: 200
    y: 260
edges: []
clusters: []
`);
  // Wait for the node to reach the diagram (past the editor debounce) before
  // opening the whiteboard, so the backdrop has content to render.
  await expect(diagramCanvas().getByText('API')).toBeVisible();
  await win.locator('[data-testid="surface-whiteboard"]').click();
  await expect(win.locator('.wb-backdrop')).toBeVisible();

  await win.locator('[data-testid="backdrop-toggle"]').click(); // hide
  await expect(win.locator('.wb-backdrop')).toHaveCount(0);
  await win.locator('[data-testid="backdrop-toggle"]').click(); // show
  await expect(win.locator('.wb-backdrop')).toBeVisible();
});
