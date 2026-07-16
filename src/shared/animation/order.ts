import type { Diagram, DiagramEdge } from '../ir/types';

/** The resolved traversal order of a diagram: an integer per node, edge, and
 *  cluster. Equal numbers play in the same beat. */
export interface ResolvedOrder {
  nodeOrder: Record<string, number>;
  edgeOrder: Record<string, number>;
  clusterOrder: Record<string, number>;
  /** Non-blocking hint set when the graph has no natural starting node (e.g. a
   *  cycle), so we fell back to the first-declared node. */
  warning?: string;
}

/** The (source, target) an edge flows between, honouring its direction.
 *  `reverse` swaps the endpoints; `bidirectional` is treated as forward for the
 *  purpose of deriving a linear order. */
function effectiveEnds(edge: DiagramEdge): { src: string; dst: string } {
  if (edge.direction === 'reverse') return { src: edge.to, dst: edge.from };
  return { src: edge.from, dst: edge.to };
}

/**
 * Resolve every element's traversal order using the unified-order-value rule:
 * an element's order is its explicit `step` if set, else its topological depth
 * from the source (longest path following effective arrow direction). Equal
 * values form one beat. Clusters light with their first member. If the graph
 * has no source node (a cycle, or every node has an incoming edge), we fall
 * back to the first-declared node and set a warning — never throwing.
 */
export function resolveOrder(diagram: Diagram): ResolvedOrder {
  const { nodes, edges, clusters } = diagram;
  const nodeIds = nodes.map((n) => n.id);

  // Adjacency + in-degree by effective direction.
  const out = new Map<string, Array<{ dst: string }>>();
  const indeg = new Map<string, number>();
  for (const id of nodeIds) {
    out.set(id, []);
    indeg.set(id, 0);
  }
  for (const e of edges) {
    const { src, dst } = effectiveEnds(e);
    if (!out.has(src) || !indeg.has(dst)) continue; // dangling id — ignore defensively
    out.get(src)!.push({ dst });
    indeg.set(dst, (indeg.get(dst) ?? 0) + 1);
  }

  // Sources have no incoming edge. With none, fall back to the first node.
  let warning: string | undefined;
  let sources = nodeIds.filter((id) => (indeg.get(id) ?? 0) === 0);
  if (sources.length === 0 && nodeIds.length > 0) {
    sources = [nodeIds[0]];
    warning = `No starting node (every node has an incoming edge); using the first node "${nodeIds[0]}". Add a step to set the order explicitly.`;
  }

  // Longest-path layering via Kahn's algorithm, with cycle recovery: when the
  // queue drains but nodes remain, promote the next undone node to a
  // pseudo-source so we always terminate and assign every node a depth.
  const depth = new Map<string, number>();
  const remainingIn = new Map(indeg);
  const done = new Set<string>();
  const queued = new Set<string>();
  const queue: string[] = [];
  const enqueue = (id: string, d: number) => {
    depth.set(id, Math.max(depth.get(id) ?? 0, d));
    if (!queued.has(id)) {
      queue.push(id);
      queued.add(id);
    }
  };
  for (const s of sources) enqueue(s, 0);

  const maxDepth = () => (depth.size ? Math.max(...depth.values()) : -1);
  for (;;) {
    while (queue.length > 0) {
      const u = queue.shift()!;
      if (done.has(u)) continue;
      done.add(u);
      const du = depth.get(u) ?? 0;
      for (const { dst } of out.get(u) ?? []) {
        if (done.has(dst)) continue;
        depth.set(dst, Math.max(depth.get(dst) ?? 0, du + 1));
        remainingIn.set(dst, (remainingIn.get(dst) ?? 0) - 1);
        if ((remainingIn.get(dst) ?? 0) <= 0) enqueue(dst, depth.get(dst) ?? du + 1);
      }
    }
    const next = nodeIds.find((id) => !done.has(id));
    if (!next) break;
    // Cycle / unreached node: seat it just after everything placed so far.
    enqueue(next, depth.has(next) ? (depth.get(next) as number) : maxDepth() + 1);
  }

  // Explicit `step` pins override the derived depth; equal values share a beat.
  const nodeOrder: Record<string, number> = {};
  for (const n of nodes) nodeOrder[n.id] = typeof n.step === 'number' ? n.step : (depth.get(n.id) ?? 0);

  const edgeOrder: Record<string, number> = {};
  for (const e of edges) {
    const { src } = effectiveEnds(e);
    edgeOrder[e.id] = typeof e.step === 'number' ? e.step : (nodeOrder[src] ?? 0);
  }

  // A cluster lights with its first member (the minimum member order).
  const clusterOrder: Record<string, number> = {};
  for (const c of clusters) {
    const memberOrders = nodes.filter((n) => n.clusterId === c.id).map((n) => nodeOrder[n.id]);
    if (memberOrders.length > 0) clusterOrder[c.id] = Math.min(...memberOrders);
  }

  return { nodeOrder, edgeOrder, clusterOrder, ...(warning ? { warning } : {}) };
}
