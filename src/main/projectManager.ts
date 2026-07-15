import { readFile, writeFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { serializeDiagram } from '../shared/yaml/serialize';
import { parseDiagram } from '../shared/yaml/parse';
import { emptyDiagram } from '../shared/ir/types';
import type { DiagramFileEntry } from '../shared/project/types';

export const TEMPLATES_FILE = 'templates.yaml';
export type { DiagramFileEntry };

/** List diagram files in a project folder, validating each so a corrupt file is
 *  flagged (errored) rather than blocking the whole project from opening. */
export async function listDiagrams(projectDir: string): Promise<DiagramFileEntry[]> {
  const names = (await readdir(projectDir))
    .filter((f) => f.endsWith('.yaml') && f !== TEMPLATES_FILE)
    .sort();

  const entries: DiagramFileEntry[] = [];
  for (const fileName of names) {
    try {
      const text = await readFile(path.join(projectDir, fileName), 'utf-8');
      const result = parseDiagram(text);
      entries.push(
        result.ok ? { fileName, status: 'ok' } : { fileName, status: 'error', errorMessage: result.error.message },
      );
    } catch (e) {
      entries.push({ fileName, status: 'error', errorMessage: (e as Error).message });
    }
  }
  return entries;
}

/**
 * Resolve fileName inside projectDir, refusing any path that escapes it. The
 * fileName arrives over IPC from the renderer, so this is the trust boundary —
 * a crafted "../../etc/passwd" must never read or overwrite outside the project.
 */
function resolveInProject(projectDir: string, fileName: string): string {
  const root = path.resolve(projectDir);
  const resolved = path.resolve(root, fileName);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Refusing to access a path outside the project: ${fileName}`);
  }
  return resolved;
}

export async function readDiagram(projectDir: string, fileName: string): Promise<string> {
  return readFile(resolveInProject(projectDir, fileName), 'utf-8');
}

export async function writeDiagram(projectDir: string, fileName: string, yamlText: string): Promise<void> {
  await writeFile(resolveInProject(projectDir, fileName), yamlText, 'utf-8');
}

function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'diagram';
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Read the project's shared templates file (empty document if it doesn't exist yet). */
export async function readTemplates(projectDir: string): Promise<string> {
  return readFile(path.join(projectDir, TEMPLATES_FILE), 'utf-8').catch(() => 'templates: []\n');
}

/** Write the project's shared templates file. */
export async function writeTemplates(projectDir: string, yamlText: string): Promise<void> {
  await writeFile(path.join(projectDir, TEMPLATES_FILE), yamlText, 'utf-8');
}

/** Create a new empty diagram file, disambiguating the name so an existing file
 *  is never overwritten. Returns the created file name. */
export async function createDiagram(projectDir: string, displayName: string): Promise<string> {
  const slug = slugify(displayName);
  let fileName = `${slug}.yaml`;
  let n = 2;
  while (await fileExists(path.join(projectDir, fileName))) {
    fileName = `${slug}-${n}.yaml`;
    n += 1;
  }
  await writeDiagram(projectDir, fileName, serializeDiagram(emptyDiagram()));
  return fileName;
}
