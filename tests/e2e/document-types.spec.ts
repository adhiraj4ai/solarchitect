import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAIN = join(process.cwd(), 'out/main/index.js');

let app: ElectronApplication;
let win: Page;
let projectDir: string;

test.beforeAll(async () => {
  projectDir = await mkdtemp(join(tmpdir(), 'solarchitect-doctypes-'));
  app = await electron.launch({ args: [MAIN] });
  // The folder picker is a native dialog Playwright can't drive; stub it in main.
  await app.evaluate(async ({ dialog }, dir) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [dir] });
  }, projectDir);
  win = await app.firstWindow();
  await win.locator('[data-testid="canvas-drop"]').waitFor({ timeout: 15_000 });
  await win.evaluate(() => localStorage.clear());
  await win.reload();
  await win.locator('[data-testid="canvas-drop"]').waitFor({ timeout: 15_000 });
});

test.afterAll(async () => {
  await app.close();
  await rm(projectDir, { recursive: true, force: true });
});

const list = () => win.locator('[data-testid="document-list"]');

test('a newly created project is empty and prompts New', async () => {
  await win.locator('[data-testid="new-project-btn"]').click();
  await expect(win.locator('[data-testid="project-empty"]')).toBeVisible();
  await expect(win.locator('[data-testid="no-document"]')).toBeVisible();
});

test('the New menu creates a diagram that opens the diagram editor', async () => {
  await win.locator('[data-testid="new-document-btn"]').click();
  await win.locator('[data-testid="new-diagram"]').click();

  await expect(win.locator('[data-testid="canvas-drop"]')).toBeVisible();
  await expect(win.locator('[data-testid="doctype-diagram"]')).toBeVisible();
  // Visual/Split/Code is a diagram-only control.
  await expect(win.locator('[data-testid="view-split"]')).toBeVisible();
  await expect(list().getByText('untitled.yaml')).toBeVisible();
});

test('the New menu creates a whiteboard that opens the freeform editor — no surface toggle', async () => {
  await win.locator('[data-testid="new-document-btn"]').click();
  await win.locator('[data-testid="new-whiteboard"]').click();

  await expect(win.locator('[data-testid="whiteboard"]')).toBeVisible();
  await expect(win.locator('[data-testid="doctype-whiteboard"]')).toBeVisible();
  // The diagram-only controls are absent on a whiteboard document...
  await expect(win.locator('[data-testid="view-split"]')).toHaveCount(0);
  await expect(win.locator('[data-testid="activity-shapes"]')).toHaveCount(0);
  await expect(win.locator('[data-testid="activity-templates"]')).toHaveCount(0);
  // ...and the old Diagram|Whiteboard surface toggle no longer exists.
  await expect(win.locator('[data-testid="surface-architect"]')).toHaveCount(0);
  await expect(win.locator('[data-testid="surface-whiteboard"]')).toHaveCount(0);

  await expect(list().getByText('untitled.whiteboard.json')).toBeVisible();
});

test('the document list groups the two types', async () => {
  await expect(win.locator('[data-testid="group-diagram"]')).toContainText('untitled.yaml');
  await expect(win.locator('[data-testid="group-whiteboard"]')).toContainText('untitled.whiteboard.json');
});
