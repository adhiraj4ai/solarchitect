import { describe, it, expect } from 'vitest';
import { buildTimeline, DEFAULT_TIMING } from './timeline';
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
});
