import { useMemo, useState, type CSSProperties } from 'react';
import type { Diagram } from '@shared/ir/types';
import { resolveNodePositions } from '@shared/ir/layout';
import type { DiagramDiff, KindDiff } from '@shared/diff/diffDiagrams';
import { NODE_DEFAULT_WIDTH, NODE_DEFAULT_HEIGHT } from '../canvas/NodeShapeUtil';

type ChangeClass = 'added' | 'removed' | 'changed' | 'moved' | 'unchanged';

/** Stroke / fill / label color per change class. Unchanged stays faint so the
 *  surrounding architecture is legible without competing with the changes. */
const CLASS_STYLE: Record<ChangeClass, { stroke: string; fill: string; dash?: string; label: string }> = {
  added: { stroke: '#1a7f37', fill: 'rgba(26,127,55,0.10)', label: '#0f5b26' },
  removed: { stroke: '#b3261e', fill: 'rgba(179,38,30,0.06)', dash: '5 3', label: '#8a1c16' },
  changed: { stroke: '#9a6700', fill: 'rgba(154,103,0,0.10)', label: '#6b4800' },
  moved: { stroke: '#2b57c6', fill: 'rgba(43,87,198,0.06)', dash: '2 3', label: '#1e3f96' },
  unchanged: { stroke: '#c6d0dc', fill: '#ffffff', label: '#101722' },
};

