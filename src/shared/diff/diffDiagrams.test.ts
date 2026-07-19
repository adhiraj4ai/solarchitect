import { describe, it, expect } from 'vitest';
import { diffDiagrams } from './diffDiagrams';
import type {
  Diagram,
  DiagramNode,
  DiagramEdge,
  DiagramCluster,
  DiagramFrame,
} from '../ir/types';

function node(id: string, extra: Partial<DiagramNode> = {}): DiagramNode {
  return { id, type: 'aws.compute.EC2', label: id, x: 0, y: 0, ...extra };
}
function edge(id: string, from: string, to: string, extra: Partial<DiagramEdge> = {}): DiagramEdge {
  return { id, from, to, direction: 'forward', ...extra };
}
function cluster(id: string, extra: Partial<DiagramCluster> = {}): DiagramCluster {
  return { id, label: id, x: 0, y: 0, width: 100, height: 100, ...extra };
}
function frame(id: string, extra: Partial<DiagramFrame> = {}): DiagramFrame {
  return { id, label: id, x: 0, y: 0, width: 200, height: 200, ...extra };
}
function diagram(
  nodes: DiagramNode[] = [],
  edges: DiagramEdge[] = [],
  clusters: DiagramCluster[] = [],
  frames: DiagramFrame[] = [],
): Diagram {
  return { nodes, edges, clusters, frames };
}

describe('diffDiagrams', () => {
  it('reports a node present only in next as added', () => {
    const d = diffDiagrams(diagram([node('a')]), diagram([node('a'), node('b')]));
    expect(d.nodes.added.map((n) => n.id)).toEqual(['b']);
    expect(d.nodes.removed).toEqual([]);
    expect(d.nodes.changed).toEqual([]);
  });

  it('reports a node present only in base as removed', () => {
    const d = diffDiagrams(diagram([node('a'), node('b')]), diagram([node('a')]));
    expect(d.nodes.removed.map((n) => n.id)).toEqual(['b']);
    expect(d.nodes.added).toEqual([]);
    expect(d.nodes.changed).toEqual([]);
  });

  it('reports a relabeled node as a semantic change', () => {
    const d = diffDiagrams(diagram([node('a', { label: 'Old' })]), diagram([node('a', { label: 'New' })]));
    expect(d.nodes.added).toEqual([]);
    expect(d.nodes.removed).toEqual([]);
    expect(d.nodes.changed).toHaveLength(1);
    const c = d.nodes.changed[0];
    expect(c.id).toBe('a');
    expect(c.fields).toEqual(['label']);
    expect(c.layoutOnly).toBe(false);
    expect(c.before.label).toBe('Old');
    expect(c.after.label).toBe('New');
  });

  it('classifies a node that only moved as a layout-only change', () => {
    const d = diffDiagrams(diagram([node('a', { x: 0, y: 0 })]), diagram([node('a', { x: 40, y: 90 })]));
    expect(d.nodes.changed).toHaveLength(1);
    const c = d.nodes.changed[0];
    expect(c.fields).toEqual(['x', 'y']);
    expect(c.layoutOnly).toBe(true);
  });

  it('classifies a node that moved and was relabeled as a semantic change', () => {
    const d = diffDiagrams(
      diagram([node('a', { x: 0, y: 0, label: 'Old' })]),
      diagram([node('a', { x: 40, y: 90, label: 'New' })]),
    );
    expect(d.nodes.changed).toHaveLength(1);
    expect(d.nodes.changed[0].layoutOnly).toBe(false);
  });

  it('treats a retyped node as one change, not a removal plus an addition', () => {
    const d = diffDiagrams(
      diagram([node('a', { type: 'aws.compute.EC2' })]),
      diagram([node('a', { type: 'aws.compute.Lambda' })]),
    );
    expect(d.nodes.added).toEqual([]);
    expect(d.nodes.removed).toEqual([]);
    expect(d.nodes.changed).toHaveLength(1);
    expect(d.nodes.changed[0].fields).toEqual(['type']);
  });

  it('reports a cluster-membership change (clusterId) as a semantic node change', () => {
    const d = diffDiagrams(
      diagram([node('a', { clusterId: 'c1' })]),
      diagram([node('a', { clusterId: 'c2' })]),
    );
    expect(d.nodes.changed).toHaveLength(1);
    expect(d.nodes.changed[0].fields).toEqual(['clusterId']);
    expect(d.nodes.changed[0].layoutOnly).toBe(false);
  });

  it('reports a re-routed edge endpoint as a semantic change (edges have no layout fields)', () => {
    const d = diffDiagrams(
      diagram([node('a'), node('b'), node('c')], [edge('e1', 'a', 'b')]),
      diagram([node('a'), node('b'), node('c')], [edge('e1', 'a', 'c')]),
    );
    expect(d.edges.changed).toHaveLength(1);
    expect(d.edges.changed[0].fields).toEqual(['to']);
    expect(d.edges.changed[0].layoutOnly).toBe(false);
  });

  it('classifies a resized cluster as a layout-only change', () => {
    const d = diffDiagrams(diagram([], [], [cluster('c1', { width: 100 })]), diagram([], [], [cluster('c1', { width: 240 })]));
    expect(d.clusters.changed).toHaveLength(1);
    expect(d.clusters.changed[0].fields).toEqual(['width']);
    expect(d.clusters.changed[0].layoutOnly).toBe(true);
  });

  it('detects added clusters, frames, and edges by kind', () => {
    const d = diffDiagrams(
      diagram([node('a'), node('b')]),
      diagram([node('a'), node('b')], [edge('e1', 'a', 'b')], [cluster('c1')], [frame('f1')]),
    );
    expect(d.edges.added.map((e) => e.id)).toEqual(['e1']);
    expect(d.clusters.added.map((c) => c.id)).toEqual(['c1']);
    expect(d.frames.added.map((f) => f.id)).toEqual(['f1']);
  });

  it('reports no changes and hasChanges false for identical diagrams', () => {
    const d = diagram([node('a'), node('b')], [edge('e1', 'a', 'b')], [cluster('c1')], [frame('f1')]);
    const result = diffDiagrams(d, d);
    expect(result.hasChanges).toBe(false);
    expect(result.nodes.changed).toEqual([]);
    expect(result.edges.changed).toEqual([]);
  });

  it('sets hasChanges true even when the only change is a move', () => {
    const d = diffDiagrams(diagram([node('a', { x: 0, y: 0 })]), diagram([node('a', { x: 10, y: 10 })]));
    expect(d.hasChanges).toBe(true);
  });

  it('tolerates diagrams with an absent frames array', () => {
    const base = { nodes: [node('a')], edges: [], clusters: [] } as Diagram;
    const next = { nodes: [node('a'), node('b')], edges: [], clusters: [] } as Diagram;
    const d = diffDiagrams(base, next);
    expect(d.nodes.added.map((n) => n.id)).toEqual(['b']);
    expect(d.frames.added).toEqual([]);
  });
});
