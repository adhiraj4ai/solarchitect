/**
 * The activity-bar panel model, shared by the renderer shell. Kept framework-free
 * so the rules for which panels exist on which document type, and which one is
 * active, are pure and unit-testable rather than tangled into React state.
 */

import type { DocumentType } from '../project/documentType';

export type PanelId =
  | 'project'
  | 'search'
  | 'outline'
  | 'shapes'
  | 'templates'
  | 'git'
  | 'settings'
  | 'help';

/** Which activity-bar group a panel sits in. Utility panels anchor to the bottom. */
export type PanelGroup = 'primary' | 'utility';

export interface PanelMeta {
  id: PanelId;
  /** Human label, shown as the icon's tooltip and the sidebar header. */
  label: string;
  group: PanelGroup;
}

/** Every panel, in activity-bar order (primary group first, then utility). */
export const PANELS: PanelMeta[] = [
  { id: 'project', label: 'Project', group: 'primary' },
  { id: 'search', label: 'Search', group: 'primary' },
  { id: 'outline', label: 'Outline', group: 'primary' },
  { id: 'shapes', label: 'Shapes', group: 'primary' },
  { id: 'templates', label: 'Templates', group: 'primary' },
  { id: 'git', label: 'Version control', group: 'primary' },
  { id: 'settings', label: 'Settings', group: 'utility' },
  { id: 'help', label: 'Help', group: 'utility' },
];

/** The panel the sidebar falls back to when a preferred panel is unavailable. */
export const DEFAULT_PANEL: PanelId = 'project';

/** Panels that only make sense on the structured Diagram document: dragging
 *  cloud/on-prem shapes and instantiating diagram templates have no meaning on a
 *  freeform whiteboard or a markdown document. */
const DIAGRAM_ONLY: ReadonlySet<PanelId> = new Set<PanelId>(['shapes', 'templates']);
/** Panels tied to document structure — diagram nodes or markdown headings. */
const STRUCTURE_PANELS: ReadonlySet<PanelId> = new Set<PanelId>(['outline', 'search']);

export function isPanelAvailableForType(panel: PanelId, type: DocumentType): boolean {
  if (DIAGRAM_ONLY.has(panel)) return type === 'diagram';
  if (STRUCTURE_PANELS.has(panel)) return type === 'diagram' || type === 'markdown';
  return true; // project, git, settings, help — universal
}

/** The panels available on a document type, in activity-bar order. */
export function panelsForType(type: DocumentType): PanelMeta[] {
  return PANELS.filter((p) => isPanelAvailableForType(p.id, type));
}

/**
 * Decide which panel is active for the current document type. Honors the panel
 * the user preferred on that type; if it is unavailable there (e.g. Shapes on a
 * Whiteboard) it falls back to the default. The preference map is never mutated
 * here — the caller keeps the remembered choice so returning to a type restores it.
 */
export function resolveActivePanelForType(
  type: DocumentType,
  preferredByType: Partial<Record<DocumentType, PanelId>>,
): PanelId {
  const preferred = preferredByType[type] ?? DEFAULT_PANEL;
  return isPanelAvailableForType(preferred, type) ? preferred : DEFAULT_PANEL;
}
