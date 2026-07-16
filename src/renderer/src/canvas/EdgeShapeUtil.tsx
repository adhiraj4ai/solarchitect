import { useMemo } from 'react';
import { ShapeUtil, Polyline2d, HTMLContainer, T, Vec, type TLBaseShape } from 'tldraw';
import type { EdgeShape as EdgeShapeKind, EdgeLineStyle, EdgeDirection } from '@shared/ir/types';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** The point at fraction `t` (0..1) along an SVG path string, measured on a
 *  detached path element — synchronous, so it renders into both the live canvas
 *  and the static export SVG (a layout effect would not run during export). */
function pointAtFraction(d: string, t: number): { x: number; y: number } {
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  const len = path.getTotalLength();
  const pt = path.getPointAtLength(len * Math.min(1, Math.max(0, t)));
  return { x: pt.x, y: pt.y };
}

/** The deterministic flow token: a dot at fraction `t` along `d`, driven by the
 *  traversal preview/capture (not SMIL). `t < 0` renders nothing. The geometry
 *  is memoized so live editing doesn't re-measure the path every render. */
function FlowToken({ d, t }: { d: string; t: number }) {
  const pt = useMemo(() => (t < 0 ? null : pointAtFraction(d, t)), [d, t]);
  if (!pt) return null;
  return <circle className="arch-edge-token-det" cx={pt.x} cy={pt.y} r="5" fill="var(--sync, #d9822b)" stroke="none" />;
}

// Endpoints are stored local to the shape's (x,y) origin, which the reconciler
// sets to the min corner of the two node centers.
export type ArchEdgeShape = TLBaseShape<
  'archEdge',
  {
    edgeId: string;
    label: string;
    direction: EdgeDirection;
    shape: EdgeShapeKind;
    lineStyle: EdgeLineStyle;
    arrow: boolean;
    order: number;
    /** Traversal-preview token position (0..1 along from→to); <0 = no token. */
    dotT: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }
>;

/** SVG stroke-dasharray for a line style (scaled to a 2px stroke). */
function dashArray(style: EdgeLineStyle): string | undefined {
  if (style === 'dashed') return '7 5';
  if (style === 'dotted') return '1 4';
  return undefined;
}

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
    direction: T.literalEnum('forward', 'reverse', 'bidirectional'),
    shape: T.literalEnum('straight', 'curved', 'bent'),
    lineStyle: T.literalEnum('solid', 'dashed', 'dotted'),
    arrow: T.boolean,
    order: T.number,
    dotT: T.number,
    x1: T.number,
    y1: T.number,
    x2: T.number,
    y2: T.number,
  };

  getDefaultProps(): ArchEdgeShape['props'] {
    return {
      edgeId: '',
      label: '',
      direction: 'forward',
      shape: 'straight',
      lineStyle: 'solid',
      arrow: true,
      order: 0,
      dotT: -1,
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 0,
    };
  }

  getGeometry(shape: ArchEdgeShape) {
    const { x1, y1, x2, y2 } = shape.props;
    return new Polyline2d({ points: [new Vec(x1, y1), new Vec(x2, y2)] });
  }

  // Edges are derived from node connections; they don't participate in binding.
  override canBind = () => false;

  component(shape: ArchEdgeShape) {
    const { x1, y1, x2, y2, label, direction, shape: kind, lineStyle, arrow, order, dotT, edgeId } = shape.props;
    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);
    const startId = `arrow-start-${edgeId}`;
    const endId = `arrow-end-${edgeId}`;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const d = edgePath(kind, x1, y1, x2, y2);
    // reverse flows target→source (arrowhead at the `from` end); bidirectional
    // shows both heads. The animated token travels the same direction as flow.
    const headEnd = arrow && direction !== 'reverse';
    const headStart = arrow && (direction === 'bidirectional' || direction === 'reverse');
    const tokenReversed = direction === 'reverse';
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
            className="arch-edge-path"
            d={d}
            fill="none"
            stroke="var(--slate, #5a6675)"
            strokeWidth={2}
            strokeLinecap={lineStyle === 'dotted' ? 'round' : 'butt'}
            strokeDasharray={dashArray(lineStyle)}
            markerEnd={headEnd ? `url(#${endId})` : undefined}
            markerStart={headStart ? `url(#${startId})` : undefined}
          />
          {/* A token that travels along the edge in the flow direction; only
              visible in Animate mode (gated by the .animate-on ancestor in CSS).
              For a reverse edge it travels target → source via keyPoints. */}
          <circle className="arch-edge-token" r="4.5" fill="var(--sync, #d9822b)" stroke="none">
            <animateMotion
              dur="1.7s"
              repeatCount="indefinite"
              path={d}
              rotate="0"
              {...(tokenReversed ? { keyPoints: '1;0', keyTimes: '0;1', calcMode: 'linear' } : {})}
            />
          </circle>
          {/* Deterministic token for the traversal preview/capture. */}
          <FlowToken d={d} t={dotT} />
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
        {/* Traversal-order badge; shown only when Steps is on (.steps-on ancestor). */}
        <span
          className="arch-step-badge arch-step-badge--edge"
          title={`Step ${order}`}
          style={{ position: 'absolute', left: midX - minX, top: midY - minY - 16 }}
        >
          {order}
        </span>
      </HTMLContainer>
    );
  }

  indicator(shape: ArchEdgeShape) {
    const { x1, y1, x2, y2 } = shape.props;
    return <path d={edgePath(shape.props.shape, x1, y1, x2, y2)} fill="none" />;
  }
}
