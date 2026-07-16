import type { Page } from '@playwright/test';

/**
 * Open an activity-bar panel deterministically, regardless of current state:
 * switch to a different panel first, then to the target, so we never
 * accidentally toggle-collapse an already-active panel.
 */
export async function openPanel(win: Page, id: string): Promise<void> {
  const other = id === 'project' ? 'help' : 'project';
  await win.locator(`[data-testid="activity-${other}"]`).click();
  await win.locator(`[data-testid="activity-${id}"]`).click();
}
