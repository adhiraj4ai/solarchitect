/**
 * Animation presets: named bundles of a style plus motion timing. Four
 * read-only built-ins ship in code; users create custom presets on top. The
 * library shown to the user is built-ins ++ custom. Only custom presets and the
 * active id are persisted (in app settings) — see settings.ts.
 */

/** The four animation styles, each a parameterization of the one engine. */
export type AnimationStyle = 'all-edges' | 'dataflow' | 'control-flow' | 'end-to-end';

export const ANIMATION_STYLES: AnimationStyle[] = ['all-edges', 'dataflow', 'control-flow', 'end-to-end'];

/** How the flow token accelerates as it crosses an edge. */
export type TravelEasing = 'linear' | 'ease-in-out';

export const TRAVEL_EASINGS: TravelEasing[] = ['linear', 'ease-in-out'];

export interface AnimationPreset {
  id: string;
  name: string;
  style: AnimationStyle;
  /** Seconds each beat holds before the next. */
  secondsPerStep: number;
  /** Seconds a token takes to cross an edge. */
  dotTravelSeconds: number;
  /** Dim→lit fade seconds (build-up styles). */
  fadeSeconds: number;
  /** Opacity of not-yet-reached elements (build-up styles). */
  dimOpacity: number;
  loop: 'once' | 'forever';
  /** How the flow token accelerates across an edge; absent = linear. */
  travelEasing?: TravelEasing;
  /** Optional token color; absent uses the sync accent. */
  tokenColor?: string;
  /** Flow-token radius in px; absent = default. */
  tokenSize?: number;
}

/** Default flow-token radius (px) when a preset does not set one. */
export const DEFAULT_TOKEN_SIZE = 5;

export const BUILTIN_PRESETS: AnimationPreset[] = [
  { id: 'builtin-all-edges', name: 'All edges', style: 'all-edges', secondsPerStep: 1, dotTravelSeconds: 1.2, fadeSeconds: 0.35, dimOpacity: 0.15, loop: 'forever' },
  { id: 'builtin-dataflow', name: 'Dataflow', style: 'dataflow', secondsPerStep: 0.8, dotTravelSeconds: 0.7, fadeSeconds: 0.3, dimOpacity: 0.15, loop: 'forever' },
  { id: 'builtin-control-flow', name: 'Control flow', style: 'control-flow', secondsPerStep: 1, dotTravelSeconds: 0.9, fadeSeconds: 0.35, dimOpacity: 0.15, loop: 'once' },
  { id: 'builtin-end-to-end', name: 'End-to-end', style: 'end-to-end', secondsPerStep: 1, dotTravelSeconds: 0.9, fadeSeconds: 0.35, dimOpacity: 0.15, loop: 'forever' },
];

export const DEFAULT_ACTIVE_PRESET_ID = 'builtin-control-flow';

const BUILTIN_IDS = new Set(BUILTIN_PRESETS.map((p) => p.id));

export function isBuiltinPreset(id: string): boolean {
  return BUILTIN_IDS.has(id);
}

/** Tolerantly coerce one unknown value into a preset, or null if unusable. */
export function coercePreset(input: unknown): AnimationPreset | null {
  if (typeof input !== 'object' || input === null) return null;
  const o = input as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.name !== 'string') return null;
  if (typeof o.style !== 'string' || !ANIMATION_STYLES.includes(o.style as AnimationStyle)) return null;
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  return {
    id: o.id,
    name: o.name,
    style: o.style as AnimationStyle,
    secondsPerStep: num(o.secondsPerStep, 1),
    dotTravelSeconds: num(o.dotTravelSeconds, 0.9),
    fadeSeconds: num(o.fadeSeconds, 0.35),
    dimOpacity: num(o.dimOpacity, 0.15),
    travelEasing: o.travelEasing === 'ease-in-out' ? 'ease-in-out' : 'linear',
    loop: o.loop === 'once' || o.loop === 'forever' ? o.loop : 'forever',
    tokenSize: num(o.tokenSize, DEFAULT_TOKEN_SIZE),
    ...(typeof o.tokenColor === 'string' ? { tokenColor: o.tokenColor } : {}),
  };
}

/** Coerce a stored list of custom presets: drop invalid entries and any that
 *  collide with a built-in id (built-ins are authoritative). */
export function coercePresets(input: unknown): AnimationPreset[] {
  if (!Array.isArray(input)) return [];
  return input
    .map(coercePreset)
    .filter((p): p is AnimationPreset => p !== null && !isBuiltinPreset(p.id));
}

/** The full library: read-only built-ins followed by the user's custom presets. */
export function allPresets(customPresets: AnimationPreset[]): AnimationPreset[] {
  return [...BUILTIN_PRESETS, ...customPresets];
}

/** Resolve the active preset by id, falling back to the default built-in. */
export function resolvePreset(customPresets: AnimationPreset[], activeId: string): AnimationPreset {
  return (
    allPresets(customPresets).find((p) => p.id === activeId) ??
    BUILTIN_PRESETS.find((p) => p.id === DEFAULT_ACTIVE_PRESET_ID)!
  );
}
