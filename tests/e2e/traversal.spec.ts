import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAIN = join(process.cwd(), 'out/main/index.js');

let app: ElectronApplication;
let win: Page;
let userData: string;

test.beforeAll(async () => {
  // Isolated user-data dir so custom animation presets created here don't leak
  // to/from other specs or prior runs (presets are persisted in settings).
  userData = await mkdtemp(join(tmpdir(), 'solarchitect-traversal-'));
  app = await electron.launch({ args: [MAIN, `--user-data-dir=${userData}`] });
  win = await app.firstWindow();
  await win.locator('[data-testid="canvas-drop"]').waitFor({ timeout: 15_000 });
});

test.afterAll(async () => {
  await app.close();
  await rm(userData, { recursive: true, force: true });
});

/** Set a controlled input's value the way React expects, so onChange fires. A
 *  bare `el.value = x` is swallowed by React's value tracker. */
async function setReactInput(testId: string, value: string) {
  await win.locator(`[data-testid="${testId}"]`).evaluate((el, v) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

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

test('token color and size from the active preset drive the flow token', async () => {
  await editor().fill(CHAIN);
  await expect(canvas().getByText('Alpha')).toBeVisible();

  // Create a custom preset (becomes active) and configure a continuous style so
  // the token is always on screen, plus a distinctive color and size.
  await win.locator('[data-testid="activity-animations"]').click();
  await win.locator('[data-testid="anim-new"]').click();
  await win.locator('[data-testid="anim-style"]').selectOption('all-edges');
  await setReactInput('anim-size', '9');
  await setReactInput('anim-color', '#12ab34');

  await win.locator('[data-testid="traversal-toggle"]').click();

  const tokenAttr = (attr: string) =>
    win.evaluate((a) => document.querySelector('.arch-edge-token-det')?.getAttribute(a) ?? null, attr);

  await expect.poll(() => tokenAttr('fill')).toBe('#12ab34');
  await expect.poll(() => tokenAttr('r')).toBe('9');

  await win.locator('[data-testid="traversal-toggle"]').click();
});

test('the scrubber seeks and holds, and beat ticks jump', async () => {
  await editor().fill(CHAIN);
  await expect(canvas().getByText('Alpha')).toBeVisible();
  // Pin a build-up preset: the ticks are its per-beat markers. A prior test can
  // leave a continuous (all-edges) preset active, which has no beats.
  await win.locator('[data-testid="anim-bar-preset"]').selectOption('builtin-control-flow');

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
