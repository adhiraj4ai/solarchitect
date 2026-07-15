import { stringify } from 'yaml';
import type { Diagram } from '../ir/types';

export function serializeDiagram(diagram: Diagram): string {
  const doc = {
    nodes: diagram.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      label: n.label,
      x: n.x,
      y: n.y,
      ...(n.clusterId ? { clusterId: n.clusterId } : {}),
    })),
    edges: diagram.edges.map((e) => ({
      id: e.id,
      from: e.from,
      to: e.to,
      direction: e.direction,
      ...(e.label ? { label: e.label } : {}),
      ...(e.shape && e.shape !== 'straight' ? { shape: e.shape } : {}),
      ...(e.lineStyle && e.lineStyle !== 'solid' ? { lineStyle: e.lineStyle } : {}),
      ...(e.arrow === false ? { arrow: false } : {}),
    })),
    clusters: diagram.clusters.map((c) => ({
      id: c.id,
      label: c.label,
      x: c.x,
      y: c.y,
      width: c.width,
      height: c.height,
      ...(c.color && c.color !== 'blueprint' ? { color: c.color } : {}),
    })),
    annotations: diagram.annotations.map((a) => ({
      id: a.id,
      kind: a.kind,
      x: a.x,
      y: a.y,
      width: a.width,
      height: a.height,
      content: a.content,
    })),
  };
  return stringify(doc, { sortMapEntries: true });
}
