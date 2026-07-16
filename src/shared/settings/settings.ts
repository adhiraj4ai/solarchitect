/**
 * App-level settings, defined as a pure schema with defaults and a tolerant
 * merge. The merge is the single place that decides how partial, unknown, or
 * corrupt input resolves — so both the main-process store and the renderer read
 * the same rules, and a bad settings file can never crash the app.
 */

export interface AppSettings {
  /** Show the canvas grid background. */
  grid: boolean;
  /** Autosave the current diagram after edits. */
  autosave: boolean;
  /** Provider to filter the shape library to by default, or null for all. */
  defaultProvider: string | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  grid: true,
  autosave: false,
  defaultProvider: null,
};

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
    autosave: bool(src.autosave, DEFAULT_SETTINGS.autosave),
    defaultProvider,
  };
}
