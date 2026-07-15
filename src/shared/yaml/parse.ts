import { parse as parseYaml } from 'yaml';
import { isValidNodeType } from '../ir/taxonomy';
import type { Diagram, DiagramNode, DiagramEdge, DiagramCluster, DiagramAnnotation } from '../ir/types';

export interface ParseError {
  message: string;
  path: string;
}

export type ParseResult = { ok: true; diagram: Diagram } | { ok: false; error: ParseError };

class ValidationError extends Error {
  constructor(
    message: string,
    readonly path: string,
  ) {
    super(message);
  }
}

function asList(value: unknown, key: string): unknown[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ValidationError(`"${key}" must be a list`, key);
  return value;
}

function asMapping(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError(`${path} must be a mapping`, path);
  }
  return value as Record<string, unknown>;
}

export function parseDiagram(yamlText: string): ParseResult {
  let raw: unknown;
  try {
    raw = parseYaml(yamlText) ?? {};
  } catch (e) {
    return { ok: false, error: { message: `YAML syntax error: ${(e as Error).message}`, path: '' } };
  }

  try {
    const doc = asMapping(raw, 'document');

    const nodes: DiagramNode[] = [];
    const nodeIds = new Set<string>();
    asList(doc.nodes, 'nodes').forEach((item, i) => {
      const n = asMapping(item, `nodes[${i}]`);
      if (!isValidNodeType(n.type as string)) {
        throw new ValidationError(`Unknown node type "${n.type}"`, `nodes[${i}].type`);
      }
      nodeIds.add(n.id as string);
      nodes.push({
        id: n.id as string,
        type: n.type as string,
        label: n.label as string,
        x: n.x as number,
        y: n.y as number,
        ...(n.clusterId ? { clusterId: n.clusterId as string } : {}),
      });
    });

    const edges: DiagramEdge[] = [];
    asList(doc.edges, 'edges').forEach((item, i) => {
      const e = asMapping(item, `edges[${i}]`);
      if (!nodeIds.has(e.from as string) || !nodeIds.has(e.to as string)) {
        throw new ValidationError(
          `Edge references unknown node id ("${e.from}" -> "${e.to}")`,
          `edges[${i}]`,
        );
      }
      edges.push({
        id: e.id as string,
        from: e.from as string,
        to: e.to as string,
        direction: (e.direction as DiagramEdge['direction']) ?? 'forward',
        ...(e.label ? { label: e.label as string } : {}),
      });
    });

    const clusters: DiagramCluster[] = asList(doc.clusters, 'clusters').map((item, i) => {
      const c = asMapping(item, `clusters[${i}]`);
      return {
        id: c.id as string,
        label: c.label as string,
        x: c.x as number,
        y: c.y as number,
        width: c.width as number,
        height: c.height as number,
      };
    });

    const annotations: DiagramAnnotation[] = asList(doc.annotations, 'annotations').map((item, i) => {
      const a = asMapping(item, `annotations[${i}]`);
      return {
        id: a.id as string,
        kind: a.kind as DiagramAnnotation['kind'],
        x: a.x as number,
        y: a.y as number,
        width: a.width as number,
        height: a.height as number,
        content: a.content as string,
      };
    });

    return { ok: true, diagram: { nodes, edges, clusters, annotations } };
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, error: { message: e.message, path: e.path } };
    return { ok: false, error: { message: `Invalid diagram: ${(e as Error).message}`, path: '' } };
  }
}
