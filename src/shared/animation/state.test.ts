import { describe, it, expect } from 'vitest';
import { stateAt, DIM_OPACITY } from './state';
import { buildTimeline } from './timeline';
import { resolveOrder } from './order';
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
    annotations: [],
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
      annotations: [],
      frames: [],
    };
    const { order, timeline } = build(d);
    const s = stateAt(d, order, timeline, 0.9 * 0.25);
    // flow is b→a; at 1/4 of the travel the geometric position along a→b is 3/4.
    expect(s.dotPositions.e1).toBeCloseTo(0.75, 1);
    // direction is also reported for capture consumers.
    expect(s.edgeDirection.e1).toBe('reverse');
  });

  it('lights a cluster with its first member', () => {
    const d: Diagram = {
      nodes: [node('a', { clusterId: 'c1' }), node('b', { clusterId: 'c1' }), node('src')],
      edges: [edge('e1', 'src', 'a'), edge('e2', 'a', 'b')],
      clusters: [{ id: 'c1', label: 'VPC', x: 0, y: 0, width: 10, height: 10 }],
      annotations: [],
      frames: [],
    };
    const { order, timeline } = build(d);
    // src=0, a=1, b=2 → cluster order 1. At beat 1 (t=1.5) the cluster is lit.
    expect(stateAt(d, order, timeline, 1.5).clusterOpacity.c1).toBe(1);
    // Before that (beat 0) it is dim.
    expect(stateAt(d, order, timeline, 0.5).clusterOpacity.c1).toBe(DIM_OPACITY);
  });
});
