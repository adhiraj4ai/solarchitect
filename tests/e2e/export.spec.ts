import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, rm, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAIN = join(process.cwd(), 'out/main/index.js');

let app: ElectronApplication;
let win: Page;
let dir: string;

const ONE_NODE = `nodes:
  - id: n1
    type: aws.compute.EC2
    label: ExportMe
    x: 120
    y: 140
edges: []
clusters: []
annotations: []
`;

test.beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'solarchitect-exp-'));
  app = await electron.launch({ args: [MAIN] });
  win = await app.firstWindow();
  await win.locator('[data-testid="canvas-drop"]').waitFor({ timeout: 15_000 });
  await win.locator('textarea[aria-label="Diagram YAML"]').fill(ONE_NODE);
  await win.locator('[data-testid="canvas-drop"]').getByText('ExportMe').waitFor();
});

test.afterAll(async () => {
  await app.close();
  await rm(dir, { recursive: true, force: true });
});

async function fileExists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

test('Export PNG writes a valid PNG file to the chosen path', async () => {
  const target = join(dir, 'diagram.png');
  await app.evaluate(async ({ dialog }, p) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: p });
  }, target);

  await win.locator('[data-testid="export-btn"]').click();
  await win.locator('[data-testid="export-png-btn"]').click();
  await expect.poll(() => fileExists(target), { timeout: 10_000 }).toBe(true);

  const bytes = await readFile(target);
  // PNG magic number: 89 50 4E 47.
  expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
});

test('Export SVG writes a valid SVG file to the chosen path', async () => {
  const target = join(dir, 'diagram.svg');
  await app.evaluate(async ({ dialog }, p) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: p });
  }, target);

  await win.locator('[data-testid="export-btn"]').click();
  await win.locator('[data-testid="export-svg-btn"]').click();
  await expect.poll(() => fileExists(target), { timeout: 10_000 }).toBe(true);

  const text = (await readFile(target)).toString('utf-8');
  expect(text).toContain('<svg');
});

test('Export animated GIF writes a valid multi-frame GIF to the chosen path', async () => {
  const target = join(dir, 'diagram.gif');
  await app.evaluate(async ({ dialog }, p) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: p });
  }, target);

  await win.locator('[data-testid="export-btn"]').click();
  await win.locator('[data-testid="export-gif-btn"]').click();
  await win.locator('[data-testid="gif-dialog"]').waitFor({ state: 'visible' });
  await win.locator('[data-testid="gif-fps"]').fill('8');
  await win.locator('[data-testid="gif-export-confirm"]').click();

  await expect.poll(() => fileExists(target), { timeout: 30_000 }).toBe(true);

  const bytes = await readFile(target);
  // GIF89a magic number.
  expect(bytes.subarray(0, 6).toString('ascii')).toBe('GIF89a');
  // Animated GIFs carry more than one image-descriptor block (0x2C).
  expect([...bytes].filter((b) => b === 0x2c).length).toBeGreaterThan(1);
});
