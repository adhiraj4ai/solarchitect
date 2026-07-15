import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAIN = join(process.cwd(), 'out/main/index.js');

let app: ElectronApplication;
let win: Page;
let projectDir: string;

const TWO_NODES = `nodes:
  - id: n1
    type: aws.compute.EC2
    label: WebTier
    x: 120
    y: 140
  - id: n2
    type: aws.database.RDS
    label: DataTier
    x: 360
    y: 140
edges: []
clusters: []
annotations: []
`;

test.beforeAll(async () => {
  projectDir = await mkdtemp(join(tmpdir(), 'solarchitect-tpl-'));
  app = await electron.launch({ args: [MAIN] });
  await app.evaluate(async ({ dialog }, dir) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [dir] });
  }, projectDir);
  win = await app.firstWindow();
  await win.locator('[data-testid="canvas-drop"]').waitFor({ timeout: 15_000 });
  await win.locator('[data-testid="open-project-btn"]').click();
});

test.afterAll(async () => {
  await app.close();
  await rm(projectDir, { recursive: true, force: true });
});

const editor = () => win.locator('textarea[aria-label="Diagram YAML"]');
const canvas = () => win.locator('[data-testid="canvas-drop"]');

async function selectNodes(...labels: string[]) {
  await win.keyboard.press('Escape');
  for (let i = 0; i < labels.length; i++) {
    await canvas()
      .getByText(labels[i], { exact: true })
      .first()
      .click(i === 0 ? {} : { modifiers: ['Shift'] });
  }
}

test('saving a selection as a template adds it to the templates panel', async () => {
  await editor().fill(TWO_NODES);
  await expect(canvas().getByText('WebTier')).toBeVisible();

  await selectNodes('WebTier', 'DataTier');
  await win.locator('[data-testid="save-template-btn"]').click();
  await win.locator('[data-testid="template-name-input"]').fill('VPC Pair');
  await win.locator('[data-testid="template-save-btn"]').click();

  await expect(win.locator('[data-testid="templates-list"]').getByText('VPC Pair')).toBeVisible();
});

test('dragging a template onto the canvas instantiates it with fresh ids', async () => {
  // Start from a single pre-existing node so we can see the template add two more.
  await editor().fill(TWO_NODES);
  await expect(canvas().getByText('WebTier')).toHaveCount(1);

  const dt = await win.evaluateHandle(() => new DataTransfer());
  await win.locator('[data-testid="templates-list"]').getByText('VPC Pair').dispatchEvent('dragstart', {
    dataTransfer: dt,
  });
  const box = await canvas().boundingBox();
  if (!box) throw new Error('no canvas box');
  await canvas().dispatchEvent('drop', {
    dataTransfer: dt,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height * 0.7,
  });

  // The template (WebTier + DataTier) is added alongside the originals.
  await expect(canvas().getByText('WebTier')).toHaveCount(2);
  await expect(canvas().getByText('DataTier')).toHaveCount(2);
});

test('saving under an existing name asks to overwrite rather than duplicating', async () => {
  await editor().fill(TWO_NODES);
  // Wait for the reset to settle (prior test left extra nodes) before selecting,
  // else a mid-selection reconcile deselects and the modal never opens.
  await expect(canvas().getByText('WebTier')).toHaveCount(1);
  await selectNodes('WebTier', 'DataTier');
  await win.locator('[data-testid="save-template-btn"]').click();
  await win.locator('[data-testid="template-name-input"]').fill('VPC Pair');
  await win.locator('[data-testid="template-save-btn"]').click();

  // Conflict: a warning appears instead of saving immediately.
  await expect(win.locator('[data-testid="overwrite-warning"]')).toBeVisible();
  await win.locator('[data-testid="template-save-btn"]').click(); // confirm overwrite

  // Still exactly one template with that name.
  await expect(win.locator('[data-testid="templates-list"]').getByText('VPC Pair')).toHaveCount(1);
});
