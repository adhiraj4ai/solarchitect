import { parse as parseYaml } from 'yaml';
import { isValidNodeType } from '../ir/taxonomy';
import { ACCENT_COLORS } from '../ir/types';
import type {
  Diagram,
  DiagramNode,
  DiagramEdge,
  DiagramCluster,
  DiagramAnnotation,
  DiagramFrame,
} from '../ir/types';

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

    // Clusters first, so node.clusterId references can be validated against them.
    const clusters: DiagramCluster[] = asList(doc.clusters, 'clusters').map((item, i) => {
      const c = asMapping(item, `clusters[${i}]`);
      const color = c.color as DiagramCluster['color'];
      if (color && !ACCENT_COLORS.includes(color)) {
        throw new ValidationError(
          `Cluster color must be one of ${ACCENT_COLORS.join(', ')} (got "${color}")`,
          `clusters[${i}].color`,
        );
      }
      return {
        id: c.id as string,
        label: c.label as string,
        x: c.x as number,
        y: c.y as number,
        width: c.width as number,
        height: c.height as number,
        ...(color ? { color } : {}),
      };
    });
    const clusterIds = new Set(clusters.map((c) => c.id));

    const nodes: DiagramNode[] = [];
    const nodeIds = new Set<string>();
    asList(doc.nodes, 'nodes').forEach((item, i) => {
      const n = asMapping(item, `nodes[${i}]`);
      if (!isValidNodeType(n.type as string)) {
        throw new ValidationError(`Unknown node type "${n.type}"`, `nodes[${i}].type`);
      }
      if (n.clusterId && !clusterIds.has(n.clusterId as string)) {
        throw new ValidationError(`Node references unknown cluster "${n.clusterId}"`, `nodes[${i}].clusterId`);
      }
      if (n.x !== undefined && n.x !== null && typeof n.x !== 'number') {
        throw new ValidationError(`Node x must be a number (got "${n.x}")`, `nodes[${i}].x`);
      }
      if (n.y !== undefined && n.y !== null && typeof n.y !== 'number') {
        throw new ValidationError(`Node y must be a number (got "${n.y}")`, `nodes[${i}].y`);
      }
      const nodeColor = n.color as DiagramNode['color'];
      if (nodeColor && !ACCENT_COLORS.includes(nodeColor)) {
        throw new ValidationError(
          `Node color must be one of ${ACCENT_COLORS.join(', ')} (got "${nodeColor}")`,
          `nodes[${i}].color`,
        );
      }
      nodeIds.add(n.id as string);
      // x/y are optional — coordinate-free nodes are auto-laid-out downstream.
      nodes.push({
        id: n.id as string,
        type: n.type as string,
        label: n.label as string,
        ...(typeof n.x === 'number' ? { x: n.x } : {}),
        ...(typeof n.y === 'number' ? { y: n.y } : {}),
        ...(n.clusterId ? { clusterId: n.clusterId as string } : {}),
        ...(nodeColor ? { color: nodeColor } : {}),
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
      const shape = e.shape as DiagramEdge['shape'];
      if (shape && shape !== 'straight' && shape !== 'curved' && shape !== 'bent') {
        throw new ValidationError(`Edge shape must be straight, curved, or bent (got "${shape}")`, `edges[${i}].shape`);
      }
      const lineStyle = e.lineStyle as DiagramEdge['lineStyle'];
      if (lineStyle && lineStyle !== 'solid' && lineStyle !== 'dashed' && lineStyle !== 'dotted') {
        throw new ValidationError(
          `Edge lineStyle must be solid, dashed, or dotted (got "${lineStyle}")`,
          `edges[${i}].lineStyle`,
        );
      }
      if (e.arrow !== undefined && typeof e.arrow !== 'boolean') {
        throw new ValidationError(`Edge arrow must be true or false (got "${e.arrow}")`, `edges[${i}].arrow`);
      }
      edges.push({
        id: e.id as string,
        from: e.from as string,
        to: e.to as string,
        direction: (e.direction as DiagramEdge['direction']) ?? 'forward',
        ...(e.label ? { label: e.label as string } : {}),
        ...(shape ? { shape } : {}),
        ...(lineStyle ? { lineStyle } : {}),
        ...(e.arrow === false ? { arrow: false } : {}),
      });
    });

    // A legacy `annotations` key is ignored here (not part of the Diagram
    // anymore); the one-time migration reads it via extractAnnotations().

    const frames: DiagramFrame[] = asList(doc.frames, 'frames').map((item, i) => {
      const f = asMapping(item, `frames[${i}]`);
      return {
        id: f.id as string,
        label: f.label as string,
        x: f.x as number,
        y: f.y as number,
        width: f.width as number,
        height: f.height as number,
        ...(f.preset ? { preset: f.preset as string } : {}),
      };
    });

    return { ok: true, diagram: { nodes, edges, clusters, frames } };
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, error: { message: e.message, path: e.path } };
    return { ok: false, error: { message: `Invalid diagram: ${(e as Error).message}`, path: '' } };
  }
}

/**
 * Read any legacy `annotations` from a diagram's YAML, for the one-time
 * migration onto the whiteboard. Returns [] for well-formed diagrams that have
 * none, and swallows malformed input (migration is best-effort, never fatal).
 */
export function extractAnnotations(yamlText: string): DiagramAnnotation[] {
  try {
    const raw = parseYaml(yamlText) as { annotations?: unknown } | null;
    const list = raw && typeof raw === 'object' ? raw.annotations : undefined;
    if (!Array.isArray(list)) return [];
    return list
      .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
      .map((a) => ({
        id: String(a.id ?? ''),
        kind: (a.kind as DiagramAnnotation['kind']) ?? 'text',
        x: Number(a.x) || 0,
        y: Number(a.y) || 0,
        width: Number(a.width) || 160,
        height: Number(a.height) || 100,
        content: String(a.content ?? ''),
      }));
  } catch {
    return [];
  }
}
