import { createShapeId, type Editor, type TLShapePartial } from 'tldraw';
import { NODE_DEFAULT_WIDTH, NODE_DEFAULT_HEIGHT, type ArchNodeShape } from './NodeShapeUtil';
import type { DiagramNode } from '@shared/ir/types';

/** The tldraw shape props that represent an IR node. */
export function nodeToShapeProps(n: DiagramNode): ArchNodeShape['props'] {
  return { nodeId: n.id, nodeType: n.type, label: n.label, w: NODE_DEFAULT_WIDTH, h: NODE_DEFAULT_HEIGHT };
}

/** Project IR nodes into tldraw shape records for rendering on the canvas. */
export function nodesToShapes(nodes: DiagramNode[]): TLShapePartial[] {
  return nodes.map((n) => ({
    id: createShapeId(n.id),
    type: 'archNode',
    x: n.x,
    y: n.y,
    props: nodeToShapeProps(n),
  }));
}

/** All archNode shapes currently on the canvas. */
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
