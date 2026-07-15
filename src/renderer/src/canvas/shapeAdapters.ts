import { createShapeId, type TLShapePartial } from 'tldraw';
import { NODE_DEFAULT_WIDTH, NODE_DEFAULT_HEIGHT, type ArchNodeShape } from './NodeShapeUtil';
import type { DiagramNode } from '@shared/ir/types';

/** Project IR nodes into tldraw shape records for rendering on the canvas. */
export function nodesToShapes(nodes: DiagramNode[]): TLShapePartial[] {
  return nodes.map((n) => ({
    id: createShapeId(n.id),
    type: 'archNode',
    x: n.x,
    y: n.y,
    props: {
      nodeId: n.id,
      nodeType: n.type,
      label: n.label,
      w: NODE_DEFAULT_WIDTH,
      h: NODE_DEFAULT_HEIGHT,
    },
  }));
}

/** Read an IR node back out of its tldraw shape (position comes from the shape). */
export function shapeToNode(shape: ArchNodeShape): DiagramNode {
  return {
    id: shape.props.nodeId,
    type: shape.props.nodeType,
    label: shape.props.label,
    x: shape.x,
    y: shape.y,
  };
}
