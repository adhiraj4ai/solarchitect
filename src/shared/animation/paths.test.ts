import { describe, it, expect } from 'vitest';
import { enumeratePaths } from './paths';
import type { Diagram, DiagramEdge, DiagramNode } from '../ir/types';

function node(id: string): DiagramNode {
  return { id, type: 'aws.compute.EC2', label: id };
}
function edge(id: string, from: string, to: string, extra: Partial<DiagramEdge> = {}): DiagramEdge {
  return { id, from, to, direction: 'forward', ...extra };
}
function diagram(nodes: DiagramNode[], edges: DiagramEdge[]): Diagram {
  return { nodes, edges, clusters: [], annotations: [], frames: [] };
}

describe('enumeratePaths', () => {
  it('walks a linear chain as a single source→sink path', () => {
    const { paths, truncated } = enumeratePaths(diagram([node('a'), node('b'), node('c')], [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')]));
    expect(truncated).toBe(false);
    expect(paths).toHaveLength(1);
    expect(paths[0].nodeIds).toEqual(['a', 'b', 'c']);
    expect(paths[0].edgeIds).toEqual(['e1', 'e2']);
  });

  it('yields one path per source→sink route on a fan-out/in', () => {
    // a → b → d, a → c → d : two distinct journeys.
    const d = diagram(
      [node('a'), node('b'), node('c'), node('d')],
      [edge('e1', 'a', 'b'), edge('e2', 'a', 'c'), edge('e3', 'b', 'd'), edge('e4', 'c', 'd')],
    );
    const { paths } = enumeratePaths(d);
    expect(paths).toHaveLength(2);
    expect(paths.map((p) => p.edgeIds)).toEqual([
      ['e1', 'e3'],
      ['e2', 'e4'],
    ]);
  });

  it('enumerates from multiple sources to multiple sinks', () => {
    const d = diagram([node('a'), node('b'), node('c')], [edge('e1', 'a', 'c'), edge('e2', 'b', 'c')]);
    const { paths } = enumeratePaths(d);
    expect(paths.map((p) => p.nodeIds)).toEqual([
      ['a', 'c'],
      ['b', 'c'],
    ]);
  });

  it('follows effective direction for reverse edges', () => {
    // e1 declared a→b but reversed, so the journey is b→a.
    const { paths } = enumeratePaths(diagram([node('a'), node('b')], [edge('e1', 'a', 'b', { direction: 'reverse' })]));
    expect(paths).toHaveLength(1);
    expect(paths[0].nodeIds).toEqual(['b', 'a']);
  });

  it('terminates on a cycle (visit-once) without a natural source', () => {
    const { paths } = enumeratePaths(diagram([node('a'), node('b')], [edge('e1', 'a', 'b'), edge('e2', 'b', 'a')]));
    // No source → start at first node; visit-once stops the loop.
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) expect(new Set(p.nodeIds).size).toBe(p.nodeIds.length); // simple (no repeats)
  });

  it('caps the path count and reports truncation', () => {
    // A source fanning out to N sinks yields N paths; cap below N.
    const nodes = [node('s'), node('t1'), node('t2'), node('t3')];
    const edges = [edge('e1', 's', 't1'), edge('e2', 's', 't2'), edge('e3', 's', 't3')];
    const { paths, truncated } = enumeratePaths(diagram(nodes, edges), 2);
    expect(paths).toHaveLength(2);
    expect(truncated).toBe(true);
  });

  it('does not report truncation when exactly the cap is reached with no more paths', () => {
    // Two source→sink paths, cap 2 → hits the limit but nothing more exists.
    const d = diagram([node('s'), node('t1'), node('t2')], [edge('e1', 's', 't1'), edge('e2', 's', 't2')]);
    const { paths, truncated } = enumeratePaths(d, 2);
    expect(paths).toHaveLength(2);
    expect(truncated).toBe(false);
  });
});
