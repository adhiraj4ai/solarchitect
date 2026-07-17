import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAIN = join(process.cwd(), 'out/main/index.js');

let app: ElectronApplication;
let win: Page;
let projectDir: string;

test.beforeAll(async () => {
  projectDir = await mkdtemp(join(tmpdir(), 'solarchitect-md-'));
  app = await electron.launch({ args: [MAIN] });
  await app.evaluate(async ({ dialog }, dir) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [dir] });
  }, projectDir);
  win = await app.firstWindow();
  await win.locator('[data-testid="canvas-drop"]').waitFor({ timeout: 15_000 });
  await win.evaluate(() => localStorage.clear());
  await win.reload();
  await win.locator('[data-testid="canvas-drop"]').waitFor({ timeout: 15_000 });

  await win.locator('[data-testid="new-project-btn"]').click();
  await win.locator('[data-testid="new-document-btn"]').click();
  await win.locator('[data-testid="new-markdown"]').click();
  await expect(win.locator('[data-testid="markdown"]')).toBeVisible();
});

test.afterAll(async () => {
  await app.close();
  await rm(projectDir, { recursive: true, force: true });
});

const source = () => win.locator('[data-testid="markdown-source"]');
const preview = () => win.locator('[data-testid="markdown-preview"]');
const list = () => win.locator('[data-testid="document-list"]');

test('the markdown editor renders source as preview and offers Preview/Split/Source', async () => {
  await expect(win.locator('[data-testid="md-view-split"]')).toBeVisible();
  await source().fill('# Hello\n\nSome **bold** text.');
  await expect(preview().locator('h1')).toHaveText('Hello');
  await expect(preview().locator('strong')).toHaveText('bold');
});

test('the Outline lists the markdown headings', async () => {
  await source().fill('# Overview\n\n## Auth\n\n## Data\n');
  await win.locator('[data-testid="activity-outline"]').click();
  await expect(win.locator('[data-testid="outline-h-overview"]')).toBeVisible();
  await expect(win.locator('[data-testid="outline-h-auth"]')).toBeVisible();
  await expect(win.locator('[data-testid="outline-h-data"]')).toBeVisible();
  // Shapes/Templates are diagram-only and absent for a markdown document.
  await expect(win.locator('[data-testid="activity-shapes"]')).toHaveCount(0);
  await expect(win.locator('[data-testid="activity-templates"]')).toHaveCount(0);
});

test('markdown autosaves and persists across reopen', async () => {
  await win.locator('[data-testid="activity-project"]').click();
  await source().fill('# Persisted Heading\n\nbody text\n');
  // MarkdownView autosaves on a short debounce; wait, then confirm on disk.
  await expect
    .poll(async () => readFile(join(projectDir, 'untitled.md'), 'utf-8'), { timeout: 5000 })
    .toContain('Persisted Heading');

  // Switch to another document and back to force a reload from disk.
  await win.locator('[data-testid="new-document-btn"]').click();
  await win.locator('[data-testid="new-diagram"]').click();
  await expect(win.locator('[data-testid="canvas-drop"]')).toBeVisible();

  await list().getByText('untitled.md').click();
  await expect(preview().locator('h1')).toHaveText('Persisted Heading');
});
