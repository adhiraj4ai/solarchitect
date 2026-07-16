/**
 * The activity-bar panel model, shared by the renderer shell. Kept
 * framework-free so the surface-contextual rules (which panels exist on which
 * document surface, and which one is active) are pure and unit-testable rather
 * than tangled into React state.
 */

/** A document surface. Mirrors the canvas interaction Mode: the Diagram surface
 *  is 'architect' (structured shapes), the Whiteboard surface is 'whiteboard'
 *  (freeform). A whiteboard has no structured shapes or instantiable diagram
 *  templates, and no YAML. */
export type Surface = 'architect' | 'whiteboard';

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

/** Panels that only make sense on the Diagram (architect) surface: dragging
 *  cloud/on-prem shapes and instantiating diagram templates have no meaning on
 *  a freeform whiteboard. */
const DIAGRAM_ONLY: ReadonlySet<PanelId> = new Set<PanelId>(['shapes', 'templates']);

export function isPanelAvailable(panel: PanelId, surface: Surface): boolean {
  if (surface === 'architect') return true;
  return !DIAGRAM_ONLY.has(panel);
}

/** The panels available on a surface, in activity-bar order. */
export function panelsForSurface(surface: Surface): PanelMeta[] {
  return PANELS.filter((p) => isPanelAvailable(p.id, surface));
}

/**
 * Decide which panel is active for the current surface. Honors the panel the
 * user preferred on that surface; if that panel is unavailable there (e.g.
 * Shapes on the Whiteboard) it falls back to the default. The preference map is
 * never mutated here — the caller keeps the remembered choice so returning to
 * the other surface restores it.
 */
export function resolveActivePanel(
  surface: Surface,
  preferredBySurface: Partial<Record<Surface, PanelId>>,
): PanelId {
  const preferred = preferredBySurface[surface] ?? DEFAULT_PANEL;
  return isPanelAvailable(preferred, surface) ? preferred : DEFAULT_PANEL;
}
