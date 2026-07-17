import { describe, it, expect } from 'vitest';
import {
  BUILTIN_PRESETS,
  DEFAULT_ACTIVE_PRESET_ID,
  coercePreset,
  coercePresets,
  allPresets,
  resolvePreset,
  isBuiltinPreset,
} from './presets';

describe('animation presets', () => {
  it('ships four read-only built-ins, one per style', () => {
    expect(BUILTIN_PRESETS).toHaveLength(4);
    expect(BUILTIN_PRESETS.map((p) => p.style).sort()).toEqual(['all-edges', 'control-flow', 'dataflow', 'end-to-end']);
    expect(isBuiltinPreset(DEFAULT_ACTIVE_PRESET_ID)).toBe(true);
  });

  it('coerces a valid preset and fills missing timing from defaults', () => {
    const p = coercePreset({ id: 'c1', name: 'Mine', style: 'dataflow' });
    expect(p).toMatchObject({ id: 'c1', name: 'Mine', style: 'dataflow', loop: 'forever' });
    expect(typeof p?.secondsPerStep).toBe('number');
  });

  it('rejects presets with a missing id/name or unknown style', () => {
    expect(coercePreset({ name: 'x', style: 'dataflow' })).toBeNull();
    expect(coercePreset({ id: 'x', style: 'dataflow' })).toBeNull();
    expect(coercePreset({ id: 'x', name: 'x', style: 'sideways' })).toBeNull();
    expect(coercePreset('garbage')).toBeNull();
  });

  it('drops invalid entries and built-in-id collisions from a stored list', () => {
    const list = coercePresets([
      { id: 'c1', name: 'Good', style: 'all-edges' },
      { id: 'builtin-dataflow', name: 'Hijack', style: 'dataflow' }, // collides with a built-in
      'garbage',
    ]);
    expect(list.map((p) => p.id)).toEqual(['c1']);
    expect(coercePresets('nope')).toEqual([]);
  });

  it('resolves the active preset, falling back to the default built-in', () => {
    const custom = [coercePreset({ id: 'c1', name: 'Mine', style: 'dataflow' })!];
    expect(resolvePreset(custom, 'c1').id).toBe('c1');
    expect(resolvePreset(custom, 'does-not-exist').id).toBe(DEFAULT_ACTIVE_PRESET_ID);
    expect(allPresets(custom)).toHaveLength(BUILTIN_PRESETS.length + 1);
  });
});
