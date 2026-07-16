import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openPanel } from './helpers';

const MAIN = join(process.cwd(), 'out/main/index.js');

let app: ElectronApplication;
let win: Page;
let userData: string;

test.beforeAll(async () => {
  // Isolated user-data dir so persisted layout/settings don't leak to/from other specs.
  userData = await mkdtemp(join(tmpdir(), 'solarchitect-shell-'));
  app = await electron.launch({ args: [MAIN, `--user-data-dir=${userData}`] });
  win = await app.firstWindow();
  await win.locator('[data-testid="canvas-drop"]').waitFor({ timeout: 15_000 });
});

test.afterAll(async () => {
  await app.close();
  await rm(userData, { recursive: true, force: true });
});

const sidebar = () => win.locator('[data-testid="sidebar"]');

test('the activity bar opens one panel at a time', async () => {
  // Project is the default panel.
  await expect(win.locator('[data-testid="sidebar"] .sidebar__head')).toBeVisible();

  // Switching to Shapes shows the shape library and hides the project head.
  await win.locator('[data-testid="activity-shapes"]').click();
  await expect(win.locator('[data-testid="lib-group-aws"]')).toBeVisible();
  await expect(win.locator('[data-testid="sidebar"] .sidebar__head')).toHaveCount(0);

  // Outline shows its own panel with an empty state for the empty diagram.
  await win.locator('[data-testid="activity-outline"]').click();
  await expect(win.locator('[data-testid="sidebar"]')).toContainText('empty');

  // Help is a static panel with the version.
  await win.locator('[data-testid="activity-help"]').click();
  await expect(win.locator('[data-testid="help-version"]')).toBeVisible();
});

test('clicking the active panel and ⌘B collapse/expand the sidebar', async () => {
  await win.locator('[data-testid="activity-project"]').click();
  await expect(sidebar()).toBeVisible();

  // Clicking the active icon collapses the sidebar.
  await win.locator('[data-testid="activity-project"]').click();
  await expect(sidebar()).toHaveCount(0);

  // The keyboard shortcut re-opens it.
  await win.keyboard.press('ControlOrMeta+KeyB');
  await expect(sidebar()).toBeVisible();

  // ...and toggles it closed again.
  await win.keyboard.press('ControlOrMeta+KeyB');
  await expect(sidebar()).toHaveCount(0);
  await win.keyboard.press('ControlOrMeta+KeyB');
  await expect(sidebar()).toBeVisible();
});

test('the sidebar width persists across a reload', async () => {
  await openPanel(win, 'project');
  const before = await sidebar().boundingBox();
  if (!before) throw new Error('no sidebar box');

  // Drag the resize handle to widen the sidebar.
  const handleX = before.x + before.width;
  const handleY = before.y + before.height / 2;
  await win.mouse.move(handleX, handleY);
  await win.mouse.down();
  await win.mouse.move(handleX + 120, handleY, { steps: 5 });
  await win.mouse.up();

  const widened = await sidebar().boundingBox();
  expect(widened!.width).toBeGreaterThan(before.width + 40);

  // Reload: the width is restored from localStorage.
  await win.reload();
  await win.locator('[data-testid="canvas-drop"]').waitFor({ timeout: 15_000 });
  const restored = await sidebar().boundingBox();
  expect(Math.abs(restored!.width - widened!.width)).toBeLessThan(8);
});

test('the Whiteboard surface hides Shapes, Templates, and the Visual/Split/Code control', async () => {
  // On the Diagram surface they are present.
  await win.locator('[data-testid="surface-architect"]').click();
  await expect(win.locator('[data-testid="activity-shapes"]')).toBeVisible();
  await expect(win.locator('[data-testid="activity-templates"]')).toBeVisible();
  await expect(win.locator('[data-testid="view-split"]')).toBeVisible();

  // On the Whiteboard surface they are gone; git-agnostic panels remain.
  await win.locator('[data-testid="surface-whiteboard"]').click();
  await expect(win.locator('[data-testid="activity-shapes"]')).toHaveCount(0);
  await expect(win.locator('[data-testid="activity-templates"]')).toHaveCount(0);
  await expect(win.locator('[data-testid="view-split"]')).toHaveCount(0);
  await expect(win.locator('[data-testid="activity-project"]')).toBeVisible();

  await win.locator('[data-testid="surface-architect"]').click();
  await expect(win.locator('[data-testid="activity-shapes"]')).toBeVisible();
});

test('a panel unavailable on the whiteboard falls back, and is restored on return', async () => {
  // Choose Shapes on the Diagram surface.
  await win.locator('[data-testid="surface-architect"]').click();
  await openPanel(win, 'shapes');
  await expect(win.locator('[data-testid="lib-group-aws"]')).toBeVisible();

  // Switching to the Whiteboard falls back to Project (Shapes is unavailable).
  await win.locator('[data-testid="surface-whiteboard"]').click();
  await expect(win.locator('[data-testid="sidebar"] .sidebar__head')).toBeVisible();

  // Returning to the Diagram surface restores Shapes.
  await win.locator('[data-testid="surface-architect"]').click();
  await expect(win.locator('[data-testid="lib-group-aws"]')).toBeVisible();
});
