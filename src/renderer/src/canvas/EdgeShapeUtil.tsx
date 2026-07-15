import { ShapeUtil, Polyline2d, HTMLContainer, T, Vec, type TLBaseShape } from 'tldraw';
import type { EdgeShape as EdgeShapeKind } from '@shared/ir/types';

// Endpoints are stored local to the shape's (x,y) origin, which the reconciler
// sets to the min corner of the two node centers.
export type ArchEdgeShape = TLBaseShape<
  'archEdge',
  {
    edgeId: string;
    label: string;
    direction: 'forward' | 'bidirectional';
    shape: EdgeShapeKind;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }
>;

const CORNER = 14; // rounded-corner radius for bent routing

/** SVG path from (x1,y1) to (x2,y2) for the given routing style. */
function edgePath(kind: EdgeShapeKind, x1: number, y1: number, x2: number, y2: number): string {
  if (kind === 'curved') {
    // Smooth cubic S-curve; control points offset along the dominant axis.
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (Math.abs(dx) >= Math.abs(dy)) {
      const cx = dx * 0.5;
      return `M${x1},${y1} C${x1 + cx},${y1} ${x2 - cx},${y2} ${x2},${y2}`;
    }
    const cy = dy * 0.5;
    return `M${x1},${y1} C${x1},${y1 + cy} ${x2},${y2 - cy} ${x2},${y2}`;
  }
  if (kind === 'bent') {
    // Orthogonal elbow through the midpoint, with rounded corners.
    const horizontal = Math.abs(x2 - x1) >= Math.abs(y2 - y1);
    if (horizontal) {
      const mx = (x1 + x2) / 2;
      const sx = Math.sign(x2 - x1) || 1;
      const sy = Math.sign(y2 - y1) || 1;
      const r = Math.min(CORNER, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2) || 0;
      if (r < 1) return `M${x1},${y1} L${x2},${y2}`;
      return (
        `M${x1},${y1} L${mx - sx * r},${y1} Q${mx},${y1} ${mx},${y1 + sy * r} ` +
        `L${mx},${y2 - sy * r} Q${mx},${y2} ${mx + sx * r},${y2} L${x2},${y2}`
      );
    }
    const my = (y1 + y2) / 2;
    const sx = Math.sign(x2 - x1) || 1;
    const sy = Math.sign(y2 - y1) || 1;
    const r = Math.min(CORNER, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2) || 0;
    if (r < 1) return `M${x1},${y1} L${x2},${y2}`;
    return (
      `M${x1},${y1} L${x1},${my - sy * r} Q${x1},${my} ${x1 + sx * r},${my} ` +
      `L${x2 - sx * r},${my} Q${x2},${my} ${x2},${my + sy * r} L${x2},${y2}`
    );
  }
  return `M${x1},${y1} L${x2},${y2}`;
}

export class EdgeShapeUtil extends ShapeUtil<ArchEdgeShape> {
  static override type = 'archEdge' as const;
  static override props = {
    edgeId: T.string,
    label: T.string,
    direction: T.literalEnum('forward', 'bidirectional'),
    shape: T.literalEnum('straight', 'curved', 'bent'),
    x1: T.number,
    y1: T.number,
    x2: T.number,
    y2: T.number,
  };

  getDefaultProps(): ArchEdgeShape['props'] {
    return { edgeId: '', label: '', direction: 'forward', shape: 'straight', x1: 0, y1: 0, x2: 100, y2: 0 };
  }

  getGeometry(shape: ArchEdgeShape) {
    const { x1, y1, x2, y2 } = shape.props;
    return new Polyline2d({ points: [new Vec(x1, y1), new Vec(x2, y2)] });
  }

  // Edges are derived from node connections; they don't participate in binding.
  override canBind = () => false;

  component(shape: ArchEdgeShape) {
    const { x1, y1, x2, y2, label, direction, shape: kind, edgeId } = shape.props;
    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);
    const startId = `arrow-start-${edgeId}`;
    const endId = `arrow-end-${edgeId}`;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const d = edgePath(kind, x1, y1, x2, y2);
    return (
      <HTMLContainer style={{ pointerEvents: 'none' }}>
        <svg style={{ overflow: 'visible', position: 'absolute', left: 0, top: 0 }}>
          <defs>
            <marker id={endId} markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6 Z" fill="var(--slate, #5a6675)" />
            </marker>
            <marker id={startId} markerWidth="10" markerHeight="10" refX="0" refY="3" orient="auto">
              <path d="M8,0 L0,3 L8,6 Z" fill="var(--slate, #5a6675)" />
            </marker>
          </defs>
          <path
            d={d}
            fill="none"
            stroke="var(--slate, #5a6675)"
            strokeWidth={2}
            markerEnd={`url(#${endId})`}
            markerStart={direction === 'bidirectional' ? `url(#${startId})` : undefined}
          />
        </svg>
        {label && (
          <div
            style={{
              position: 'absolute',
              left: midX - minX,
              top: midY - minY,
              transform: 'translate(-50%, -50%)',
              background: 'var(--panel, #fff)',
              padding: '1px 5px',
              fontFamily: 'var(--mono)',
              fontSize: 11,
              color: 'var(--slate, #5a6675)',
              border: '1px solid var(--line, #dbe3ec)',
              borderRadius: 4,
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </div>
        )}
      </HTMLContainer>
    );
  }

  indicator(shape: ArchEdgeShape) {
    const { x1, y1, x2, y2 } = shape.props;
    return <path d={edgePath(shape.props.shape, x1, y1, x2, y2)} fill="none" />;
  }
}
