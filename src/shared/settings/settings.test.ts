import { describe, it, expect } from 'vitest';
import { mergeSettings, DEFAULT_SETTINGS } from './settings';

describe('mergeSettings', () => {
  it('returns defaults for undefined/empty input', () => {
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps provided, correctly-typed values', () => {
    expect(mergeSettings({ grid: false, autosave: true, defaultProvider: 'aws' })).toEqual({
      grid: false,
      autosave: true,
      defaultProvider: 'aws',
    });
  });

  it('fills missing keys from defaults', () => {
    expect(mergeSettings({ grid: false })).toEqual({ ...DEFAULT_SETTINGS, grid: false });
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
