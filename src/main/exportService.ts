import { writeFile } from 'node:fs/promises';

/** Write exported image bytes (PNG or SVG) to an absolute path chosen by the user. */
export async function writeExportedImage(filePath: string, data: Uint8Array): Promise<void> {
  await writeFile(filePath, data);
}
