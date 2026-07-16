import { readFile, writeFile } from 'node:fs/promises';
import { mergeSettings, type AppSettings, type SettingsReadResult } from '../shared/settings/settings';

export type { AppSettings };

/**
 * Persist app settings as a JSON file. Kept electron-free (the file path is
 * passed in, resolved by the caller from the user-data dir) so it unit-tests
 * like projectManager. A missing or corrupt file resolves to defaults rather
 * than throwing — settings must never block the app from starting. A present-
 * but-unreadable file is reported as `corrupt` so the renderer can warn.
 */
export async function readSettings(filePath: string): Promise<SettingsReadResult> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch {
    return { settings: mergeSettings(undefined), corrupt: false }; // missing → defaults, not corrupt
  }
  try {
    return { settings: mergeSettings(JSON.parse(raw)), corrupt: false };
  } catch {
    return { settings: mergeSettings(undefined), corrupt: true }; // present but unparseable
  }
}

export async function writeSettings(filePath: string, settings: AppSettings): Promise<AppSettings> {
  const merged = mergeSettings(settings);
  await writeFile(filePath, JSON.stringify(merged, null, 2), 'utf-8');
  return merged;
}
