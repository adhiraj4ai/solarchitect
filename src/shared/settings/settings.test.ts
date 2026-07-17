import { describe, it, expect } from 'vitest';
import { mergeSettings, DEFAULT_SETTINGS } from './settings';

describe('mergeSettings', () => {
  it('returns defaults for undefined/empty input', () => {
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps provided, correctly-typed values', () => {
    expect(mergeSettings({ grid: false, autosave: true, defaultProvider: 'aws' })).toEqual({
      ...DEFAULT_SETTINGS,
      grid: false,
      autosave: true,
      defaultProvider: 'aws',
    });
  });

  it('merges custom animation presets and the active id, tolerating corruption', () => {
    const merged = mergeSettings({
      customPresets: [
        { id: 'c1', name: 'Mine', style: 'dataflow' },
        { id: 'bad', name: 'x', style: 'sideways' }, // dropped
      ],
      activePresetId: 'c1',
    });
    expect(merged.customPresets.map((p) => p.id)).toEqual(['c1']);
    expect(merged.activePresetId).toBe('c1');
    // A non-string active id falls back to the default built-in.
    expect(mergeSettings({ activePresetId: 42 }).activePresetId).toBe(DEFAULT_SETTINGS.activePresetId);
  });

  it('fills missing keys from defaults', () => {
    expect(mergeSettings({ grid: false })).toEqual({ ...DEFAULT_SETTINGS, grid: false });
  });

  it('handles nodeBorders: default off, kept when provided, tolerant of garbage', () => {
    expect(mergeSettings({}).nodeBorders).toBe(false);
    expect(mergeSettings({ nodeBorders: true }).nodeBorders).toBe(true);
    expect(mergeSettings({ nodeBorders: 'yes' }).nodeBorders).toBe(false);
  });

  it('handles nodeFill: default off, kept when provided, tolerant of garbage', () => {
    expect(mergeSettings({}).nodeFill).toBe(false);
    expect(mergeSettings({ nodeFill: true }).nodeFill).toBe(true);
    expect(mergeSettings({ nodeFill: 'no' }).nodeFill).toBe(false);
  });

  it('ignores wrongly-typed values and falls back to defaults', () => {
    expect(mergeSettings({ grid: 'yes', autosave: 1, defaultProvider: 42 })).toEqual(DEFAULT_SETTINGS);
  });

  it('accepts null defaultProvider (all providers)', () => {
    expect(mergeSettings({ defaultProvider: null }).defaultProvider).toBeNull();
  });

  it('tolerates non-object input (e.g. corrupt JSON parsed to a scalar)', () => {
    expect(mergeSettings('garbage')).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });
});
