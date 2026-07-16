import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/settings/settings';

/**
 * Loads app settings from the main process on mount and persists changes back.
 * Updates are optimistic (state changes immediately) and then reconciled with
 * the normalized settings the main process actually wrote. A read/write failure
 * surfaces via onError but never blocks the app — settings fall back to defaults.
 */
export function useSettings(onError: (msg: string) => void) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    window.solarchitect
      .readSettings()
      .then(({ settings, corrupt }) => {
        setSettings(settings);
        if (corrupt) onErrorRef.current('Settings file was unreadable — reverted to defaults.');
      })
      .catch((e) => onErrorRef.current(`Could not load settings: ${(e as Error).message}`));
  }, []);

  const update = useCallback(async (patch: Partial<AppSettings>) => {
    // Update the ref synchronously so rapid successive updates compose off the
    // latest value rather than a render-lagged one.
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next); // optimistic
    try {
      await window.solarchitect.writeSettings(next);
    } catch (e) {
      onErrorRef.current(`Could not save settings: ${(e as Error).message}`);
    }
  }, []);

  return { settings, update };
}
