/**
 * App-level settings, defined as a pure schema with defaults and a tolerant
 * merge. The merge is the single place that decides how partial, unknown, or
 * corrupt input resolves — so both the main-process store and the renderer read
 * the same rules, and a bad settings file can never crash the app.
 */

import {
  type AnimationPreset,
  DEFAULT_ACTIVE_PRESET_ID,
  coercePresets,
} from '../animation/presets';

export interface AppSettings {
  /** Show the canvas grid background. */
  grid: boolean;
  /** Draw an outline (border + shadow) on node cards. */
  nodeBorders: boolean;
  /** Fill node cards (card background + the icon tint square). */
  nodeFill: boolean;
  /** Autosave the current diagram after edits. */
  autosave: boolean;
  /** Provider to filter the shape library to by default, or null for all. */
  defaultProvider: string | null;
  /** User-created animation presets (built-ins live in code, not here). */
  customPresets: AnimationPreset[];
  /** The active animation preset id (may name a built-in). */
  activePresetId: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  grid: true,
  nodeBorders: false,
  nodeFill: true,
  autosave: false,
  defaultProvider: null,
  customPresets: [],
  activePresetId: DEFAULT_ACTIVE_PRESET_ID,
};

/** Result of loading settings. `corrupt` is true only when a file was present
 *  but unreadable (so the renderer can warn) — a missing file is not corrupt. */
export interface SettingsReadResult {
  settings: AppSettings;
  corrupt: boolean;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Coerce arbitrary input (parsed JSON, a partial patch, undefined) into a
 * complete AppSettings, filling anything missing or wrongly-typed from defaults.
 */
export function mergeSettings(input: unknown): AppSettings {
  const src = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const defaultProvider =
    typeof src.defaultProvider === 'string'
      ? src.defaultProvider
      : src.defaultProvider === null
        ? null
        : DEFAULT_SETTINGS.defaultProvider;
  return {
    grid: bool(src.grid, DEFAULT_SETTINGS.grid),
    nodeBorders: bool(src.nodeBorders, DEFAULT_SETTINGS.nodeBorders),
    nodeFill: bool(src.nodeFill, DEFAULT_SETTINGS.nodeFill),
    autosave: bool(src.autosave, DEFAULT_SETTINGS.autosave),
    defaultProvider,
    customPresets: coercePresets(src.customPresets),
    activePresetId: typeof src.activePresetId === 'string' ? src.activePresetId : DEFAULT_ACTIVE_PRESET_ID,
  };
}
