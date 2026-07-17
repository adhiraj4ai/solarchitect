import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAIN = join(process.cwd(), 'out/main/index.js');

let app: ElectronApplication;
let win: Page;
let projectDir: string;

const SEED = `nodes:
  - id: n1
    type: aws.compute.EC2
    label: PersistedNode
    x: 220
    y: 160
edges: []
clusters: []
annotations: []
`;

test.beforeAll(async () => {
  projectDir = await mkdtemp(join(tmpdir(), 'solarchitect-e2e-'));
  await writeFile(join(projectDir, 'seed.yaml'), SEED);
  await writeFile(join(projectDir, 'broken.yaml'), 'nodes: [this is not: valid yaml');

  app = await electron.launch({ args: [MAIN] });
  // The folder picker is a native dialog Playwright can't drive; stub it in main.
  await app.evaluate(async ({ dialog }, dir) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [dir] });
  }, projectDir);
  win = await app.firstWindow();
  await win.locator('[data-testid="canvas-drop"]').waitFor({ timeout: 15_000 });
  // Persisted sidebar layout can carry over from a prior spec; reset so the
  // Project panel (with the diagram list) is the one showing.
  await win.evaluate(() => localStorage.clear());
  await win.reload();
  await win.locator('[data-testid="canvas-drop"]').waitFor({ timeout: 15_000 });
});

test.afterAll(async () => {
  await app.close();
  await rm(projectDir, { recursive: true, force: true });
});

const editor = () => win.locator('textarea[aria-label="Diagram YAML"]');
const canvas = () => win.locator('[data-testid="canvas-drop"]');
const list = () => win.locator('[data-testid="document-list"]');

test('opening a project lists its diagrams and marks a corrupt one as errored', async () => {
  await win.locator('[data-testid="open-project-btn"]').click();
  await expect(list().getByText('seed.yaml')).toBeVisible();
  const broken = list().getByText('broken.yaml');
  await expect(broken).toBeVisible();
  await expect(broken).toBeDisabled(); // errored entry can't be opened
});

test('opening a diagram restores its nodes and positions from disk', async () => {
  await list().getByText('seed.yaml').click();
  await expect(canvas().getByText('PersistedNode')).toBeVisible();
  await expect(editor()).toHaveValue(/label: PersistedNode/);
  await expect(editor()).toHaveValue(/x: 220/);
});

test('saving writes the current diagram back to a plain YAML file on disk', async () => {
  await list().getByText('seed.yaml').click();
  await expect(editor()).toHaveValue(/label: PersistedNode/);

  const edited = SEED.replace('PersistedNode', 'RenamedNode');
  await editor().fill(edited);
  await expect(canvas().getByText('RenamedNode')).toBeVisible();

  await win.locator('[data-testid="save-btn"]').click();
  await expect.poll(async () => readFile(join(projectDir, 'seed.yaml'), 'utf-8')).toContain('RenamedNode');
});

test('a newly created diagram is added to the project and persisted', async () => {
  await win.locator('[data-testid="new-document-btn"]').click();
  await win.locator('[data-testid="new-diagram"]').click();
  // A new untitled file appears and becomes current.
  await expect(list().getByText('untitled.yaml')).toBeVisible();
  const file = await readFile(join(projectDir, 'untitled.yaml'), 'utf-8');
  expect(file).toContain('nodes: []');
});
