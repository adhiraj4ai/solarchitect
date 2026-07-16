import type { Diagram } from '../ir/types';

/**
 * A structural outline of a diagram, derived purely from the IR. Mirrors the
 * canvas: clusters hold their member nodes (membership read from each node's
 * clusterId — the single source of truth), with ungrouped nodes, edges, and
 * frames listed alongside. Every entry carries the IR id so clicking it can
 * select/reveal the shape on the canvas.
 */

export interface OutlineNodeEntry {
  kind: 'node';
  id: string;
  label: string;
  nodeType: string;
}

export interface OutlineClusterEntry {
  kind: 'cluster';
  id: string;
  label: string;
  children: OutlineNodeEntry[];
}

export interface OutlineEdgeEntry {
  kind: 'edge';
  id: string;
  label: string;
}

export interface OutlineFrameEntry {
  kind: 'frame';
  id: string;
  label: string;
}

export interface Outline {
  clusters: OutlineClusterEntry[];
  ungrouped: OutlineNodeEntry[];
  edges: OutlineEdgeEntry[];
  frames: OutlineFrameEntry[];
  /** True when the diagram has no nodes, clusters, edges, or frames. */
  isEmpty: boolean;
}

function nodeEntry(n: { id: string; label: string; type: string }): OutlineNodeEntry {
  return { kind: 'node', id: n.id, label: n.label, nodeType: n.type };
}

export function buildOutline(diagram: Diagram): Outline {
  const labelById = new Map(diagram.nodes.map((n) => [n.id, n.label]));
  const clusterIds = new Set(diagram.clusters.map((c) => c.id));

  const clusters: OutlineClusterEntry[] = diagram.clusters.map((c) => ({
    kind: 'cluster',
    id: c.id,
    label: c.label,
    children: diagram.nodes.filter((n) => n.clusterId === c.id).map(nodeEntry),
  }));

  const ungrouped: OutlineNodeEntry[] = diagram.nodes
    .filter((n) => !n.clusterId || !clusterIds.has(n.clusterId))
    .map(nodeEntry);

  const edges: OutlineEdgeEntry[] = diagram.edges.map((e) => {
    const from = labelById.get(e.from) ?? e.from;
    const to = labelById.get(e.to) ?? e.to;
    return { kind: 'edge', id: e.id, label: e.label?.trim() ? e.label : `${from} → ${to}` };
  });

  const frames: OutlineFrameEntry[] = (diagram.frames ?? []).map((f) => ({
    kind: 'frame',
    id: f.id,
    label: f.label,
  }));

  const isEmpty =
    diagram.nodes.length === 0 &&
    diagram.clusters.length === 0 &&
    diagram.edges.length === 0 &&
    frames.length === 0;

  return { clusters, ungrouped, edges, frames, isEmpty };
}
