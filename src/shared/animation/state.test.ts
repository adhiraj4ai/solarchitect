import { describe, it, expect } from 'vitest';
import { stateAt, stateAtByPath, byPathDuration, DIM_OPACITY } from './state';
import { buildTimeline } from './timeline';
import { resolveOrder } from './order';
import { enumeratePaths } from './paths';
import type { Diagram, DiagramEdge, DiagramNode } from '../ir/types';

const TIMING = { secondsPerStep: 1, fadeSeconds: 0.3, dotTravelSeconds: 0.9, endHoldSeconds: 1 };

function node(id: string, extra: Partial<DiagramNode> = {}): DiagramNode {
  return { id, type: 'aws.compute.EC2', label: id, ...extra };
}
function edge(id: string, from: string, to: string, extra: Partial<DiagramEdge> = {}): DiagramEdge {
  return { id, from, to, direction: 'forward', ...extra };
}
function chain(): Diagram {
  return {
    nodes: [node('a'), node('b'), node('c')],
    edges: [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')],
    clusters: [],
    frames: [],
  };
}
function build(d: Diagram) {
  const order = resolveOrder(d);
  return { order, timeline: buildTimeline(order, TIMING) };
}

describe('stateAt', () => {
  it('dims everything not yet reached and fully lights what has played (cumulative)', () => {
    const d = chain();
    const { order, timeline } = build(d);

    // Mid beat 0 (after the fade): a is lit, b and c still dim.
    const s0 = stateAt(d, order, timeline, 0.5);
    expect(s0.nodeOpacity.a).toBe(1);
    expect(s0.nodeOpacity.b).toBe(DIM_OPACITY);
    expect(s0.nodeOpacity.c).toBe(DIM_OPACITY);

    // Into beat 1: a and b lit, c still dim.
    const s1 = stateAt(d, order, timeline, 1.5);
    expect(s1.nodeOpacity.a).toBe(1);
    expect(s1.nodeOpacity.b).toBe(1);
    expect(s1.nodeOpacity.c).toBe(DIM_OPACITY);

    // Past the end: everything lit.
    const sEnd = stateAt(d, order, timeline, timeline.totalSeconds);
    expect(sEnd.nodeOpacity.c).toBe(1);
  });

  it('ramps opacity during a beat fade', () => {
    const d = chain();
    const { order, timeline } = build(d);
    const half = stateAt(d, order, timeline, TIMING.fadeSeconds / 2).nodeOpacity.a;
    expect(half).toBeGreaterThan(DIM_OPACITY);
    expect(half).toBeLessThan(1);
  });

  it('moves the flow token across the active edge, then clears it', () => {
    const d = chain();
    const { order, timeline } = build(d);

    // e1 is beat 0, active over [0, 0.9]. Halfway → ~0.5 along a→b.
    const mid = stateAt(d, order, timeline, 0.45);
    expect(mid.dotPositions.e1).toBeCloseTo(0.5, 1);
    // e2 (beat 1) is not active yet.
    expect(mid.dotPositions.e2).toBeNull();

    // After e1's travel window, its token is gone (edge stays lit).
    const after = stateAt(d, order, timeline, 0.95);
    expect(after.dotPositions.e1).toBeNull();
  });

  it('sends the token the other way for a reverse edge', () => {
    const d: Diagram = {
      nodes: [node('a'), node('b')],
      edges: [edge('e1', 'a', 'b', { direction: 'reverse' })],
      clusters: [],
      frames: [],
    };
    const { order, timeline } = build(d);
    const s = stateAt(d, order, timeline, 0.9 * 0.25);
    // flow is b→a; at 1/4 of the travel the geometric position along a→b is 3/4.
    expect(s.dotPositions.e1).toBeCloseTo(0.75, 1);
    // direction is also reported for capture consumers.
    expect(s.edgeDirection.e1).toBe('reverse');
  });

  it('all-edges: every edge flows continuously and nothing dims', () => {
    const d = chain();
    const { order, timeline } = build(d);
    const s = stateAt(d, order, timeline, 0.4, 'all-edges');
    // No build-up: all nodes/edges fully lit regardless of order.
    expect(Object.values(s.nodeOpacity).every((o) => o === 1)).toBe(true);
    // Every edge has an active token (never null), all in phase.
    expect(s.dotPositions.e1).not.toBeNull();
    expect(s.dotPositions.e2).not.toBeNull();
    expect(s.dotPositions.e1).toBe(s.dotPositions.e2);
  });

  it('dataflow: by-order wavefront but nothing dims', () => {
    const d = chain();
    const { order, timeline } = build(d);
    // Beat 0: e1 flows, e2 not yet; but opacity stays lit (no build-up).
    const s = stateAt(d, order, timeline, 0.45, 'dataflow');
    expect(s.nodeOpacity.c).toBe(1);
    expect(s.dotPositions.e1).not.toBeNull();
    expect(s.dotPositions.e2).toBeNull();
  });

  it('end-to-end: one token walks each path edge in turn, nothing dims', () => {
    const d = chain(); // a→b→c, one path of 2 edges
    const { paths } = enumeratePaths(d);
    const travel = 0.9;
    expect(byPathDuration(paths, travel)).toBe(2 * travel);

    // First segment: e1 active, e2 idle.
    const s0 = stateAtByPath(d, paths, travel, travel * 0.5);
    expect(Object.values(s0.nodeOpacity).every((o) => o === 1)).toBe(true);
    expect(s0.dotPositions.e1).not.toBeNull();
    expect(s0.dotPositions.e2).toBeNull();

    // Second segment: e2 active, e1 idle.
    const s1 = stateAtByPath(d, paths, travel, travel * 1.5);
    expect(s1.dotPositions.e1).toBeNull();
    expect(s1.dotPositions.e2).not.toBeNull();
  });

  it('dims un-reached elements to the timeline dimOpacity, not the hardcoded default', () => {
    const d = chain();
    const order = resolveOrder(d);
    const timeline = buildTimeline(order, { ...TIMING, dimOpacity: 0.4 });
    // Beat 0 (t=0.5): a is lit; b and c are not reached and dim to 0.4.
    const s = stateAt(d, order, timeline, 0.5);
    expect(s.nodeOpacity.a).toBe(1);
    expect(s.nodeOpacity.b).toBe(0.4);
    expect(s.nodeOpacity.c).toBe(0.4);
  });

  it('applies ease-in-out to the token fraction (endpoints unchanged, mid-curve differs)', () => {
    const d = chain();
    const order = resolveOrder(d);
    const linear = buildTimeline(order, TIMING);
    const eased = buildTimeline(order, { ...TIMING, easing: 'ease-in-out' });
    // e1 is beat 0, active over [0, dotTravel]. At 1/4 of the travel:
    const tQuarter = TIMING.dotTravelSeconds * 0.25;
    expect(stateAt(d, order, linear, tQuarter).dotPositions.e1).toBeCloseTo(0.25, 2);
    expect(stateAt(d, order, eased, tQuarter).dotPositions.e1).toBeCloseTo(0.125, 2);
    // Endpoints are identical under any easing: 0 at the start, 1 at full travel.
    expect(stateAt(d, order, eased, 0).dotPositions.e1).toBeCloseTo(0, 5);
    expect(stateAt(d, order, eased, TIMING.dotTravelSeconds).dotPositions.e1).toBeCloseTo(1, 5);
  });

  it('applies easing to the end-to-end path walk', () => {
    const d = chain();
    const { paths } = enumeratePaths(d);
    const travel = 0.9;
    // First segment (e1), 1/4 through: linear 0.25 vs ease-in-out 0.125.
    expect(stateAtByPath(d, paths, travel, travel * 0.25, 'linear').dotPositions.e1).toBeCloseTo(0.25, 2);
    expect(stateAtByPath(d, paths, travel, travel * 0.25, 'ease-in-out').dotPositions.e1).toBeCloseTo(0.125, 2);
  });

  it('lights a cluster with its first member', () => {
    const d: Diagram = {
      nodes: [node('a', { clusterId: 'c1' }), node('b', { clusterId: 'c1' }), node('src')],
      edges: [edge('e1', 'src', 'a'), edge('e2', 'a', 'b')],
      clusters: [{ id: 'c1', label: 'VPC', x: 0, y: 0, width: 10, height: 10 }],
      frames: [],
    };
    const { order, timeline } = build(d);
    // src=0, a=1, b=2 → cluster order 1. At beat 1 (t=1.5) the cluster is lit.
    expect(stateAt(d, order, timeline, 1.5).clusterOpacity.c1).toBe(1);
    // Before that (beat 0) it is dim.
    expect(stateAt(d, order, timeline, 0.5).clusterOpacity.c1).toBe(DIM_OPACITY);
  });
});
