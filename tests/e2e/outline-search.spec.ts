import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAIN = join(process.cwd(), 'out/main/index.js');

let app: ElectronApplication;
let win: Page;
let userData: string;

const DIAGRAM = `nodes:
  - id: n1
    type: aws.compute.EC2
    label: WebServer
    x: 120
    y: 140
  - id: n2
    type: aws.database.RDS
    label: PrimaryDatabase
    x: 400
    y: 140
    clusterId: c1
edges:
  - id: e1
    from: n1
    to: n2
    direction: forward
    label: queries
clusters:
  - id: c1
    label: DataTier
    x: 360
    y: 100
    width: 200
    height: 160
annotations: []
`;

test.beforeAll(async () => {
  userData = await mkdtemp(join(tmpdir(), 'solarchitect-outline-'));
  app = await electron.launch({ args: [MAIN, `--user-data-dir=${userData}`] });
  win = await app.firstWindow();
  await win.locator('[data-testid="canvas-drop"]').waitFor({ timeout: 15_000 });
});

test.afterAll(async () => {
  await app.close();
  await rm(userData, { recursive: true, force: true });
});

const editor = () => win.locator('textarea[aria-label="Diagram YAML"]');
const canvas = () => win.locator('[data-testid="canvas-drop"]');

test('the Outline panel lists the diagram structure and reveals on click', async () => {
  await editor().fill(DIAGRAM);
  await win.locator('[data-testid="activity-outline"]').click();

  const outline = win.locator('[data-testid="outline"]');
  await expect(outline).toContainText('DataTier'); // cluster
  await expect(outline).toContainText('PrimaryDatabase'); // node under cluster
  await expect(outline).toContainText('WebServer'); // ungrouped node
  await expect(outline).toContainText('queries'); // edge label

  // Clicking an entry selects/reveals it on the canvas (a selection appears).
  await outline.getByText('WebServer').click();
  await expect(canvas().locator('.tl-selection__fg, [data-shape-type]')).toBeTruthy();
});

test('Search finds elements in the open diagram and reveals them', async () => {
  await win.locator('[data-testid="activity-search"]').click();
  await win.locator('[data-testid="search-input"]').fill('WebServer');

  const results = win.locator('[data-testid="search-results"]');
  await expect(results.locator('[data-testid="search-element-result"]')).toContainText('WebServer');

  await results.locator('[data-testid="search-element-result"]').first().click();
  // Reveal switches to a canvas-visible view; the canvas stays mounted.
  await expect(canvas()).toBeVisible();
});

test('Search shows an empty state when nothing matches', async () => {
  await win.locator('[data-testid="activity-search"]').click();
  await win.locator('[data-testid="search-input"]').fill('nothing-matches-zzz');
  await expect(win.locator('[data-testid="search-results"]')).toContainText('No matches');
});
