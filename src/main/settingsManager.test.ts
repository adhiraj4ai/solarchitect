import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readSettings, writeSettings } from './settingsManager';
import { DEFAULT_SETTINGS } from '../shared/settings/settings';

let dir: string;
const file = () => path.join(dir, 'settings.json');

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'solarchitect-settings-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('settingsManager', () => {
  it('round-trips settings through write then read', async () => {
    const written = await writeSettings(file(), { grid: false, autosave: true, defaultProvider: 'aws' });
    expect(written).toEqual({ grid: false, autosave: true, defaultProvider: 'aws' });
    expect(await readSettings(file())).toEqual({ grid: false, autosave: true, defaultProvider: 'aws' });
  });

  it('returns defaults when the settings file is missing', async () => {
    expect(await readSettings(file())).toEqual(DEFAULT_SETTINGS);
  });

  it('returns defaults when the settings file is corrupt', async () => {
    await writeFile(file(), '{ not valid json', 'utf-8');
    expect(await readSettings(file())).toEqual(DEFAULT_SETTINGS);
  });

  it('normalizes partial/garbage content on write', async () => {
    // @ts-expect-error deliberately partial to prove the merge fills defaults
    const written = await writeSettings(file(), { grid: false });
    expect(written).toEqual({ ...DEFAULT_SETTINGS, grid: false });
  });
});
