import type { Diagram } from '../ir/types';
import { effectiveEnds } from './order';

/** A source→sink journey through the graph: nodes in order, and the edges
 *  traversed between them (edgeIds.length === nodeIds.length - 1). */
export interface DiagramPath {
  nodeIds: string[];
  edgeIds: string[];
}

/** Default cap on the number of enumerated paths — a dense graph can have
 *  exponentially many. Truncation is reported, never silent. */
export const MAX_PATHS = 24;

/**
 * Enumerate distinct simple paths from each source (a node with no incoming
 * edge, by effective direction) to each reachable sink (no outgoing) or
 * dead-end, following effective arrow direction and visiting each node at most
 * once so cycles terminate. Deterministic: sources in declaration order, edges
 * in declaration order. If the graph has no source (e.g. a cycle), the first
 * node is used as the start. Stops at `max` paths and reports `truncated`.
 */
export function enumeratePaths(diagram: Diagram, max: number = MAX_PATHS): { paths: DiagramPath[]; truncated: boolean } {
  const nodeIds = diagram.nodes.map((n) => n.id);
  const out = new Map<string, Array<{ dst: string; edgeId: string }>>();
  const indeg = new Map<string, number>();
  for (const id of nodeIds) {
    out.set(id, []);
    indeg.set(id, 0);
  }
  for (const e of diagram.edges) {
    const { src, dst } = effectiveEnds(e);
    if (!out.has(src) || !indeg.has(dst)) continue;
    out.get(src)!.push({ dst, edgeId: e.id });
    indeg.set(dst, (indeg.get(dst) ?? 0) + 1);
  }

  let sources = nodeIds.filter((id) => (indeg.get(id) ?? 0) === 0);
  if (sources.length === 0 && nodeIds.length > 0) sources = [nodeIds[0]];

  const paths: DiagramPath[] = [];
  let truncated = false;

  const visit = (node: string, seen: Set<string>, nodePath: string[], edgePath: string[]) => {
    if (paths.length >= max) {
      truncated = true;
      return;
    }
    const nexts = (out.get(node) ?? []).filter((n) => !seen.has(n.dst));
    if (nexts.length === 0) {
      // A sink or a cycle dead-end: record the journey (if it crossed an edge).
      if (edgePath.length > 0) paths.push({ nodeIds: [...nodePath], edgeIds: [...edgePath] });
      return;
    }
    for (const { dst, edgeId } of nexts) {
      if (paths.length >= max) {
        truncated = true;
        break;
      }
      seen.add(dst);
      nodePath.push(dst);
      edgePath.push(edgeId);
      visit(dst, seen, nodePath, edgePath);
      nodePath.pop();
      edgePath.pop();
      seen.delete(dst);
    }
  };

  for (let i = 0; i < sources.length; i++) {
    if (paths.length >= max) {
      // Only genuinely truncated if a not-yet-processed source could start a path.
      truncated = sources.slice(i).some((id) => (out.get(id)?.length ?? 0) > 0);
      break;
    }
    visit(sources[i], new Set([sources[i]]), [sources[i]], []);
  }

  return { paths, truncated };
}
