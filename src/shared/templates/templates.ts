import type { Diagram } from '../ir/types';

/**
 * Extract a reusable template from a selection: the selected nodes, any cluster
 * they belong to, and edges whose both endpoints are selected. Annotations are
 * not part of templates (they carry no structural meaning).
 */
export function extractTemplate(diagram: Diagram, selectedNodeIds: Set<string>): Diagram {
  const nodes = diagram.nodes.filter((n) => selectedNodeIds.has(n.id));
  const clusterIds = new Set(nodes.map((n) => n.clusterId).filter((id): id is string => !!id));
  const clusters = diagram.clusters.filter((c) => clusterIds.has(c.id));
  const edges = diagram.edges.filter((e) => selectedNodeIds.has(e.from) && selectedNodeIds.has(e.to));
  return { nodes, edges, clusters, annotations: [] };
}

/**
 * Instantiate a template into a diagram-shaped subtree with entirely fresh ids
 * (so it can't collide with existing content) positioned so the template's
 * top-left corner lands at dropPoint.
 */
export function instantiateTemplate(
  template: Diagram,
  dropPoint: { x: number; y: number },
  idGenerator: () => string,
): Diagram {
  const positioned = [
    ...template.nodes.map((n) => ({ x: n.x, y: n.y })),
    ...template.clusters.map((c) => ({ x: c.x, y: c.y })),
  ];
  const minX = positioned.length ? Math.min(...positioned.map((p) => p.x)) : 0;
  const minY = positioned.length ? Math.min(...positioned.map((p) => p.y)) : 0;
  const dx = dropPoint.x - minX;
  const dy = dropPoint.y - minY;

  const nodeIdMap = new Map(template.nodes.map((n) => [n.id, idGenerator()]));
  const clusterIdMap = new Map(template.clusters.map((c) => [c.id, idGenerator()]));

  const nodes = template.nodes.map((n) => ({
    ...n,
    id: nodeIdMap.get(n.id)!,
    x: n.x + dx,
    y: n.y + dy,
    ...(n.clusterId ? { clusterId: clusterIdMap.get(n.clusterId)! } : {}),
  }));
  const clusters = template.clusters.map((c) => ({
    ...c,
    id: clusterIdMap.get(c.id)!,
    x: c.x + dx,
    y: c.y + dy,
  }));
  const edges = template.edges.map((e) => ({
    ...e,
    id: idGenerator(),
    from: nodeIdMap.get(e.from)!,
    to: nodeIdMap.get(e.to)!,
  }));

  return { nodes, edges, clusters, annotations: [] };
}
