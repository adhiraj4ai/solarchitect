import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { join } from 'node:path';

const MAIN = join(process.cwd(), 'out/main/index.js');

let app: ElectronApplication;
let win: Page;

const EMPTY = 'nodes: []\nedges: []\nclusters: []\nannotations: []\n';

test.beforeAll(async () => {
  app = await electron.launch({ args: [MAIN] });
  win = await app.firstWindow();
  await win.locator('[data-testid="canvas-drop"]').waitFor({ timeout: 15_000 });
});

test.afterAll(async () => {
  await app.close();
});

const editor = () => win.locator('textarea[aria-label="Diagram YAML"]');
const canvas = () => win.locator('[data-testid="canvas-drop"]');
const undo = () => win.locator('[data-testid="undo-btn"]');
const redo = () => win.locator('[data-testid="redo-btn"]');

// Reset to an empty diagram and let the history commit settle before each test.
test.beforeEach(async () => {
  await editor().fill(EMPTY);
  await win.waitForTimeout(400);
});

test('undo and redo a canvas edit (dropped node)', async () => {
  const dt = await win.evaluateHandle(() => new DataTransfer());
  await win.locator('text=EC2').first().dispatchEvent('dragstart', { dataTransfer: dt });
  const box = await canvas().boundingBox();
  if (!box) throw new Error('no box');
  await canvas().dispatchEvent('drop', { dataTransfer: dt, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 });

  await expect(editor()).toHaveValue(/type: aws\.compute\.EC2/);
  await win.waitForTimeout(400); // let the drop commit to history

  await undo().click();
  await expect(editor()).not.toHaveValue(/type: aws\.compute\.EC2/);

  await redo().click();
  await expect(editor()).toHaveValue(/type: aws\.compute\.EC2/);
});

test('undo a YAML label edit reverts to the previous label', async () => {
  await editor().fill(`nodes:
  - id: n1
    type: aws.compute.EC2
    label: FirstLabel
    x: 100
    y: 100
edges: []
clusters: []
annotations: []
`);
  await expect(canvas().getByText('FirstLabel')).toBeVisible();
  await win.waitForTimeout(400);

  await editor().fill(`nodes:
  - id: n1
    type: aws.compute.EC2
    label: SecondLabel
    x: 100
    y: 100
edges: []
clusters: []
annotations: []
`);
  await expect(canvas().getByText('SecondLabel')).toBeVisible();
  await win.waitForTimeout(400);

  await undo().click();
  await expect(editor()).toHaveValue(/label: FirstLabel/);
  await expect(canvas().getByText('FirstLabel')).toBeVisible();
});

test('undo a cluster grouping action', async () => {
  await editor().fill(`nodes:
  - id: n1
    type: aws.compute.EC2
    label: GroupA
    x: 100
    y: 120
  - id: n2
    type: aws.database.RDS
    label: GroupB
    x: 340
    y: 120
edges: []
clusters: []
annotations: []
`);
  await expect(canvas().getByText('GroupA')).toBeVisible();
  await win.waitForTimeout(400);

  // Select both nodes and group them.
  await canvas().getByText('GroupA', { exact: true }).first().click();
  await canvas().getByText('GroupB', { exact: true }).first().click({ modifiers: ['Shift'] });
  await win.locator('[data-testid="group-btn"]').click();
  await expect(editor()).toHaveValue(/clusters:\n  -/);
  await win.waitForTimeout(400);

  await undo().click();
  await expect(editor()).toHaveValue(/clusters: \[\]/);
});

test('undo an annotation edit', async () => {
  await editor().fill(`nodes: []
edges: []
clusters: []
annotations:
  - id: a1
    kind: sticky
    x: 80
    y: 120
    width: 160
    height: 100
    content: OriginalNote
`);
  await expect(canvas()).toContainText('OriginalNote');
  await win.waitForTimeout(400);

  await editor().fill(`nodes: []
edges: []
clusters: []
annotations:
  - id: a1
    kind: sticky
    x: 80
    y: 120
    width: 160
    height: 100
    content: ChangedNote
`);
  await expect(editor()).toHaveValue(/content: ChangedNote/);
  await win.waitForTimeout(400);

  await undo().click();
  await expect(editor()).toHaveValue(/content: OriginalNote/);
});

test('a single YAML edit changing multiple elements undoes as one step', async () => {
  await editor().fill(`nodes:
  - id: n1
    type: aws.compute.EC2
    label: Alpha
    x: 100
    y: 100
  - id: n2
    type: aws.database.RDS
    label: Beta
    x: 320
    y: 100
edges:
  - id: e1
    from: n1
    to: n2
    direction: forward
clusters: []
annotations: []
`);
  await expect(canvas().getByText('Alpha')).toBeVisible();
  await win.waitForTimeout(400);

  // One undo removes all three elements (2 nodes + 1 edge) at once.
  await undo().click();
  await expect(editor()).toHaveValue(/nodes: \[\]/);
  await expect(editor()).toHaveValue(/edges: \[\]/);
});
