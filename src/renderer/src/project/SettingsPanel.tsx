import { NODE_TAXONOMY, type Provider } from '@shared/ir/taxonomy';
import type { AppSettings } from '@shared/settings/settings';

/** Providers that actually have shapes, for the default-provider filter. */
const PROVIDERS: Provider[] = [...new Set(NODE_TAXONOMY.map((n) => n.provider))];

/**
 * App preferences (v1): canvas grid, autosave, and the default provider filter
 * for the shape library. Changes are pushed up immediately (optimistic + saved
 * via the main process by useSettings).
 */
export function SettingsPanel({
  settings,
  onUpdate,
}: {
  settings: AppSettings;
  onUpdate: (patch: Partial<AppSettings>) => void;
}) {
  return (
    <div className="panel">
      <div className="panel__head">
        <span className="eyebrow">Settings</span>
      </div>
      <div className="panel__body settings">
        <label className="settings__row">
          <input
            type="checkbox"
            data-testid="setting-grid"
            checked={settings.grid}
            onChange={(e) => onUpdate({ grid: e.target.checked })}
          />
          <span>
            <span className="settings__label">Canvas grid</span>
            <span className="settings__hint">Show the blueprint grid behind the canvas.</span>
          </span>
        </label>

        <label className="settings__row">
          <input
            type="checkbox"
            data-testid="setting-autosave"
            checked={settings.autosave}
            onChange={(e) => onUpdate({ autosave: e.target.checked })}
          />
          <span>
            <span className="settings__label">Autosave</span>
            <span className="settings__hint">Save the open diagram automatically after edits.</span>
          </span>
        </label>

        <div className="settings__row settings__row--col">
          <span className="settings__label">Default shape provider</span>
          <select
            className="props-input"
            data-testid="setting-provider"
            value={settings.defaultProvider ?? ''}
            onChange={(e) => onUpdate({ defaultProvider: e.target.value || null })}
          >
            <option value="">All providers</option>
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <span className="settings__hint">Filters the Shapes panel to one provider by default.</span>
        </div>
      </div>
    </div>
  );
}
