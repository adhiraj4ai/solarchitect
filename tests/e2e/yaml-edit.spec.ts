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

function docWith(label: string, type = 'aws.compute.EC2'): string {
  return `nodes:
  - id: n1
    type: ${type}
    label: ${label}
    x: 120
    y: 120
edges: []
clusters: []
annotations: []
`;
}

test('a valid YAML edit renders the node on the canvas', async () => {
  await editor().fill(docWith('AlphaServer'));
  await expect(canvas().getByText('AlphaServer')).toBeVisible();
});

test('invalid YAML freezes the canvas and shows an inline error', async () => {
  await editor().fill(docWith('FrozenServer'));
  await expect(canvas().getByText('FrozenServer')).toBeVisible();

  // Unknown node type — a validation error.
  await editor().fill(docWith('FrozenServer', 'aws.compute.NotReal'));
  await expect(win.getByRole('alert')).toContainText(/Unknown node type/);
  // Frozen: the last-valid node is still on the canvas.
  await expect(canvas().getByText('FrozenServer')).toBeVisible();
});

test('fixing the error resumes live sync automatically', async () => {
  await editor().fill(docWith('BeforeFix'));
  await expect(canvas().getByText('BeforeFix')).toBeVisible();

  await editor().fill('nodes: [broken');
  await expect(win.getByRole('alert')).toContainText(/YAML syntax error/);
  // Frozen under a pure syntax error too: the last-valid node stays on the canvas.
  await expect(canvas().getByText('BeforeFix')).toBeVisible();

  await editor().fill(docWith('AfterFix'));
  await expect(win.getByRole('alert')).toHaveCount(0);
  await expect(canvas().getByText('AfterFix')).toBeVisible();
});