function classMaps(diff: DiagramDiff) {
  const of = <T extends { id: string }>(k: KindDiff<T>): Map<string, ChangeClass> => {
    const m = new Map<string, ChangeClass>();
    k.added.forEach((e) => m.set(e.id, 'added'));
    k.removed.forEach((e) => m.set(e.id, 'removed'));
    k.changed.forEach((c) => m.set(c.id, c.layoutOnly ? 'moved' : 'changed'));
    return m;
  };
  return {
    nodes: of(diff.nodes),
    edges: of(diff.edges),
    clusters: of(diff.clusters),
    frames: of(diff.frames),
  };
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A read-only visual review of what changed in a diagram between two versions. */
export function DiffReviewView({
  base,
  next,
  diff,
  onClose,
}: {
  base: Diagram;
  next: Diagram;
  diff: DiagramDiff;
  onClose: () => void;
}) {
  const [semanticOnly, setSemanticOnly] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const cls = useMemo(() => classMaps(diff), [diff]);

  const nextPos = useMemo(() => new Map(resolveNodePositions(next).map((n) => [n.id, n])), [next]);
  const basePos = useMemo(() => new Map(resolveNodePositions(base).map((n) => [n.id, n])), [base]);

  const nodeBox = (p: { x?: number; y?: number }): Box => ({
    x: p.x ?? 0,
    y: p.y ?? 0,
    width: NODE_DEFAULT_WIDTH,
    height: NODE_DEFAULT_HEIGHT,
  });

  // The viewBox fits every element from either version, so removed/added content
  // is never clipped.
  const viewBox = useMemo(() => {
    const boxes: Box[] = [];
    nextPos.forEach((n) => boxes.push(nodeBox(n)));
    basePos.forEach((n) => {
      if (cls.nodes.get(n.id) === 'removed' || cls.nodes.get(n.id) === 'moved') boxes.push(nodeBox(n));
    });
    for (const c of next.clusters) boxes.push(c);
    for (const c of base.clusters) if (cls.clusters.get(c.id) === 'removed') boxes.push(c);
    for (const f of next.frames ?? []) boxes.push(f);
    for (const f of base.frames ?? []) if (cls.frames.get(f.id) === 'removed') boxes.push(f);
    if (boxes.length === 0) return '0 0 400 300';
    const minX = Math.min(...boxes.map((b) => b.x));
    const minY = Math.min(...boxes.map((b) => b.y));
    const maxX = Math.max(...boxes.map((b) => b.x + b.width));
    const maxY = Math.max(...boxes.map((b) => b.y + b.height));
    const pad = 48;
    return `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;
  }, [nextPos, basePos, next, base, cls]);

  const centerNode = (p: { x?: number; y?: number }) => ({
    x: (p.x ?? 0) + NODE_DEFAULT_WIDTH / 2,
    y: (p.y ?? 0) + NODE_DEFAULT_HEIGHT / 2,
  });

  function nodeClassOf(id: string): ChangeClass {
    return cls.nodes.get(id) ?? 'unchanged';
  }

  const emphasis = (id: string) =>
    highlightId === id ? { filter: 'drop-shadow(0 0 0 2px #2b57c6)', strokeWidth: 3 } : {};

  if (!diff.hasChanges) {
    return (
      <div className="diffview" data-testid="diff-review">
        <div className="diffview__bar">
          <span className="diffview__title">Review changes</span>
          <span className="diffview__spacer" />
          <button className="btn btn--sm" data-testid="diff-close" onClick={onClose}>
            ✕ Close
          </button>
        </div>
        <div className="diffview__empty" data-testid="diff-nochanges">
          No changes since the last commit.
        </div>
      </div>
    );
  }

  const counts = {
    added: diff.nodes.added.length + diff.edges.added.length + diff.clusters.added.length + diff.frames.added.length,
    removed:
      diff.nodes.removed.length + diff.edges.removed.length + diff.clusters.removed.length + diff.frames.removed.length,
    changed: [diff.nodes, diff.edges, diff.clusters, diff.frames].reduce(
      (n, k) => n + k.changed.filter((c) => !c.layoutOnly).length,
      0,
    ),
    moved: [diff.nodes, diff.edges, diff.clusters, diff.frames].reduce(
      (n, k) => n + k.changed.filter((c) => c.layoutOnly).length,
      0,
    ),
  };

  return (
    <div className="diffview" data-testid="diff-review">
      <div className="diffview__bar">
        <span className="diffview__title">Review changes</span>
        <span className="diffview__summary" data-testid="diff-summary">
          <span className="diff-chip diff-chip--added">+{counts.added}</span>
          <span className="diff-chip diff-chip--removed">−{counts.removed}</span>
          <span className="diff-chip diff-chip--changed">~{counts.changed}</span>
          {!semanticOnly && <span className="diff-chip diff-chip--moved">⇄{counts.moved}</span>}
        </span>
        <span className="diffview__spacer" />
        <label className="diffview__filter">
          <input
            type="checkbox"
            data-testid="diff-semantic-only"
            checked={semanticOnly}
            onChange={(e) => setSemanticOnly(e.target.checked)}
          />
          Semantic only
        </label>
        <button className="btn btn--sm" data-testid="diff-close" onClick={onClose}>
          ✕ Close
        </button>
      </div>

      <div className="diffview__body">
        <svg className="diffview__canvas" data-testid="diff-canvas" viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
          {/* Frames */}
          {(next.frames ?? []).map((f) => {
            const c = cls.frames.get(f.id) ?? 'unchanged';
            if (semanticOnly && c === 'moved') return frameGlyph(f, 'unchanged');
            return frameGlyph(f, c, emphasis(f.id));
          })}
          {(base.frames ?? [])
            .filter((f) => cls.frames.get(f.id) === 'removed')
            .map((f) => frameGlyph(f, 'removed', emphasis(f.id)))}

          {/* Clusters */}
          {next.clusters.map((c) => {
            const kind = cls.clusters.get(c.id) ?? 'unchanged';
            const eff = semanticOnly && kind === 'moved' ? 'unchanged' : kind;
            return clusterGlyph(c, eff, emphasis(c.id));
          })}
          {base.clusters
            .filter((c) => cls.clusters.get(c.id) === 'removed')
            .map((c) => clusterGlyph(c, 'removed', emphasis(c.id)))}

          {/* Edges */}
          {next.edges.map((e) => {
            const a = nextPos.get(e.from);
            const b = nextPos.get(e.to);
            if (!a || !b) return null;
            const kind = cls.edges.get(e.id) ?? 'unchanged';
            const eff = semanticOnly && kind === 'moved' ? 'unchanged' : kind;
            const s = CLASS_STYLE[eff];
            const A = centerNode(a);
            const B = centerNode(b);
            return (
              <line
                key={e.id}
                x1={A.x}
                y1={A.y}
                x2={B.x}
                y2={B.y}
                stroke={s.stroke}
                strokeWidth={eff === 'unchanged' ? 2 : 3}
                strokeDasharray={s.dash}
                style={emphasis(e.id)}
              />
            );
          })}
          {base.edges
            .filter((e) => cls.edges.get(e.id) === 'removed')
            .map((e) => {
              const a = basePos.get(e.from);
              const b = basePos.get(e.to);
              if (!a || !b) return null;
              const A = centerNode(a);
              const B = centerNode(b);
              return (
                <line
                  key={`rm-${e.id}`}
                  x1={A.x}
                  y1={A.y}
                  x2={B.x}
                  y2={B.y}
                  stroke={CLASS_STYLE.removed.stroke}
                  strokeWidth={3}
                  strokeDasharray={CLASS_STYLE.removed.dash}
                />
              );
            })}

          {/* Moved-node ghosts at their previous position, with a connector. */}
          {next.nodes.map((n) => {
            if (nodeClassOf(n.id) !== 'moved' || semanticOnly) return null;
            const before = basePos.get(n.id);
            const after = nextPos.get(n.id);
            if (!before || !after) return null;
            return (
              <g key={`ghost-${n.id}`} opacity={0.5}>
                <rect
                  x={before.x ?? 0}
                  y={before.y ?? 0}
                  width={NODE_DEFAULT_WIDTH}
                  height={NODE_DEFAULT_HEIGHT}
                  rx={10}
                  fill="none"
                  stroke={CLASS_STYLE.moved.stroke}
                  strokeWidth={1}
                  strokeDasharray="2 3"
                />
                <line
                  x1={centerNode(before).x}
                  y1={centerNode(before).y}
                  x2={centerNode(after).x}
                  y2={centerNode(after).y}
                  stroke={CLASS_STYLE.moved.stroke}
                  strokeWidth={1}
                  strokeDasharray="2 3"
                />
              </g>
            );
          })}

          {/* Nodes (present in next) */}
          {next.nodes.map((n) => {
            const p = nextPos.get(n.id) ?? n;
            const kind = nodeClassOf(n.id);
            const eff = semanticOnly && kind === 'moved' ? 'unchanged' : kind;
            return nodeGlyph(n.id, n.label, p, eff, emphasis(n.id));
          })}
          {/* Removed nodes (present only in base) as ghosts */}
          {base.nodes
            .filter((n) => nodeClassOf(n.id) === 'removed')
            .map((n) => nodeGlyph(n.id, n.label, basePos.get(n.id) ?? n, 'removed', emphasis(n.id)))}
        </svg>

        <div className="diffview__list" data-testid="diff-list">
          <ChangeSection
            title="Added"
            kind="added"
            entries={collect(diff, 'added')}
            onReveal={setHighlightId}
            highlightId={highlightId}
          />
          <ChangeSection
            title="Changed"
            kind="changed"
            entries={collect(diff, 'changed')}
            onReveal={setHighlightId}
            highlightId={highlightId}
          />
          {!semanticOnly && (
            <ChangeSection
              title="Moved"
              kind="moved"
              entries={collect(diff, 'moved')}
              onReveal={setHighlightId}
              highlightId={highlightId}
            />
          )}
          <ChangeSection
            title="Removed"
            kind="removed"
            entries={collect(diff, 'removed')}
            onReveal={setHighlightId}
            highlightId={highlightId}
          />
        </div>
      </div>
    </div>
  );

  function nodeGlyph(
    id: string,
    label: string,
    p: { x?: number; y?: number },
    kind: ChangeClass,
    extra: CSSProperties,
  ) {
    const s = CLASS_STYLE[kind];
    const b = nodeBox(p);
    return (
      <g key={`${kind}-${id}`}>
        <rect x={b.x} y={b.y} width={b.width} height={b.height} rx={10} fill={s.fill} stroke={s.stroke} strokeWidth={kind === 'unchanged' ? 1 : 2} strokeDasharray={s.dash} style={extra} />
        <text x={b.x + b.width / 2} y={b.y + b.height / 2 + 5} textAnchor="middle" fontSize={13} fontWeight={600} fill={s.label}>
          {label}
        </text>
      </g>
    );
  }

  function clusterGlyph(c: Diagram['clusters'][number], kind: ChangeClass, extra: CSSProperties) {
    const s = CLASS_STYLE[kind];
    return (
      <g key={`c-${kind}-${c.id}`}>
        <rect x={c.x} y={c.y} width={c.width} height={c.height} rx={10} fill={s.fill} stroke={s.stroke} strokeWidth={1.5} strokeDasharray={s.dash ?? '4 3'} style={extra} />
        <text x={c.x + 10} y={c.y + 17} fontSize={12} fontWeight={600} fill={s.label}>
          {c.label}
        </text>
      </g>
    );
  }

  function frameGlyph(f: NonNullable<Diagram['frames']>[number], kind: ChangeClass, extra: CSSProperties = {}) {
    const s = CLASS_STYLE[kind];
    return (
      <g key={`f-${kind}-${f.id}`}>
        <rect x={f.x} y={f.y} width={f.width} height={f.height} fill="none" stroke={s.stroke} strokeWidth={1} strokeDasharray={s.dash} style={extra} />
        <text x={f.x} y={f.y - 7} fontSize={12} fill={s.label}>
          {f.label}
        </text>
      </g>
    );
  }
}

interface ChangeEntry {
  id: string;
  kind: string; // element kind for the row label
  label: string;
}

function collect(diff: DiagramDiff, group: 'added' | 'removed' | 'changed' | 'moved'): ChangeEntry[] {
  const out: ChangeEntry[] = [];
  const push = <T extends { id: string }>(k: KindDiff<T>, kindLabel: string) => {
    if (group === 'added') k.added.forEach((e) => out.push({ id: e.id, kind: kindLabel, label: labelOf(e) }));
    else if (group === 'removed') k.removed.forEach((e) => out.push({ id: e.id, kind: kindLabel, label: labelOf(e) }));
    else
      k.changed
        .filter((c) => (group === 'moved' ? c.layoutOnly : !c.layoutOnly))
        .forEach((c) => out.push({ id: c.id, kind: kindLabel, label: `${labelOf(c.after)} · ${c.fields.join(', ')}` }));
  };
  push(diff.nodes, 'component');
  push(diff.edges, 'relationship');
  push(diff.clusters, 'group');
  push(diff.frames, 'page');
  return out;
}

function labelOf(e: unknown): string {
  const o = e as { label?: string; id: string; from?: string; to?: string };
  if (o.label) return o.label;
  if (o.from && o.to) return `${o.from} → ${o.to}`;
  return o.id;
}

function ChangeSection({
  title,
  kind,
  entries,
  onReveal,
  highlightId,
}: {
  title: string;
  kind: string;
  entries: ChangeEntry[];
  onReveal: (id: string) => void;
  highlightId: string | null;
}) {
  if (entries.length === 0) return null;
  return (
    <div className={`diff-section diff-section--${kind}`}>
      <div className="diff-section__head">
        {title} <span className="diff-section__count">{entries.length}</span>
      </div>
      {entries.map((e) => (
        <button
          key={`${e.kind}-${e.id}`}
          className={`diff-row${highlightId === e.id ? ' on' : ''}`}
          data-testid="diff-row"
          onClick={() => onReveal(e.id)}
          title={`${e.kind}: ${e.label}`}
        >
          <span className="diff-row__kind">{e.kind}</span>
          <span className="diff-row__label">{e.label}</span>
        </button>
      ))}
    </div>
  );
}
