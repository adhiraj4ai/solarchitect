import { describe, it, expect } from 'vitest';
import { buildTimeline, animationPeriod, presetTiming, DEFAULT_TIMING } from './timeline';
import { coercePreset } from './presets';
import type { ResolvedOrder } from './order';

const order = (nodeOrder: Record<string, number>, edgeOrder: Record<string, number> = {}): ResolvedOrder => ({
  nodeOrder,
  edgeOrder,
  clusterOrder: {},
});

describe('buildTimeline', () => {
  it('has no duration for an empty diagram', () => {
    const t = buildTimeline(order({}), DEFAULT_TIMING);
    expect(t.beatValues).toEqual([]);
    expect(t.totalSeconds).toBe(0);
  });

  it('maps distinct order values to contiguous beats', () => {
    const t = buildTimeline(order({ a: 0, b: 1, c: 2 }), { ...DEFAULT_TIMING, secondsPerStep: 1, endHoldSeconds: 1 });
    expect(t.beatValues).toEqual([0, 1, 2]);
    expect(t.beatStart).toEqual({ 0: 0, 1: 1, 2: 2 });
    expect(t.totalSeconds).toBe(4); // 3 beats * 1s + 1s hold
  });

  it('collapses non-contiguous order values (pins) to gap-free beats', () => {
    const t = buildTimeline(order({ a: 0, b: 5 }, { e1: 2 }), { ...DEFAULT_TIMING, secondsPerStep: 1, endHoldSeconds: 1 });
    expect(t.beatValues).toEqual([0, 2, 5]);
    expect(t.beatStart).toEqual({ 0: 0, 2: 1, 5: 2 });
    expect(t.totalSeconds).toBe(4);
  });

  it('animationPeriod is one token cycle for all-edges, else the full timeline', () => {
    const t = buildTimeline(order({ a: 0, b: 1 }), { ...DEFAULT_TIMING, secondsPerStep: 1, dotTravelSeconds: 0.7, endHoldSeconds: 1 });
    expect(animationPeriod('all-edges', t)).toBe(0.7); // dotTravelSeconds
    expect(animationPeriod('dataflow', t)).toBe(t.totalSeconds);
    expect(animationPeriod('control-flow', t)).toBe(t.totalSeconds);
  });
});

describe('presetTiming', () => {
  it('carries the preset dimOpacity and travelEasing into engine timing', () => {
    const p = coercePreset({ id: 'c', name: 'n', style: 'control-flow', dimOpacity: 0.3, travelEasing: 'ease-in-out' })!;
    const timing = presetTiming(p);
    expect(timing.dimOpacity).toBe(0.3);
    expect(timing.easing).toBe('ease-in-out');
  });

  it('defaults easing to linear when the preset does not set it', () => {
    const p = coercePreset({ id: 'c', name: 'n', style: 'control-flow' })!;
    expect(presetTiming(p).easing).toBe('linear');
  });
});
