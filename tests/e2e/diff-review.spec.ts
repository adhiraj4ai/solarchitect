import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { openPanel } from './helpers';

const run = promisify(execFile);
const MAIN = join(process.cwd(), 'out/main/index.js');

let app: ElectronApplication;
let win: Page;
let projectDir: string;

const SEED = `nodes:
  - id: n1
    type: aws.compute.EC2
    label: SeedNode
    x: 200
    y: 160
edges: []
clusters: []
`;

// A committed diagram is the baseline the review compares the working tree against.
test.beforeAll(async () => {
  projectDir = await mkdtemp(join(tmpdir(), 'solarchitect-diff-'));
  await run('git', ['init'], { cwd: projectDir });
  await run('git', ['config', 'user.email', 'test@example.com'], { cwd: projectDir });
  await run('git', ['config', 'user.name', 'Test'], { cwd: projectDir });
  await writeFile(join(projectDir, 'seed.yaml'), SEED);
  await run('git', ['add', '.'], { cwd: projectDir });
  await run('git', ['commit', '-m', 'seed'], { cwd: projectDir });

  app = await electron.launch({ args: [MAIN] });
  await app.evaluate(async ({ dialog }, dir) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [dir] });
  }, projectDir);
  win = await app.firstWindow();
  await win.locator('[data-testid="canvas-drop"]').waitFor({ timeout: 15_000 });
  await win.evaluate(() => localStorage.clear());
  await win.reload();
  await win.locator('[data-testid="canvas-drop"]').waitFor({ timeout: 15_000 });

  // Open the project and its committed diagram.
  await win.locator('[data-testid="open-project-btn"]').click();
  await list().getByText('seed.yaml').click();
  await expect(canvas().getByText('SeedNode')).toBeVisible();
});

test.afterAll(async () => {
  await app.close();
  await rm(projectDir, { recursive: true, force: true });
});

const editor = () => win.locator('textarea[aria-label="Diagram YAML"]');
const canvas = () => win.locator('[data-testid="canvas-drop"]');
const list = () => win.locator('[data-testid="document-list"]');

async function openReview() {
  await openPanel(win, 'git');
  const btn = win.locator('[data-testid="git-review-btn"]');
  await expect(btn).toBeEnabled({ timeout: 10_000 });
  await btn.click();
  await expect(win.locator('[data-testid="diff-review"]')).toBeVisible();
}

test('reports no changes when the working tree matches the last commit', async () => {
  // Reset the buffer to the committed content so there is nothing to review.
  await editor().fill(SEED);
  await openReview();
  await expect(win.locator('[data-testid="diff-nochanges"]')).toBeVisible();
  await win.locator('[data-testid="diff-close"]').click();
});

test('shows what changed after editing the open diagram', async () => {
  await editor().fill(SEED.replace('SeedNode', 'ReviewedNode'));
  await expect(canvas().getByText('ReviewedNode')).toBeVisible();

  await openReview();
  // The change list surfaces the relabeled component. Scope to the list: the new
  // label also renders on the compare canvas, so an unscoped match is ambiguous.
  await expect(win.locator('[data-testid="diff-list"]').getByText('ReviewedNode')).toBeVisible();
  await expect(win.locator('[data-testid="diff-row"]').first()).toBeVisible();
  // The semantic-only filter is offered.
  await expect(win.locator('[data-testid="diff-semantic-only"]')).toBeVisible();

  await win.locator('[data-testid="diff-close"]').click();
  await expect(win.locator('[data-testid="diff-review"]')).toHaveCount(0);
});
