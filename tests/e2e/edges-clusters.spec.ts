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

const editor = () => win.locator('textarea[aria-label="Diagram YAML"]');
const canvas = () => win.locator('[data-testid="canvas-drop"]');

const TWO_NODES = `nodes:
  - id: n1
    type: aws.compute.EC2
    label: WebTier
    x: 100
    y: 120
  - id: n2
    type: aws.database.RDS
    label: DataTier
    x: 400
    y: 120
edges: []
clusters: []
annotations: []
`;

// Focus the canvas and select every shape on it (tldraw select-all is Cmd+A on macOS).
async function selectAllOnCanvas() {
  await canvas().click({ position: { x: 250, y: 420 } });
  await win.keyboard.press('Meta+a');
}

test('connecting two selected nodes adds an edge to the YAML', async () => {
  await editor().fill(TWO_NODES);
  await expect(canvas().getByText('WebTier')).toBeVisible();
  await expect(canvas().getByText('DataTier')).toBeVisible();

  await selectAllOnCanvas();
  await win.locator('[data-testid="connect-btn"]').click();

  await expect(editor()).toHaveValue(/from: n1/);
  await expect(editor()).toHaveValue(/to: n2/);
});

test('an edge label can be set from the canvas', async () => {
  await editor().fill(TWO_NODES);
  await expect(canvas().getByText('WebTier')).toBeVisible();

  await selectAllOnCanvas();
  await win.locator('[data-testid="connect-btn"]').click();

  // The new edge is auto-selected, so its label input appears.
  const labelInput = win.locator('[data-testid="edge-label-input"]');
  await expect(labelInput).toBeVisible();
  await labelInput.fill('depends on');

  await expect(editor()).toHaveValue(/label: depends on/);
});

test('grouping selected nodes adds a cluster and sets clusterId', async () => {
  await editor().fill(TWO_NODES);
  await expect(canvas().getByText('WebTier')).toBeVisible();

  await selectAllOnCanvas();
  await win.locator('[data-testid="group-btn"]').click();

  await expect(editor()).toHaveValue(/clusters:/);
  await expect(editor()).toHaveValue(/label: New cluster/);
  await expect(editor()).toHaveValue(/clusterId: cluster-/);
});

test('an edge typed in YAML renders on the canvas (with its label)', async () => {
  await editor().fill(`nodes:
  - id: n1
    type: aws.compute.EC2
    label: FromNode
    x: 100
    y: 120
  - id: n2
    type: aws.database.RDS
    label: ToNode
    x: 400
    y: 120
edges:
  - id: e1
    from: n1
    to: n2
    direction: forward
    label: writes
clusters: []
annotations: []
`);
  await expect(canvas().getByText('writes')).toBeVisible();
});

test('a cluster typed in YAML renders on the canvas', async () => {
  await editor().fill(`nodes: []
edges: []
clusters:
  - id: c1
    label: ProductionVPC
    x: 40
    y: 40
    width: 500
    height: 300
annotations: []
`);
  await expect(canvas().getByText('ProductionVPC')).toBeVisible();
});
