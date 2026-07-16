import type { Diagram } from '../ir/types';

/**
 * Project search, computed purely. v1 searches two things: diagram file names
 * across the open project, and node/cluster labels within the currently-open
 * diagram. Results are grouped so the UI can present diagrams and in-diagram
 * elements distinctly. Cross-diagram content search is intentionally out of
 * scope here.
 */

export interface DiagramNameResult {
  kind: 'diagram';
  fileName: string;
}

export interface ElementResult {
  kind: 'element';
  elementKind: 'node' | 'cluster';
  id: string;
  label: string;
}

export interface SearchResults {
  diagrams: DiagramNameResult[];
  elements: ElementResult[];
}

export interface SearchInput {
  query: string;
  /** Diagram file names in the open project (from the project listing). */
  fileNames: string[];
  /** The currently-open diagram, or null when none is open. */
  diagram: Diagram | null;
}

export function searchProject({ query, fileNames, diagram }: SearchInput): SearchResults {
  const q = query.trim().toLowerCase();
  if (q === '') return { diagrams: [], elements: [] };

  const diagrams: DiagramNameResult[] = fileNames
    .filter((name) => name.toLowerCase().includes(q))
    .map((fileName) => ({ kind: 'diagram', fileName }));

  const elements: ElementResult[] = [];
  if (diagram) {
    for (const n of diagram.nodes) {
      if (n.label.toLowerCase().includes(q)) {
        elements.push({ kind: 'element', elementKind: 'node', id: n.id, label: n.label });
      }
    }
    for (const c of diagram.clusters) {
      if (c.label.toLowerCase().includes(q)) {
        elements.push({ kind: 'element', elementKind: 'cluster', id: c.id, label: c.label });
      }
    }
  }

  return { diagrams, elements };
}

export function hasResults(r: SearchResults): boolean {
  return r.diagrams.length > 0 || r.elements.length > 0;
}
