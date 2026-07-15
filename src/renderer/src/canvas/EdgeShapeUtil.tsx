import { ShapeUtil, Polyline2d, HTMLContainer, T, Vec, type TLBaseShape } from 'tldraw';

// Endpoints are stored local to the shape's (x,y) origin, which the reconciler
// sets to the min corner of the two node centers.
export type ArchEdgeShape = TLBaseShape<
  'archEdge',
  { edgeId: string; label: string; direction: 'forward' | 'bidirectional'; x1: number; y1: number; x2: number; y2: number }
>;

export class EdgeShapeUtil extends ShapeUtil<ArchEdgeShape> {
  static override type = 'archEdge' as const;
  static override props = {
    edgeId: T.string,
    label: T.string,
    direction: T.literalEnum('forward', 'bidirectional'),
    x1: T.number,
    y1: T.number,
    x2: T.number,
    y2: T.number,
  };

  getDefaultProps(): ArchEdgeShape['props'] {
    return { edgeId: '', label: '', direction: 'forward', x1: 0, y1: 0, x2: 100, y2: 0 };
  }

  getGeometry(shape: ArchEdgeShape) {
    const { x1, y1, x2, y2 } = shape.props;
    return new Polyline2d({ points: [new Vec(x1, y1), new Vec(x2, y2)] });
  }

  // Edges are derived from node connections; they don't participate in binding.
  override canBind = () => false;

  component(shape: ArchEdgeShape) {
    const { x1, y1, x2, y2, label, direction, edgeId } = shape.props;
    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);
    const startId = `arrow-start-${edgeId}`;
    const endId = `arrow-end-${edgeId}`;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    return (
      <HTMLContainer style={{ pointerEvents: 'none' }}>
        <svg style={{ overflow: 'visible', position: 'absolute', left: 0, top: 0 }}>
          <defs>
            <marker id={endId} markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6 Z" fill="#4a5568" />
            </marker>
            <marker id={startId} markerWidth="10" markerHeight="10" refX="0" refY="3" orient="auto">
              <path d="M8,0 L0,3 L8,6 Z" fill="#4a5568" />
            </marker>
          </defs>
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#4a5568"
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
              background: 'white',
              padding: '1px 4px',
              fontSize: 11,
              color: '#4a5568',
              border: '1px solid #e2e8f0',
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
    return <line x1={x1} y1={y1} x2={x2} y2={y2} />;
  }
}
