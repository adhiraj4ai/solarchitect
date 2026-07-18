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
edges:
  - id: e1
    from: a
    to: b
clusters: []
annotations: []
`;

test('playing the traversal dims later steps and flows a token, then resets on stop', async () => {
  await editor().fill(CHAIN);
  await expect(canvas().getByText('Alpha')).toBeVisible();

  const opacities = () =>
    win.evaluate(() =>
      [...document.querySelectorAll('.tl-shape')]
        .map((el) => Number(getComputedStyle(el).opacity))
        .filter((n) => !Number.isNaN(n)),
    );
  const tokenVisible = () =>
    win.evaluate(
      () =>
        [...document.querySelectorAll('.arch-edge-token-det')].some(
          (c) => getComputedStyle(c).display !== 'none',
        ),
    );

  // Before playing, everything is fully lit.
  expect(await opacities()).not.toContain(0.15);

  await win.locator('[data-testid="traversal-toggle"]').click();
  // Early in the build-up, at least one later element is dimmed and a token flows.
  await expect.poll(async () => (await opacities()).some((o) => o < 0.5)).toBe(true);
  await expect.poll(tokenVisible).toBe(true);

  await win.locator('[data-testid="traversal-toggle"]').click();
  // Stopping resets to fully lit with no token.
  await expect.poll(async () => (await opacities()).every((o) => o > 0.99)).toBe(true);
  expect(await tokenVisible()).toBe(false);
});

test('the animation control bar is visible before Play, switches preset, and opens settings', async () => {
  await editor().fill(CHAIN);
  await expect(canvas().getByText('Alpha')).toBeVisible();

  // The bar is present on a Diagram without pressing Play first.
  await expect(win.locator('[data-testid="traversal-scrubber"]')).toBeVisible();

  // The preset dropdown switches the active preset (reflected in the top-bar Play label).
  await win.locator('[data-testid="anim-bar-preset"]').selectOption('builtin-dataflow');
  await expect(win.locator('[data-testid="traversal-toggle"]')).toContainText('Dataflow');
  await win.locator('[data-testid="anim-bar-preset"]').selectOption('builtin-control-flow');
  await expect(win.locator('[data-testid="traversal-toggle"]')).toContainText('Control flow');

  // The gear opens the Animations panel (its preset editor becomes visible).
  await win.locator('[data-testid="anim-bar-gear"]').click();
  await expect(win.locator('[data-testid="anim-editor"]')).toBeVisible();
});

test('the scrubber seeks and holds, and beat ticks jump', async () => {
  await editor().fill(CHAIN);
  await expect(canvas().getByText('Alpha')).toBeVisible();

  const opacities = () =>
    win.evaluate(() =>
      [...document.querySelectorAll('.tl-shape')]
        .map((el) => Number(getComputedStyle(el).opacity))
        .filter((n) => !Number.isNaN(n)),
    );

  await win.locator('[data-testid="traversal-toggle"]').click();
  const scrubber = win.locator('[data-testid="traversal-scrubber"]');
  await expect(scrubber).toBeVisible();

  // A 2-node/1-edge chain has 2 distinct order values → 2 beat ticks.
  const ticks = win.locator('[data-testid="scrubber-tick"]');
  await expect(ticks).toHaveCount(2);

  // Jumping to the last beat pauses playback and holds fully lit.
  await ticks.last().click();
  await expect(win.locator('[data-testid="scrubber-playpause"]')).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(async () => (await opacities()).filter((o) => o > 0.99).length).toBeGreaterThan(0);
});
