import { describe, it, expect } from 'vitest';
import {
  isPanelAvailable,
  panelsForSurface,
  resolveActivePanel,
  PANELS,
} from './panels';

describe('panel availability', () => {
  it('offers every panel on the Diagram (architect) surface', () => {
    for (const p of PANELS) expect(isPanelAvailable(p.id, 'architect')).toBe(true);
  });

  it('hides Shapes and Templates on the Whiteboard surface', () => {
    expect(isPanelAvailable('shapes', 'whiteboard')).toBe(false);
    expect(isPanelAvailable('templates', 'whiteboard')).toBe(false);
  });

  it('keeps Project, Search, Outline, Git, Settings, Help on both surfaces', () => {
    for (const id of ['project', 'search', 'outline', 'git', 'settings', 'help'] as const) {
      expect(isPanelAvailable(id, 'whiteboard')).toBe(true);
    }
  });

  it('excludes the Diagram-only panels from panelsForSurface on whiteboard', () => {
    const ids = panelsForSurface('whiteboard').map((p) => p.id);
    expect(ids).not.toContain('shapes');
    expect(ids).not.toContain('templates');
    expect(ids).toContain('project');
  });
});

describe('resolveActivePanel', () => {
  it('honors an available preferred panel', () => {
    expect(resolveActivePanel('architect', { architect: 'git' })).toBe('git');
  });

  it('falls back to project when the preferred panel is unavailable on the surface', () => {
    expect(resolveActivePanel('whiteboard', { whiteboard: 'shapes' })).toBe('project');
  });

  it('retains the preference for the other surface (no mutation of the map)', () => {
    const prefs = { architect: 'shapes' as const, whiteboard: 'shapes' as const };
    expect(resolveActivePanel('whiteboard', prefs)).toBe('project');
    // architect still remembers shapes, so switching back resolves to it
    expect(resolveActivePanel('architect', prefs)).toBe('shapes');
    expect(prefs.whiteboard).toBe('shapes');
  });

  it('defaults to project when nothing is remembered', () => {
    expect(resolveActivePanel('architect', {})).toBe('project');
  });
});
