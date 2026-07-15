import { createShapeId, type Editor, type TLShapePartial } from 'tldraw';
import { NODE_DEFAULT_WIDTH, NODE_DEFAULT_HEIGHT, type ArchNodeShape } from './NodeShapeUtil';
import type { ArchClusterShape } from './ClusterShapeUtil';
import type { ArchEdgeShape } from './EdgeShapeUtil';
import type { DiagramNode, DiagramCluster, DiagramEdge } from '@shared/ir/types';

// ---- Nodes ----

/** The tldraw shape props that represent an IR node. */
export function nodeToShapeProps(n: DiagramNode): ArchNodeShape['props'] {
  return { nodeId: n.id, nodeType: n.type, label: n.label, w: NODE_DEFAULT_WIDTH, h: NODE_DEFAULT_HEIGHT };
}

export function nodesToShapes(nodes: DiagramNode[]): TLShapePartial[] {
  return nodes.map((n) => ({ id: createShapeId(n.id), type: 'archNode', x: n.x, y: n.y, props: nodeToShapeProps(n) }));
}

export function getArchNodeShapes(editor: Editor): ArchNodeShape[] {
  return editor.getCurrentPageShapes().filter((s): s is ArchNodeShape => s.type === 'archNode');
}

/**
 * Read an IR node out of its tldraw shape. Only the fields the shape carries
 * (id/type/label/position) come from here; fields with no shape representation
 * (e.g. clusterId) must be merged back in by the caller from the prior IR.
 */
export function shapeToNode(shape: ArchNodeShape): DiagramNode {
  return {
    id: shape.props.nodeId,
    type: shape.props.nodeType,
    label: shape.props.label,
    x: shape.x,
    y: shape.y,
  };
}

export function nodeCenter(n: DiagramNode): { x: number; y: number } {
  return { x: n.x + NODE_DEFAULT_WIDTH / 2, y: n.y + NODE_DEFAULT_HEIGHT / 2 };
}

// ---- Clusters ----

export function clusterToShape(c: DiagramCluster): TLShapePartial {
  return {
    id: createShapeId(c.id),
    type: 'archCluster',
    x: c.x,
    y: c.y,
    props: { clusterId: c.id, label: c.label, w: c.width, h: c.height },
  };
}

export function clustersToShapes(clusters: DiagramCluster[]): TLShapePartial[] {
  return clusters.map(clusterToShape);
}

export function getArchClusterShapes(editor: Editor): ArchClusterShape[] {
  return editor.getCurrentPageShapes().filter((s): s is ArchClusterShape => s.type === 'archCluster');
}

/** Read an IR cluster out of its tldraw shape. */
export function shapeToCluster(s: ArchClusterShape): DiagramCluster {
  return { id: s.props.clusterId, label: s.props.label, x: s.x, y: s.y, width: s.props.w, height: s.props.h };
}

// ---- Edges ----

/** Build an edge shape whose endpoints run between the centers of its two nodes. */
export function edgeToShape(edge: DiagramEdge, nodeById: Map<string, DiagramNode>): TLShapePartial | null {
  const from = nodeById.get(edge.from);
  const to = nodeById.get(edge.to);
  if (!from || !to) return null;
  const a = nodeCenter(from);
  const b = nodeCenter(to);
  const originX = Math.min(a.x, b.x);
  const originY = Math.min(a.y, b.y);
  return {
    id: createShapeId(edge.id),
    type: 'archEdge',
    x: originX,
    y: originY,
    props: {
      edgeId: edge.id,
      label: edge.label ?? '',
      direction: edge.direction,
      x1: a.x - originX,
      y1: a.y - originY,
      x2: b.x - originX,
      y2: b.y - originY,
    },
  };
}

export function getArchEdgeShapes(editor: Editor): ArchEdgeShape[] {
  return editor.getCurrentPageShapes().filter((s): s is ArchEdgeShape => s.type === 'archEdge');
}

type EdgeShapeLike = { x: number; y: number; props: ArchEdgeShape['props'] };

/** Field-by-field equality of two edge shapes (avoids key-order-fragile JSON compares). */
export function edgeShapesEqual(a: EdgeShapeLike, b: EdgeShapeLike): boolean {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.props.edgeId === b.props.edgeId &&
    a.props.label === b.props.label &&
    a.props.direction === b.props.direction &&
    a.props.x1 === b.props.x1 &&
    a.props.y1 === b.props.y1 &&
    a.props.x2 === b.props.x2 &&
    a.props.y2 === b.props.y2
  );
}
