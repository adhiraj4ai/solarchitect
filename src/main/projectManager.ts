import { readFile, writeFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { serializeDiagram } from '../shared/yaml/serialize';
import { parseDiagram } from '../shared/yaml/parse';
import { emptyDiagram } from '../shared/ir/types';
import { gitShow, type GitShowResult } from './gitService';
import {
  documentTypeForFile,
  documentExtension,
  defaultBaseName,
  TEMPLATES_FILE,
  type DocumentType,
} from '../shared/project/documentType';
import { serializeWhiteboardFile, emptyWhiteboardFile } from '../shared/whiteboard/whiteboardFile';
import type { DocumentEntry } from '../shared/project/types';

export { TEMPLATES_FILE };
export type { DocumentEntry };

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

/** List every document in a project folder, tagged with its type. Only diagrams
 *  are validated, so a corrupt diagram is flagged (errored) rather than blocking
 *  the project; whiteboards and markdown are always 'ok'. */
export async function listDocuments(projectDir: string): Promise<DocumentEntry[]> {
  const names = (await readdir(projectDir)).sort();
  const entries: DocumentEntry[] = [];
  for (const fileName of names) {
    const type = documentTypeForFile(fileName);
    if (!type) continue; // templates.yaml, assets, unknown files
    if (type !== 'diagram') {
      entries.push({ fileName, type, status: 'ok' });
      continue;
    }
    try {
      const text = await readFile(path.join(projectDir, fileName), 'utf-8');
      const result = parseDiagram(text);
      entries.push(
        result.ok
          ? { fileName, type, status: 'ok' }
          : { fileName, type, status: 'error', errorMessage: result.error.message },
      );
    } catch (e) {
      entries.push({ fileName, type, status: 'error', errorMessage: (e as Error).message });
    }
  }
  return entries;
}

/** Read any document's raw text. */
export async function readDocument(projectDir: string, fileName: string): Promise<string> {
  return readFile(resolveInProject(projectDir, fileName), 'utf-8');
}

/** Read a document's content as it was at a git ref (e.g. 'HEAD'), for the
 *  diff/review view. Kept behind the same path-traversal trust boundary as every
 *  other file op; the git read itself lives in the git service. */
export async function readDocumentAtRef(
  projectDir: string,
  fileName: string,
  ref: string,
): Promise<GitShowResult> {
  resolveInProject(projectDir, fileName); // trust boundary — throws on traversal
  return gitShow(projectDir, ref, fileName);
}

/** Write any document's raw text. */
export async function writeDocument(projectDir: string, fileName: string, text: string): Promise<void> {
  await writeFile(resolveInProject(projectDir, fileName), text, 'utf-8');
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function starterContent(type: DocumentType): string {
  switch (type) {
    case 'diagram':
      return serializeDiagram(emptyDiagram());
    case 'whiteboard':
      return serializeWhiteboardFile(emptyWhiteboardFile());
    case 'markdown':
      return '# Untitled\n\n';
  }
}

/** Create a new auto-named document of the given type, disambiguating so an
 *  existing file is never overwritten. Returns the created file name. */
export async function createDocument(projectDir: string, type: DocumentType): Promise<string> {
  const base = defaultBaseName(type);
  const ext = documentExtension(type);
  let fileName = `${base}${ext}`;
  let n = 2;
  while (await fileExists(path.join(projectDir, fileName))) {
    fileName = `${base}-${n}${ext}`;
    n += 1;
  }
  await writeDocument(projectDir, fileName, starterContent(type));
  return fileName;
}

/** Read the project's shared templates file (empty document if it doesn't exist yet). */
export async function readTemplates(projectDir: string): Promise<string> {
  return readFile(path.join(projectDir, TEMPLATES_FILE), 'utf-8').catch(() => 'templates: []\n');
}

/** Write the project's shared templates file. */
export async function writeTemplates(projectDir: string, yamlText: string): Promise<void> {
  await writeFile(path.join(projectDir, TEMPLATES_FILE), yamlText, 'utf-8');
}
