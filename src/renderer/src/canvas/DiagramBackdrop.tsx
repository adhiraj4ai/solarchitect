import type { Diagram } from '@shared/ir/types';
import { resolveNodePositions } from '@shared/ir/layout';
import { NODE_DEFAULT_WIDTH, NODE_DEFAULT_HEIGHT } from './NodeShapeUtil';

/**
 * A read-only schematic of the diagram, drawn straight from the IR in page
 * coordinates. It's rendered behind the whiteboard's freeform layer and
 * transformed to match the whiteboard camera, so it lines up 1:1 with anything
 * the user sketches over it. Not a pixel-perfect copy of the diagram canvas —
 * a faithful, correctly-positioned silhouette to trace over.
 */
export function DiagramBackdrop({ diagram }: { diagram: Diagram }) {
  const nodes = resolveNodePositions(diagram);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const cx = (n: { x?: number }) => (n.x ?? 0) + NODE_DEFAULT_WIDTH / 2;
  const cy = (n: { y?: number }) => (n.y ?? 0) + NODE_DEFAULT_HEIGHT / 2;

  return (
    <svg className="wb-backdrop__svg" style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden="true">
      {(diagram.frames ?? []).map((f) => (
        <g key={f.id}>
          <rect x={f.x} y={f.y} width={f.width} height={f.height} fill="#ffffff" stroke="#c6d0dc" strokeWidth={1} />
          <text x={f.x} y={f.y - 7} fontSize={12} fill="#5a6675">
            {f.label}
          </text>
        </g>
      ))}

      {diagram.clusters.map((c) => (
        <g key={c.id}>
          <rect
            x={c.x}
            y={c.y}
            width={c.width}
            height={c.height}
            rx={10}
            fill="rgba(43,87,198,0.06)"
            stroke="#2b57c6"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
          <text x={c.x + 10} y={c.y + 17} fontSize={12} fontWeight={600} fill="#1e3f96">
            {c.label}
          </text>
        </g>
      ))}

      {diagram.edges.map((e) => {
        const a = byId.get(e.from);
        const b = byId.get(e.to);
        if (!a || !b) return null;
        return <line key={e.id} x1={cx(a)} y1={cy(a)} x2={cx(b)} y2={cy(b)} stroke="#5a6675" strokeWidth={2} />;
      })}

      {nodes.map((n) => (
        <g key={n.id}>
          <rect
            x={n.x ?? 0}
            y={n.y ?? 0}
            width={NODE_DEFAULT_WIDTH}
            height={NODE_DEFAULT_HEIGHT}
            rx={10}
            fill="#ffffff"
            stroke="#c6d0dc"
            strokeWidth={1}
          />
          <text
            x={(n.x ?? 0) + NODE_DEFAULT_WIDTH / 2}
            y={(n.y ?? 0) + NODE_DEFAULT_HEIGHT / 2 + 5}
            textAnchor="middle"
            fontSize={13}
            fontWeight={600}
            fill="#101722"
          >
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
