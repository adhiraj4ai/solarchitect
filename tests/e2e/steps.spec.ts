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

const CHAIN = `nodes:
  - id: a
    type: aws.compute.EC2
    label: Alpha
    x: 60
    y: 60
  - id: b
    type: aws.database.RDS
    label: Bravo
    x: 320
    y: 60
  - id: c
    type: aws.storage.S3
    label: Charlie
    x: 580
    y: 60
edges:
  - id: e1
    from: a
    to: b
  - id: e2
    from: b
    to: c
clusters: []
annotations: []
`;

test('Steps toggle overlays the resolved traversal order as badges', async () => {
  await editor().fill(CHAIN);
  await expect(canvas().getByText('Alpha')).toBeVisible();

  // Badges are hidden until Steps is toggled on.
  await expect(win.locator('.canvas.steps-on')).toHaveCount(0);
  await win.locator('[data-testid="steps-toggle"]').click();
  await expect(win.locator('.canvas.steps-on')).toHaveCount(1);

  // Node badges reflect depth from the source: a=0, b=1, c=2.
  const nodeBadges = win.locator('.arch-node .arch-step-badge');
  await expect(nodeBadges).toHaveCount(3);
  await expect(nodeBadges.filter({ hasText: '0' })).toHaveCount(1);
  await expect(nodeBadges.filter({ hasText: '2' })).toHaveCount(1);
});

test('an explicit node step overrides the derived order', async () => {
  await editor().fill(CHAIN.replace('    label: Bravo\n', '    label: Bravo\n    step: 5\n'));
  await expect(canvas().getByText('Bravo')).toBeVisible();
  await win.locator('[data-testid="steps-toggle"]').click(); // ensure on

  // b is pinned to step 5 regardless of its topological depth (1).
  await expect(win.locator('.arch-node .arch-step-badge').filter({ hasText: '5' })).toHaveCount(1);
});
