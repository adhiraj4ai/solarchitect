import { describe, it, expect } from 'vitest';
import {
  isPanelAvailableForType,
  panelsForType,
  resolveActivePanelForType,
} from './panels';

describe('panel availability by document type', () => {
  it('diagram exposes every panel', () => {
    const ids = panelsForType('diagram').map((p) => p.id);
    expect(ids).toContain('shapes');
    expect(ids).toContain('templates');
    expect(ids).toContain('outline');
    expect(ids).toContain('search');
  });

  it('whiteboard is universal-only (no shapes/templates/outline/search)', () => {
    expect(isPanelAvailableForType('shapes', 'whiteboard')).toBe(false);
    expect(isPanelAvailableForType('templates', 'whiteboard')).toBe(false);
    expect(isPanelAvailableForType('outline', 'whiteboard')).toBe(false);
    expect(isPanelAvailableForType('search', 'whiteboard')).toBe(false);
    expect(isPanelAvailableForType('project', 'whiteboard')).toBe(true);
    expect(isPanelAvailableForType('git', 'whiteboard')).toBe(true);
  });

  it('markdown adds outline and search but not shapes/templates', () => {
    expect(isPanelAvailableForType('outline', 'markdown')).toBe(true);
    expect(isPanelAvailableForType('search', 'markdown')).toBe(true);
    expect(isPanelAvailableForType('shapes', 'markdown')).toBe(false);
    expect(isPanelAvailableForType('templates', 'markdown')).toBe(false);
  });

  it('falls back to project when a remembered panel is unavailable on the type', () => {
    expect(resolveActivePanelForType('whiteboard', { whiteboard: 'shapes' })).toBe('project');
    expect(resolveActivePanelForType('markdown', { markdown: 'outline' })).toBe('outline');
  });
});
