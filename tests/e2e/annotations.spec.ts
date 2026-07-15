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
  await expect(canvas()).toContainText('StickyNoteHere');
  await expect(canvas()).toContainText('BoxLabelHere');
  await expect(canvas()).toContainText('TextLabelHere');
});

test('placing a sticky note on the canvas adds an annotation to the YAML', async () => {
  await editor().fill(`nodes: []
edges: []
clusters: []
annotations: []
`);
  // Focus the canvas, choose the note tool (keyboard 'n'), place it, exit edit mode.
  await canvas().click({ position: { x: 250, y: 420 } });
  await win.keyboard.press('n');
  await canvas().click({ position: { x: 320, y: 300 } });
  await win.keyboard.press('Escape');

  await expect(editor()).toHaveValue(/kind: sticky/);
});
