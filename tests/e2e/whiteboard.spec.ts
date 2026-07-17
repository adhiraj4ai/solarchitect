import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAIN = join(process.cwd(), 'out/main/index.js');

let app: ElectronApplication;
let win: Page;
let projectDir: string;

test.beforeAll(async () => {
  projectDir = await mkdtemp(join(tmpdir(), 'solarchitect-wb-'));
  app = await electron.launch({ args: [MAIN] });
  await app.evaluate(async ({ dialog }, dir) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [dir] });
  }, projectDir);
  win = await app.firstWindow();
  await win.locator('[data-testid="canvas-drop"]').waitFor({ timeout: 15_000 });
  await win.evaluate(() => localStorage.clear());
  await win.reload();
  await win.locator('[data-testid="canvas-drop"]').waitFor({ timeout: 15_000 });

  // Fresh project with a diagram that has content (to be a backdrop) and a
  // standalone whiteboard.
  await win.locator('[data-testid="new-project-btn"]').click();
  await win.locator('[data-testid="new-document-btn"]').click();
  await win.locator('[data-testid="new-diagram"]').click();
  await win.locator('textarea[aria-label="Diagram YAML"]').fill(`nodes:
  - id: a
    type: aws.compute.EC2
    label: API
    x: 200
    y: 260
edges: []
clusters: []
`);
  await expect(win.locator('[data-testid="canvas-drop"]').getByText('API')).toBeVisible();
  // Autosave is off by default; save the diagram so the backdrop can read it.
  await win.locator('[data-testid="save-btn"]').click();
});

test.afterAll(async () => {
  await app.close();
  await rm(projectDir, { recursive: true, force: true });
});

const list = () => win.locator('[data-testid="document-list"]');

test('a standalone whiteboard can reference a project diagram as backdrop', async () => {
  await win.locator('[data-testid="new-document-btn"]').click();
  await win.locator('[data-testid="new-whiteboard"]').click();
  await expect(win.locator('[data-testid="whiteboard"]')).toBeVisible();

  // No backdrop yet.
  await expect(win.locator('.wb-backdrop')).toHaveCount(0);

  // Pick the diagram as backdrop; it appears beneath the sketch and toggles.
  await win.locator('[data-testid="backdrop-select"]').selectOption('untitled.yaml');
  await expect(win.locator('.wb-backdrop')).toBeVisible();
  await win.locator('[data-testid="backdrop-toggle"]').click(); // hide
  await expect(win.locator('.wb-backdrop')).toHaveCount(0);
  await win.locator('[data-testid="backdrop-toggle"]').click(); // show
  await expect(win.locator('.wb-backdrop')).toBeVisible();
});

test('the backdrop reference persists across reopen', async () => {
  await win.waitForTimeout(700); // let the whiteboard file autosave

  // Reopen by switching to the diagram and back to the whiteboard (remounts it).
  await list().getByText('untitled.yaml').click();
  await expect(win.locator('[data-testid="canvas-drop"]')).toBeVisible();
  await list().getByText('untitled.whiteboard.json').click();
  await expect(win.locator('[data-testid="whiteboard"]')).toBeVisible();

  await expect(win.locator('[data-testid="backdrop-select"]')).toHaveValue('untitled.yaml');
  await expect(win.locator('.wb-backdrop')).toBeVisible();
});
