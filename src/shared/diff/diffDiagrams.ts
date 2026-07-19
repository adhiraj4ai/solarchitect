import type { Diagram, DiagramNode, DiagramEdge, DiagramCluster, DiagramFrame } from '../ir/types';

/** One element that exists in both versions but differs in at least one field. */
export interface ChangedElement<T> {
  id: string;
  before: T;
  after: T;
  /** The element fields that differ (never includes `id`). */
  fields: string[];
  /** True when every differing field is positional (a pure move/resize). */
  layoutOnly: boolean;
}

/** The added / removed / changed sets for one element kind. */
export interface KindDiff<T> {
  added: T[];
  removed: T[];
  changed: ChangedElement<T>[];
}

/** A structural, id-keyed diff between two versions of a Diagram. */
export interface DiagramDiff {
  nodes: KindDiff<DiagramNode>;
  edges: KindDiff<DiagramEdge>;
  clusters: KindDiff<DiagramCluster>;
  frames: KindDiff<DiagramFrame>;
  hasChanges: boolean;
}

/** The fields (sorted) that differ between two versions of one element, excluding `id`. */
function changedFields<T extends { id: string }>(before: T, after: T): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  keys.delete('id');
  const fields: string[] = [];
  for (const k of keys) {
    if ((before as Record<string, unknown>)[k] !== (after as Record<string, unknown>)[k]) fields.push(k);
  }
  return fields.sort();
}

/** Positional fields per element kind — a change confined to these is a pure move/resize. */
const LAYOUT_FIELDS = {
  node: new Set(['x', 'y']),
  edge: new Set<string>(),
  cluster: new Set(['x', 'y', 'width', 'height']),
  frame: new Set(['x', 'y', 'width', 'height']),
} as const;

function diffKind<T extends { id: string }>(base: T[], next: T[], layoutFields: ReadonlySet<string>): KindDiff<T> {
  const baseById = new Map(base.map((e) => [e.id, e]));
  const nextIds = new Set(next.map((e) => e.id));
  const added: T[] = [];
  const changed: ChangedElement<T>[] = [];
  for (const after of next) {
    const before = baseById.get(after.id);
    if (!before) {
      added.push(after);
      continue;
    }
    const fields = changedFields(before, after);
    if (fields.length > 0) {
      const layoutOnly = fields.every((f) => layoutFields.has(f));
      changed.push({ id: after.id, before, after, fields, layoutOnly });
    }
  }
  const removed = base.filter((e) => !nextIds.has(e.id));
  return { added, removed, changed };
}

function anyChanges(diff: DiagramDiff): boolean {
  return [diff.nodes, diff.edges, diff.clusters, diff.frames].some(
    (k) => k.added.length > 0 || k.removed.length > 0 || k.changed.length > 0,
  );
}

export function diffDiagrams(base: Diagram, next: Diagram): DiagramDiff {
  const diff: DiagramDiff = {
    nodes: diffKind(base.nodes, next.nodes, LAYOUT_FIELDS.node),
    edges: diffKind(base.edges, next.edges, LAYOUT_FIELDS.edge),
    clusters: diffKind(base.clusters, next.clusters, LAYOUT_FIELDS.cluster),
    frames: diffKind(base.frames ?? [], next.frames ?? [], LAYOUT_FIELDS.frame),
    hasChanges: false,
  };
  diff.hasChanges = anyChanges(diff);
  return diff;
}
