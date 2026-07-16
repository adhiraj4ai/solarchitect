import { describe, it, expect } from 'vitest';
import { resolveOrder } from './order';
import type { Diagram, DiagramEdge, DiagramNode } from '../ir/types';

function node(id: string, extra: Partial<DiagramNode> = {}): DiagramNode {
  return { id, type: 'aws.compute.EC2', label: id, ...extra };
}
function edge(id: string, from: string, to: string, extra: Partial<DiagramEdge> = {}): DiagramEdge {
  return { id, from, to, direction: 'forward', ...extra };
}
function diagram(nodes: DiagramNode[], edges: DiagramEdge[], clusters: Diagram['clusters'] = []): Diagram {
  return { nodes, edges, clusters, annotations: [], frames: [] };
}

describe('resolveOrder', () => {
  it('orders a linear chain by depth from the source', () => {
    const d = diagram(
      [node('a'), node('b'), node('c')],
      [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')],
    );
    const r = resolveOrder(d);
    expect(r.nodeOrder).toEqual({ a: 0, b: 1, c: 2 });
    // An edge flows as its (already-lit) source lights.
    expect(r.edgeOrder).toEqual({ e1: 0, e2: 1 });
    expect(r.warning).toBeUndefined();
  });

  it('gives a fan-out the same step (simultaneous)', () => {
    const d = diagram(
      [node('a'), node('b'), node('c')],
      [edge('e1', 'a', 'b'), edge('e2', 'a', 'c')],
    );
    const r = resolveOrder(d);
    expect(r.nodeOrder.a).toBe(0);
    expect(r.nodeOrder.b).toBe(1);
    expect(r.nodeOrder.c).toBe(1);
  });

  it('takes the longest path on a fan-in / diamond', () => {
    const d = diagram(
      [node('a'), node('b'), node('c'), node('e')],
      [edge('e1', 'a', 'b'), edge('e2', 'a', 'c'), edge('e3', 'b', 'e'), edge('e4', 'c', 'e')],
    );
    const r = resolveOrder(d);
    expect(r.nodeOrder).toEqual({ a: 0, b: 1, c: 1, e: 2 });
  });

  it('lets an explicit node step override the derived order and propagates downstream', () => {
    const d = diagram(
      [node('a'), node('b', { step: 5 }), node('c')],
      [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')],
    );
    const r = resolveOrder(d);
    expect(r.nodeOrder.a).toBe(0);
    expect(r.nodeOrder.b).toBe(5); // pinned, not derived 1
    expect(r.edgeOrder.e2).toBe(5); // the edge flows as its (pinned) source lights
    expect(r.nodeOrder.c).toBe(6); // successor pushed after the pinned b
  });

  it('lets an explicit edge step override and propagates to the target node', () => {
    const d = diagram([node('a'), node('b')], [edge('e1', 'a', 'b', { step: 9 })]);
    const r = resolveOrder(d);
    expect(r.edgeOrder.e1).toBe(9);
    expect(r.nodeOrder.b).toBe(10); // target lights after the pinned edge arrives
  });

  it('follows the effective direction for a reverse edge', () => {
    // e1 is declared a->b but reversed, so flow is b->a: b is the source.
    const d = diagram([node('a'), node('b')], [edge('e1', 'a', 'b', { direction: 'reverse' })]);
    const r = resolveOrder(d);
    expect(r.nodeOrder.b).toBe(0);
    expect(r.nodeOrder.a).toBe(1);
    expect(r.edgeOrder.e1).toBe(0); // flows as b (its effective source) lights
  });

  it('treats a bidirectional edge as forward for depth', () => {
    const d = diagram([node('a'), node('b')], [edge('e1', 'a', 'b', { direction: 'bidirectional' })]);
    const r = resolveOrder(d);
    expect(r.nodeOrder.a).toBe(0);
    expect(r.nodeOrder.b).toBe(1);
  });

  it('gives a cluster the minimum order of its members', () => {
    const d = diagram(
      [node('a', { clusterId: 'c1' }), node('b', { clusterId: 'c1' }), node('c')],
      [edge('e1', 'c', 'a'), edge('e2', 'a', 'b')],
      [{ id: 'c1', label: 'VPC', x: 0, y: 0, width: 10, height: 10 }],
    );
    const r = resolveOrder(d);
    // c=0, a=1, b=2 → cluster lights with its first member (a, at 1).
    expect(r.clusterOrder.c1).toBe(1);
  });

  it('does not block on a cycle and warns when there is no source', () => {
    const d = diagram([node('a'), node('b')], [edge('e1', 'a', 'b'), edge('e2', 'b', 'a')]);
    const r = resolveOrder(d);
    expect(r.warning).toMatch(/no .*start|first/i);
    // every node and edge still gets a finite order.
    expect(Number.isFinite(r.nodeOrder.a)).toBe(true);
    expect(Number.isFinite(r.nodeOrder.b)).toBe(true);
    expect(Number.isFinite(r.edgeOrder.e1)).toBe(true);
    expect(Number.isFinite(r.edgeOrder.e2)).toBe(true);
  });

  it('treats a disconnected node as its own source at step 0', () => {
    const d = diagram([node('a'), node('b'), node('lonely')], [edge('e1', 'a', 'b')]);
    const r = resolveOrder(d);
    expect(r.nodeOrder.lonely).toBe(0);
  });
});
