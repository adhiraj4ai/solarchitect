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

test('all three annotation kinds typed in YAML render on the canvas', async () => {
  // Author annotations in YAML on the Diagram surface (a whiteboard has no
  // source pane), then switch to the Whiteboard surface to see them rendered.
  await win.locator('[data-testid="surface-architect"]').click();
  await editor().fill(`nodes: []
edges: []
clusters: []
annotations:
  - id: a1
    kind: sticky
    x: 80
    y: 120
    width: 180
    height: 120
    content: StickyNoteHere
  - id: a2
    kind: shape
    x: 340
    y: 120
    width: 160
    height: 100
    content: BoxLabelHere
  - id: a3
    kind: text
    x: 560
    y: 120
    width: 120
    height: 30
    content: TextLabelHere
`);
  // Let the debounced YAML edit commit before switching surface (switching
  // unmounts the source pane, which would cancel a still-pending edit).
  await win.waitForTimeout(400);
  await win.locator('[data-testid="surface-whiteboard"]').click();
  await expect(canvas()).toContainText('StickyNoteHere');
  await expect(canvas()).toContainText('BoxLabelHere');
  await expect(canvas()).toContainText('TextLabelHere');
});

test('placing a sticky note on the canvas adds an annotation to the YAML', async () => {
  // Start clean on the Diagram surface, then sketch a sticky on the Whiteboard.
  await win.locator('[data-testid="surface-architect"]').click();
  await editor().fill(`nodes: []
edges: []
clusters: []
annotations: []
`);
  await win.waitForTimeout(400);
  await win.locator('[data-testid="surface-whiteboard"]').click();
  // Focus the canvas, choose the note tool (keyboard 'n'), place it, exit edit mode.
  // Use upper-middle coords, clear of tldraw's own UI (menus, toolbars, panels).
  await canvas().click({ position: { x: 300, y: 170 } });
  await win.keyboard.press('n');
  await canvas().click({ position: { x: 340, y: 230 } });
  await win.keyboard.press('Escape');

  // Back to the Diagram surface to read the annotation back out of the YAML.
  await win.locator('[data-testid="surface-architect"]').click();
  await expect(editor()).toHaveValue(/kind: sticky/);
});
