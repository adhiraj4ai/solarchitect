import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeExportedImage } from './exportService';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'solarchitect-export-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('writeExportedImage', () => {
  it('writes the given bytes to the given path', async () => {
    const filePath = path.join(dir, 'diagram.png');
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    await writeExportedImage(filePath, bytes);
    expect(await readFile(filePath)).toEqual(bytes);
  });

  it('writes utf-8 SVG text bytes intact', async () => {
    const filePath = path.join(dir, 'diagram.svg');
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>', 'utf-8');
    await writeExportedImage(filePath, svg);
    expect((await readFile(filePath)).toString('utf-8')).toContain('<svg');
  });
});
