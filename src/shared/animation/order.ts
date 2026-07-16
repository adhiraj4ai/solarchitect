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
 * Resolve every element's traversal order using the unified-order-value rule,
 * with pins propagating along the flow:
 *   - edgeOrder = its explicit `step`, else the resolved order of its source
 *     node (the edge flows as its source lights);
 *   - nodeOrder = its explicit `step`, else max(incoming edge order) + 1, or 0
 *     for a source with no incoming edge.
 * So a pinned element pushes its downstream successors later, and equal values
 * form one beat. Clusters light with their first member (minimum member order).
 * If the graph has no source node (a cycle, or every node has an incoming
 * edge), we fall back to the first-declared node and set a warning — never
 * throwing.
 */
export function resolveOrder(diagram: Diagram): ResolvedOrder {
  const { nodes, edges, clusters } = diagram;
  const nodeIds = nodes.map((n) => n.id);
  const stepById = new Map(nodes.map((n) => [n.id, n.step]));

  // Adjacency (with each edge) + in-degree by effective direction.
  const out = new Map<string, Array<{ dst: string; edge: DiagramEdge }>>();
  const indeg = new Map<string, number>();
  for (const id of nodeIds) {
    out.set(id, []);
    indeg.set(id, 0);
  }
  for (const e of edges) {
    const { src, dst } = effectiveEnds(e);
    if (!out.has(src) || !indeg.has(dst)) continue; // dangling id — ignore defensively
    out.get(src)!.push({ dst, edge: e });
    indeg.set(dst, (indeg.get(dst) ?? 0) + 1);
  }

  // Sources have no incoming edge. With none, fall back to the first node.
  let warning: string | undefined;
  let sources = nodeIds.filter((id) => (indeg.get(id) ?? 0) === 0);
  if (sources.length === 0 && nodeIds.length > 0) {
    sources = [nodeIds[0]];
    warning = `No starting node (every node has an incoming edge); using the first node "${nodeIds[0]}". Add a step to set the order explicitly.`;
  }

  // Longest-path layering via Kahn's algorithm, propagating resolved orders
  // along the flow. Cycle recovery: when the queue drains but nodes remain,
  // promote the next undone node to a pseudo-source so we always terminate and
  // assign every node an order.
  const nodeOrder: Record<string, number> = {};
  const edgeOrder: Record<string, number> = {};
  const maxInEdge = new Map<string, number>(); // max order of finalized incoming edges
  const remainingIn = new Map(indeg);
  const done = new Set<string>();
  const queued = new Set<string>();
  const queue: string[] = [];
  const enqueue = (id: string) => {
    if (!queued.has(id)) {
      queue.push(id);
      queued.add(id);
    }
  };
  for (const s of sources) enqueue(s);

  const finalize = (id: string) => {
    const pin = stepById.get(id);
    const derived = (maxInEdge.get(id) ?? -1) + 1;
    const order = typeof pin === 'number' ? pin : derived;
    nodeOrder[id] = order;
    for (const { dst, edge } of out.get(id) ?? []) {
      const eOrder = typeof edge.step === 'number' ? edge.step : order;
      edgeOrder[edge.id] = eOrder;
      if (done.has(dst)) continue;
      maxInEdge.set(dst, Math.max(maxInEdge.get(dst) ?? -1, eOrder));
      remainingIn.set(dst, (remainingIn.get(dst) ?? 0) - 1);
      if ((remainingIn.get(dst) ?? 0) <= 0) enqueue(dst);
    }
  };

  for (;;) {
    while (queue.length > 0) {
      const u = queue.shift()!;
      if (done.has(u)) continue;
      done.add(u);
      finalize(u);
    }
    const next = nodeIds.find((id) => !done.has(id));
    if (!next) break;
    enqueue(next); // cycle / unreached node — seat it from the preds seen so far
  }

  // A cluster lights with its first member (the minimum member order).
  const clusterOrder: Record<string, number> = {};
  for (const c of clusters) {
    const memberOrders = nodes.filter((n) => n.clusterId === c.id).map((n) => nodeOrder[n.id]);
    if (memberOrders.length > 0) clusterOrder[c.id] = Math.min(...memberOrders);
  }

  return { nodeOrder, edgeOrder, clusterOrder, ...(warning ? { warning } : {}) };
}
