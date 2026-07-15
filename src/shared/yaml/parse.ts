import { parse as parseYaml } from 'yaml';
import { isValidNodeType } from '../ir/taxonomy';
import type { Diagram, DiagramNode, DiagramEdge, DiagramCluster, DiagramAnnotation } from '../ir/types';

export interface ParseError {
  message: string;
  path: string;
}

export type ParseResult = { ok: true; diagram: Diagram } | { ok: false; error: ParseError };

export function parseDiagram(yamlText: string): ParseResult {
  let raw: any;
  try {
    raw = parseYaml(yamlText) ?? {};
  } catch (e) {
    return { ok: false, error: { message: `YAML syntax error: ${(e as Error).message}`, path: '' } };
  }

  const nodes: DiagramNode[] = [];
  const nodeIds = new Set<string>();
  const rawNodes = raw.nodes ?? [];
  for (let i = 0; i < rawNodes.length; i++) {
    const n = rawNodes[i];
    if (!isValidNodeType(n.type)) {
      return { ok: false, error: { message: `Unknown node type "${n.type}"`, path: `nodes[${i}].type` } };
    }
    nodeIds.add(n.id);
    nodes.push({
      id: n.id,
      type: n.type,
      label: n.label,
      x: n.x,
      y: n.y,
      ...(n.clusterId ? { clusterId: n.clusterId } : {}),
    });
  }

  const edges: DiagramEdge[] = [];
  const rawEdges = raw.edges ?? [];
  for (let i = 0; i < rawEdges.length; i++) {
    const e = rawEdges[i];
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) {
      return {
        ok: false,
        error: { message: `Edge references unknown node id ("${e.from}" -> "${e.to}")`, path: `edges[${i}]` },
      };
    }
    edges.push({
      id: e.id,
      from: e.from,
      to: e.to,
      direction: e.direction ?? 'forward',
      ...(e.label ? { label: e.label } : {}),
    });
  }

  const clusters: DiagramCluster[] = (raw.clusters ?? []).map((c: any) => ({
    id: c.id,
    label: c.label,
    x: c.x,
    y: c.y,
    width: c.width,
    height: c.height,
  }));

  const annotations: DiagramAnnotation[] = (raw.annotations ?? []).map((a: any) => ({
    id: a.id,
    kind: a.kind,
    x: a.x,
    y: a.y,
    width: a.width,
    height: a.height,
    content: a.content,
    ...(a.style ? { style: a.style } : {}),
  }));

  return { ok: true, diagram: { nodes, edges, clusters, annotations } };
}
