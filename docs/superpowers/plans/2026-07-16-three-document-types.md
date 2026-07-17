# Three Document Types (Diagram / Whiteboard / Markdown) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a project a folder of typed documents — Diagram (`.yaml`), Whiteboard (`.whiteboard.json`), Markdown (`.md`) — where the file's type (detected by extension) fixes which editor opens, chosen at creation from a "New" menu.

**Architecture:** A pure `documentType` module in `src/shared` classifies files by extension and is the single source of truth for typing. The main process gains generic `readDocument`/`writeDocument`/`createDocument`/`listDocuments` (replacing the diagram/whiteboard-specific calls). The renderer tracks the open document's type and renders exactly one of three editors; the old Diagram|Whiteboard surface toggle is removed. Whiteboard becomes a standalone document whose file wraps the tldraw snapshot plus an optional `backdropDiagram` reference; the backdrop is rendered from that referenced diagram file, read at open. Markdown is a new Preview/Split/Source editor.

**Tech Stack:** Electron + electron-vite, React 18, tldraw 3, `yaml`, `marked` (new — markdown → HTML). Vitest (pure unit tests in `src/shared` + `src/main`), Playwright-for-Electron (E2E for the renderer).

## Global Constraints

- **TypeScript is two projects.** `npm run typecheck` runs both `tsconfig.node.json` (main/preload/shared) and `tsconfig.web.json` (renderer/shared). Any `src/shared` change must typecheck under both. Run `npm run typecheck` — `tsc` alone is not enough.
- **Unit tests stay pure.** Vitest includes only `src/shared` and `src/main`, `node` environment. `src/main` code must not import `electron`. The renderer/canvas is covered by E2E, never unit tests.
- **E2E requires a build.** `npm run test:e2e` builds into `out/` first; running a spec directly requires `npm run build` first.
- **The IPC contract is single-sourced.** `SolarchitectApi` in `src/shared/project/types.ts` is the one definition; preload (`src/preload/index.ts`) and the renderer `window.solarchitect` augmentation both reference it. Add/rename a bridge method there first, then implement in preload + `ipcHandlers.ts` + `projectManager.ts`.
- **The renderer never touches disk.** All filesystem access goes through the preload bridge to the main process. Every fileName arriving over IPC passes `resolveInProject()` (path-traversal trust boundary).
- **Renderer alias:** `@shared` → `src/shared`. Main imports shared by relative path.
- **Commit after every task** (each task ends green: `npm test` + `npm run typecheck` pass).
- **Strict CSP in prod** — no CDN/network; `marked` is bundled by Vite, so it is fine. Markdown renders the user's own local files.

---

## File Structure

**New files**
- `src/shared/project/documentType.ts` — `DocumentType`, extension constants, `documentTypeForFile`, `isDocumentFile`, `documentExtension`, `defaultDocumentContent`.
- `src/shared/project/documentType.test.ts`
- `src/shared/whiteboard/whiteboardFile.ts` — the wrapped whiteboard file format + `parseWhiteboardFile` (handles legacy bare snapshot & `pendingAnnotations`) + `serializeWhiteboardFile`.
- `src/shared/whiteboard/whiteboardFile.test.ts`
- `src/shared/markdown/markdownOutline.ts` — pure heading extraction for Outline + Search.
- `src/shared/markdown/markdownOutline.test.ts`
- `src/renderer/src/editor/MarkdownView.tsx` — the Markdown editor (Preview/Split/Source).
- `src/renderer/src/project/NewDocumentMenu.tsx` — the "New" button + type menu.
- `tests/e2e/document-types.spec.ts`, `tests/e2e/markdown.spec.ts`, `tests/e2e/whiteboard-standalone.spec.ts`

**Modified files**
- `src/shared/project/types.ts` — `DocumentEntry` (replaces `DiagramFileEntry`); `SolarchitectApi` method renames/additions.
- `src/shared/shell/panels.ts` — `Surface` → `DocumentType`; per-type panel availability.
- `src/main/projectManager.ts` — `listDocuments`, `readDocument`, `writeDocument`, `createDocument`; drop sidecar-specific whiteboard fns.
- `src/main/projectManager.test.ts` — updated.
- `src/main/ipcHandlers.ts` — channel renames; `newProject` seeds nothing.
- `src/preload/index.ts` — bridge method renames.
- `src/renderer/src/hooks/useProject.ts` — track `currentType`; `openDocument`/`newDocument(type)`; reset sync engine on non-diagram open.
- `src/renderer/src/hooks/useWorkspaceLayout.ts` — keyed by `DocumentType`.
- `src/renderer/src/App.tsx` — remove surface toggle; render by type; gate diagram-only chrome; wire New menu, backdrop.
- `src/renderer/src/ui/ActivityBar.tsx` — remove surface selector; take `documentType` for panels; show a type indicator.
- `src/renderer/src/project/ProjectSidebar.tsx` — grouped typed list + icons + empty state + New menu.
- `src/renderer/src/canvas/WhiteboardView.tsx` — standalone file format, backdrop from referenced diagram + picker.
- `src/renderer/src/project/OutlinePanel.tsx`, `SearchPanel.tsx` — markdown-aware.
- `package.json` — add `marked`.

---

## Task 1: Document type module (pure)

**Files:**
- Create: `src/shared/project/documentType.ts`
- Test: `src/shared/project/documentType.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type DocumentType = 'diagram' | 'whiteboard' | 'markdown'`
  - `documentTypeForFile(fileName: string): DocumentType | null` — null for non-documents (e.g. `templates.yaml`, unknown extensions).
  - `isDocumentFile(fileName: string): boolean`
  - `documentExtension(type: DocumentType): string` — `'.yaml' | '.whiteboard.json' | '.md'`
  - `defaultBaseName(type: DocumentType): string` — always `'untitled'`
  - `DOCUMENT_TYPES: DocumentType[]`

- [ ] **Step 1: Write the failing test**

```ts
// src/shared/project/documentType.test.ts
import { describe, it, expect } from 'vitest';
import {
  documentTypeForFile,
  isDocumentFile,
  documentExtension,
  DOCUMENT_TYPES,
} from './documentType';

describe('documentType', () => {
  it('classifies by extension, longest-match first', () => {
    expect(documentTypeForFile('payments.yaml')).toBe('diagram');
    expect(documentTypeForFile('sketch.whiteboard.json')).toBe('whiteboard');
    expect(documentTypeForFile('notes.md')).toBe('markdown');
  });

  it('does not classify the templates file or unknown/plain files', () => {
    expect(documentTypeForFile('templates.yaml')).toBeNull();
    expect(documentTypeForFile('data.json')).toBeNull(); // plain .json is not a whiteboard
    expect(documentTypeForFile('image.png')).toBeNull();
    expect(documentTypeForFile('README')).toBeNull();
  });

  it('treats .whiteboard.json as whiteboard, never as a diagram or plain json', () => {
    expect(documentTypeForFile('a.whiteboard.json')).toBe('whiteboard');
    expect(isDocumentFile('a.whiteboard.json')).toBe(true);
  });

  it('is case-insensitive on the extension', () => {
    expect(documentTypeForFile('X.YAML')).toBe('diagram');
    expect(documentTypeForFile('X.MD')).toBe('markdown');
  });

  it('maps each type to its canonical extension', () => {
    expect(documentExtension('diagram')).toBe('.yaml');
    expect(documentExtension('whiteboard')).toBe('.whiteboard.json');
    expect(documentExtension('markdown')).toBe('.md');
    expect(DOCUMENT_TYPES).toEqual(['diagram', 'whiteboard', 'markdown']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/project/documentType.test.ts`
Expected: FAIL — cannot find module `./documentType`.

- [ ] **Step 3: Write the implementation**

```ts
// src/shared/project/documentType.ts
/**
 * The document-type vocabulary and the extension-based classifier that is the
 * single source of truth for a file's type. Pure and framework-free so both the
 * main process (listing) and the renderer (which editor to open) share it.
 *
 * A document's type is decided ENTIRELY by its file name. `templates.yaml` is a
 * project resource, not a document, so it classifies as null.
 */

export type DocumentType = 'diagram' | 'whiteboard' | 'markdown';

export const DOCUMENT_TYPES: DocumentType[] = ['diagram', 'whiteboard', 'markdown'];

export const TEMPLATES_FILE = 'templates.yaml';

/** Longest suffix first so `.whiteboard.json` wins over a hypothetical `.json`. */
const EXTENSION_BY_TYPE: Record<DocumentType, string> = {
  whiteboard: '.whiteboard.json',
  markdown: '.md',
  diagram: '.yaml',
};

/** Order matters: check the most specific (longest) extension first. */
const MATCH_ORDER: DocumentType[] = ['whiteboard', 'markdown', 'diagram'];

export function documentExtension(type: DocumentType): string {
  return EXTENSION_BY_TYPE[type];
}

export function defaultBaseName(_type: DocumentType): string {
  return 'untitled';
}

export function documentTypeForFile(fileName: string): DocumentType | null {
  const lower = fileName.toLowerCase();
  if (lower === TEMPLATES_FILE) return null;
  // A diagram is any `.yaml` that is not the templates file; also accept `.yml`.
  for (const type of MATCH_ORDER) {
    if (type === 'diagram') {
      if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'diagram';
    } else if (lower.endsWith(EXTENSION_BY_TYPE[type])) {
      return type;
    }
  }
  return null;
}

export function isDocumentFile(fileName: string): boolean {
  return documentTypeForFile(fileName) !== null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/project/documentType.test.ts` → PASS.
Run: `npm run typecheck` → passes both projects.

- [ ] **Step 5: Commit**

```bash
git add src/shared/project/documentType.ts src/shared/project/documentType.test.ts
git commit -m "feat(shared): extension-based document-type classifier"
```

---

## Task 2: Whiteboard file format (pure)

The whiteboard file becomes a wrapper carrying the tldraw snapshot plus an optional backdrop reference. This module is the single reader/writer of that format and absorbs the two legacy shapes (bare snapshot, `pendingAnnotations`) so the renderer never branches on them.

**Files:**
- Create: `src/shared/whiteboard/whiteboardFile.ts`
- Test: `src/shared/whiteboard/whiteboardFile.test.ts`

**Interfaces:**
- Consumes: `DiagramAnnotation` from `../ir/types`.
- Produces:
  - `interface WhiteboardFile { version: 1; snapshot: unknown | null; backdropDiagram: string | null; pendingAnnotations?: DiagramAnnotation[] }`
  - `parseWhiteboardFile(text: string | null): WhiteboardFile` — never throws; corrupt/absent → empty file.
  - `serializeWhiteboardFile(file: WhiteboardFile): string`
  - `emptyWhiteboardFile(): WhiteboardFile`
  - `isWhiteboardEmpty(file: WhiteboardFile): boolean` — true when no snapshot content and no backdrop and no pending annotations.

- [ ] **Step 1: Write the failing test**

```ts
// src/shared/whiteboard/whiteboardFile.test.ts
import { describe, it, expect } from 'vitest';
import {
  parseWhiteboardFile,
  serializeWhiteboardFile,
  emptyWhiteboardFile,
} from './whiteboardFile';

describe('whiteboardFile', () => {
  it('round-trips the wrapped format', () => {
    const file = { version: 1 as const, snapshot: { store: { a: 1 } }, backdropDiagram: 'payments.yaml' };
    const text = serializeWhiteboardFile(file);
    expect(parseWhiteboardFile(text)).toEqual(file);
  });

  it('treats a missing file as empty', () => {
    expect(parseWhiteboardFile(null)).toEqual(emptyWhiteboardFile());
    expect(parseWhiteboardFile('')).toEqual(emptyWhiteboardFile());
  });

  it('migrates a legacy bare snapshot to the wrapped format with no backdrop', () => {
    const bare = JSON.stringify({ store: { 'shape:1': { typeName: 'shape' } }, schema: {} });
    const parsed = parseWhiteboardFile(bare);
    expect(parsed.version).toBe(1);
    expect(parsed.backdropDiagram).toBeNull();
    expect(parsed.snapshot).toEqual({ store: { 'shape:1': { typeName: 'shape' } }, schema: {} });
  });

  it('preserves legacy pendingAnnotations so the renderer can materialize them', () => {
    const legacy = JSON.stringify({ pendingAnnotations: [{ id: 'a1', kind: 'sticky', x: 0, y: 0, width: 10, height: 10, content: 'hi' }] });
    const parsed = parseWhiteboardFile(legacy);
    expect(parsed.snapshot).toBeNull();
    expect(parsed.pendingAnnotations).toHaveLength(1);
    expect(parsed.backdropDiagram).toBeNull();
  });

  it('falls back to empty on corrupt JSON (never throws)', () => {
    expect(parseWhiteboardFile('{not json')).toEqual(emptyWhiteboardFile());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/whiteboard/whiteboardFile.test.ts` → FAIL (module missing).

- [ ] **Step 3: Write the implementation**

```ts
// src/shared/whiteboard/whiteboardFile.ts
import type { DiagramAnnotation } from '../ir/types';

/**
 * On-disk format for a standalone whiteboard document (`name.whiteboard.json`).
 * Wraps the tldraw snapshot and an optional reference to a diagram in the same
 * project to render beneath the sketch as a backdrop. The reference is stored;
 * the rendered backdrop is derived and never stored.
 *
 * This module also absorbs the two legacy shapes the app wrote before whiteboards
 * were standalone: a bare tldraw snapshot object, and a `{ pendingAnnotations }`
 * seed from the old annotation migration. Both are read into the wrapped shape so
 * no other code branches on them.
 */
export interface WhiteboardFile {
  version: 1;
  /** tldraw snapshot object, or null when the sketch is blank. */
  snapshot: unknown | null;
  /** File name of a diagram in the same project to show as backdrop, or null. */
  backdropDiagram: string | null;
  /** Legacy annotation seed; present only until the renderer materializes it. */
  pendingAnnotations?: DiagramAnnotation[];
}

export function emptyWhiteboardFile(): WhiteboardFile {
  return { version: 1, snapshot: null, backdropDiagram: null };
}

export function serializeWhiteboardFile(file: WhiteboardFile): string {
  return JSON.stringify(file);
}

export function isWhiteboardEmpty(file: WhiteboardFile): boolean {
  return file.snapshot == null && !file.backdropDiagram && !file.pendingAnnotations?.length;
}

export function parseWhiteboardFile(text: string | null): WhiteboardFile {
  if (text == null || text.trim() === '') return emptyWhiteboardFile();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return emptyWhiteboardFile();
  }
  if (typeof raw !== 'object' || raw === null) return emptyWhiteboardFile();
  const obj = raw as Record<string, unknown>;

  // Already the wrapped format.
  if (obj.version === 1) {
    return {
      version: 1,
      snapshot: 'snapshot' in obj ? (obj.snapshot ?? null) : null,
      backdropDiagram: typeof obj.backdropDiagram === 'string' ? obj.backdropDiagram : null,
      ...(Array.isArray(obj.pendingAnnotations)
        ? { pendingAnnotations: obj.pendingAnnotations as DiagramAnnotation[] }
        : {}),
    };
  }

  // Legacy annotation seed.
  if (Array.isArray(obj.pendingAnnotations)) {
    return {
      version: 1,
      snapshot: null,
      backdropDiagram: null,
      pendingAnnotations: obj.pendingAnnotations as DiagramAnnotation[],
    };
  }

  // Legacy bare tldraw snapshot (has a `store`): migrate to wrapped, no backdrop.
  return { version: 1, snapshot: obj, backdropDiagram: null };
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run src/shared/whiteboard/whiteboardFile.test.ts` → PASS.
Run: `npm run typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/whiteboard/whiteboardFile.ts src/shared/whiteboard/whiteboardFile.test.ts
git commit -m "feat(shared): wrapped whiteboard file format with legacy migration"
```

---

## Task 3: Generalize the project store to documents (main)

Replace diagram/whiteboard-specific file access with generic, type-agnostic document access, and make listing type-aware. `readDocument`/`writeDocument` are plain UTF-8 text I/O behind `resolveInProject` (today's `readDiagram`/`writeDiagram` already are exactly this — rename them). Type-specific parsing lives in `src/shared`, not here.

**Files:**
- Modify: `src/shared/project/types.ts` (add `DocumentEntry`, keep the file's other types)
- Modify: `src/main/projectManager.ts:11-31` (list), `:47-86` (I/O), `:118-128` (create)
- Modify: `src/main/projectManager.test.ts`

**Interfaces:**
- Consumes: `documentTypeForFile`, `documentExtension`, `defaultBaseName`, `DocumentType` from `../shared/project/documentType`; `parseDiagram` (validation); `serializeDiagram`, `emptyDiagram`; `serializeWhiteboardFile`, `emptyWhiteboardFile`.
- Produces:
  - `interface DocumentEntry { fileName: string; type: DocumentType; status: 'ok' | 'error'; errorMessage?: string }`
  - `listDocuments(projectDir: string): Promise<DocumentEntry[]>`
  - `readDocument(projectDir, fileName): Promise<string>`
  - `writeDocument(projectDir, fileName, text): Promise<void>`
  - `createDocument(projectDir, type: DocumentType): Promise<string>` — returns the created file name.

- [ ] **Step 1: Add `DocumentEntry` to shared types**

In `src/shared/project/types.ts`, add near the top (after the imports):

```ts
import type { DocumentType } from './documentType';

/** A document discovered in a project folder, with its type and validation status.
 *  Only diagrams are validated; whiteboards and markdown are always 'ok'. */
export interface DocumentEntry {
  fileName: string;
  type: DocumentType;
  status: 'ok' | 'error';
  errorMessage?: string;
}
```

Leave `DiagramFileEntry` in place for now (removed in Task 5 once no one references it).

- [ ] **Step 2: Update the projectManager test to the new API (failing)**

Replace the body of `src/main/projectManager.test.ts` with:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  listDocuments,
  readDocument,
  writeDocument,
  createDocument,
} from './projectManager';

async function exists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

const EMPTY_DIAGRAM = 'nodes: []\nedges: []\nclusters: []\n';

let projectDir: string;
beforeEach(async () => { projectDir = await mkdtemp(path.join(tmpdir(), 'solarchitect-test-')); });
afterEach(async () => { await rm(projectDir, { recursive: true, force: true }); });

describe('projectManager documents', () => {
  it('writes and reads back any document verbatim', async () => {
    await writeDocument(projectDir, 'notes.md', '# Title\n');
    expect(await readDocument(projectDir, 'notes.md')).toBe('# Title\n');
  });

  it('lists documents of every type with their type, ignoring templates.yaml', async () => {
    await writeDocument(projectDir, 'a.yaml', EMPTY_DIAGRAM);
    await writeDocument(projectDir, 'b.whiteboard.json', '{"version":1,"snapshot":null,"backdropDiagram":null}');
    await writeDocument(projectDir, 'c.md', '# hi');
    await writeFile(path.join(projectDir, 'templates.yaml'), 'templates: []\n');

    const entries = await listDocuments(projectDir);
    const byName = Object.fromEntries(entries.map((e) => [e.fileName, e.type]));
    expect(byName).toEqual({ 'a.yaml': 'diagram', 'b.whiteboard.json': 'whiteboard', 'c.md': 'markdown' });
  });

  it('validates only diagrams; a corrupt diagram is errored, others always ok', async () => {
    await writeDocument(projectDir, 'bad.yaml', 'nodes: [this is not: valid');
    await writeDocument(projectDir, 'x.whiteboard.json', '{not json'); // still ok: not validated
    const entries = await listDocuments(projectDir);
    expect(entries.find((e) => e.fileName === 'bad.yaml')?.status).toBe('error');
    expect(entries.find((e) => e.fileName === 'x.whiteboard.json')?.status).toBe('ok');
  });

  it('creates an auto-named document per type, disambiguating collisions', async () => {
    const d1 = await createDocument(projectDir, 'diagram');
    expect(d1).toBe('untitled.yaml');
    const d2 = await createDocument(projectDir, 'diagram');
    expect(d2).toBe('untitled-2.yaml');
    expect(await createDocument(projectDir, 'whiteboard')).toBe('untitled.whiteboard.json');
    expect(await createDocument(projectDir, 'markdown')).toBe('untitled.md');
  });

  it('seeds an empty diagram, a wrapped-empty whiteboard, and a starter markdown', async () => {
    const wb = await createDocument(projectDir, 'whiteboard');
    expect(JSON.parse(await readDocument(projectDir, wb))).toEqual({ version: 1, snapshot: null, backdropDiagram: null });
    const md = await createDocument(projectDir, 'markdown');
    expect(await readDocument(projectDir, md)).toContain('#');
    const dg = await createDocument(projectDir, 'diagram');
    expect(await readDocument(projectDir, dg)).toContain('nodes: []');
  });

  it('refuses a path that escapes the project', async () => {
    await expect(readDocument(projectDir, '../../etc/hosts')).rejects.toThrow(/outside the project/);
    await expect(writeDocument(projectDir, '../escape.md', 'x')).rejects.toThrow(/outside the project/);
  });

  it('creating an untitled whiteboard is a distinct document from an untitled diagram', async () => {
    await createDocument(projectDir, 'diagram');
    await createDocument(projectDir, 'whiteboard');
    const names = (await listDocuments(projectDir)).map((e) => e.fileName).sort();
    expect(names).toEqual(['untitled.whiteboard.json', 'untitled.yaml']);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/main/projectManager.test.ts` → FAIL (`listDocuments`/`readDocument`/`writeDocument`/`createDocument` not exported).

- [ ] **Step 4: Rewrite `projectManager.ts`**

Replace the file's contents with:

```ts
import { readFile, writeFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { serializeDiagram } from '../shared/yaml/serialize';
import { parseDiagram } from '../shared/yaml/parse';
import { emptyDiagram } from '../shared/ir/types';
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

/** Write any document's raw text. */
export async function writeDocument(projectDir: string, fileName: string, text: string): Promise<void> {
  await writeFile(resolveInProject(projectDir, fileName), text, 'utf-8');
}

async function fileExists(filePath: string): Promise<boolean> {
  try { await access(filePath); return true; } catch { return false; }
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

/** Read the project's shared templates file (empty document if it doesn't exist). */
export async function readTemplates(projectDir: string): Promise<string> {
  return readFile(path.join(projectDir, TEMPLATES_FILE), 'utf-8').catch(() => 'templates: []\n');
}

/** Write the project's shared templates file. */
export async function writeTemplates(projectDir: string, yamlText: string): Promise<void> {
  await writeFile(path.join(projectDir, TEMPLATES_FILE), yamlText, 'utf-8');
}
```

Note: this drops `whiteboardName`, `readWhiteboard`, `writeWhiteboard`, `slugify`, `createDiagram`, `readDiagram`, `writeDiagram`. Their callers are updated in Tasks 4–5. `TEMPLATES_FILE` now re-exports from `documentType`.

- [ ] **Step 5: Run the projectManager test**

Run: `npx vitest run src/main/projectManager.test.ts` → PASS. (Other suites and typecheck will fail until Tasks 4–5 update callers — that's expected; do not run the full suite yet.)

- [ ] **Step 6: Commit**

```bash
git add src/shared/project/types.ts src/main/projectManager.ts src/main/projectManager.test.ts
git commit -m "feat(main): generic document store (list/read/write/create by type)"
```

---

## Task 4: IPC + preload for the generic document API

Rename the bridge to documents, seed nothing on new project, and drop the whiteboard-sidecar channels.

**Files:**
- Modify: `src/shared/project/types.ts` (`SolarchitectApi`, `NewProjectResult`)
- Modify: `src/main/ipcHandlers.ts:29-99`
- Modify: `src/preload/index.ts:8-21`

**Interfaces:**
- Consumes: `listDocuments`, `readDocument`, `writeDocument`, `createDocument` (Task 3); `DocumentType`, `DocumentEntry`.
- Produces (new `SolarchitectApi` shape):
  - `listDocuments(projectDir): Promise<DocumentEntry[]>`
  - `readDocument(projectDir, fileName): Promise<string>`
  - `writeDocument(projectDir, fileName, text): Promise<void>`
  - `createDocument(projectDir, type: DocumentType): Promise<string>`
  - `newProject(): Promise<{ dir: string } | null>` (no seeded file)
  - unchanged: templates, export, git, settings, `openFolder`.

- [ ] **Step 1: Update `SolarchitectApi` in `src/shared/project/types.ts`**

Replace the diagram/whiteboard method block (lines ~57-71) so the interface reads:

```ts
import type { DocumentType } from './documentType';
// ...existing imports/exports above...

export interface NewProjectResult {
  dir: string;
}

export interface SolarchitectApi {
  openFolder(): Promise<string | null>;
  listDocuments(projectDir: string): Promise<DocumentEntry[]>;
  readDocument(projectDir: string, fileName: string): Promise<string>;
  writeDocument(projectDir: string, fileName: string, text: string): Promise<void>;
  createDocument(projectDir: string, type: DocumentType): Promise<string>;
  readTemplates(projectDir: string): Promise<string>;
  writeTemplates(projectDir: string, yamlText: string): Promise<void>;
  exportImage(base64Data: string, suggestedName: string): Promise<string | null>;
  newProject(): Promise<NewProjectResult | null>;
  gitStatus(projectDir: string): Promise<GitStatus>;
  gitSync(projectDir: string, message: string): Promise<GitSyncResult>;
  gitInit(projectDir: string): Promise<GitSyncResult>;
  gitDetail(projectDir: string): Promise<GitDetail>;
  gitCommit(projectDir: string, message: string): Promise<GitSyncResult>;
  gitPush(projectDir: string): Promise<GitSyncResult>;
  gitPull(projectDir: string): Promise<GitSyncResult>;
  gitCreateBranch(projectDir: string, name: string): Promise<GitSyncResult>;
  gitCheckoutBranch(projectDir: string, name: string): Promise<GitSyncResult>;
  readSettings(): Promise<SettingsReadResult>;
  writeSettings(settings: AppSettings): Promise<AppSettings>;
}
```

Remove `DiagramFileEntry` from this file (now replaced by `DocumentEntry`). Keep `GitStatus`, `GitSyncResult`, etc. unchanged.

- [ ] **Step 2: Update `ipcHandlers.ts`**

Change the import block and the relevant handlers:

```ts
import {
  listDocuments,
  readDocument,
  writeDocument,
  createDocument,
  readTemplates,
  writeTemplates,
} from './projectManager';
import type { DocumentType } from '../shared/project/documentType';
```

Replace the `newProject` handler (lines ~43-55) with (no seeded diagram — the project starts empty):

```ts
  // Create a new project: pick/create a folder and git-init it. Starts empty;
  // the user creates the first document via the New menu.
  ipcMain.handle('project:newProject', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Create or choose a folder for the new project',
      buttonLabel: 'Create project',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const dir = result.filePaths[0];
    const status = await gitStatus(dir);
    if (!status.isRepo) await gitInit(dir);
    return { dir };
  });
```

Replace the diagram/whiteboard handlers (lines ~74-89) with:

```ts
  ipcMain.handle('project:listDocuments', (_e, projectDir: string) => listDocuments(projectDir));
  ipcMain.handle('project:readDocument', (_e, projectDir: string, fileName: string) =>
    readDocument(projectDir, fileName),
  );
  ipcMain.handle('project:writeDocument', (_e, projectDir: string, fileName: string, text: string) =>
    writeDocument(projectDir, fileName, text),
  );
  ipcMain.handle('project:createDocument', (_e, projectDir: string, type: DocumentType) =>
    createDocument(projectDir, type),
  );
```

Leave the `openFolder`, git, templates, export, and settings handlers unchanged.

- [ ] **Step 3: Update `preload/index.ts`**

Replace the diagram/whiteboard/create lines (9-17, 21) with:

```ts
  listDocuments: (projectDir) => ipcRenderer.invoke('project:listDocuments', projectDir),
  readDocument: (projectDir, fileName) => ipcRenderer.invoke('project:readDocument', projectDir, fileName),
  writeDocument: (projectDir, fileName, text) =>
    ipcRenderer.invoke('project:writeDocument', projectDir, fileName, text),
  createDocument: (projectDir, type) => ipcRenderer.invoke('project:createDocument', projectDir, type),
```

and change `newProject` to `newProject: () => ipcRenderer.invoke('project:newProject'),` (unchanged text, still valid).

- [ ] **Step 4: Typecheck (node project)**

Run: `npm run typecheck`
Expected: the node project passes; the web project will still error in `useProject.ts`/`App.tsx`/`WhiteboardView.tsx` (fixed in Tasks 6–11). That's expected at this checkpoint — proceed.

- [ ] **Step 5: Commit**

```bash
git add src/shared/project/types.ts src/main/ipcHandlers.ts src/preload/index.ts
git commit -m "feat(ipc): generic document bridge; new project starts empty"
```

---

## Task 5: Panels model keyed by document type (pure)

Turn `Surface` into `DocumentType` and encode per-type panel availability: universal (Project, Git, Settings, Help) for all; Diagram adds Search/Outline/Shapes/Templates; Markdown adds Search/Outline; Whiteboard universal-only.

**Files:**
- Modify: `src/shared/shell/panels.ts`
- Modify: `src/shared/shell/panels.test.ts`

**Interfaces:**
- Consumes: `DocumentType` from `../project/documentType`.
- Produces:
  - `isPanelAvailable(panel: PanelId, type: DocumentType): boolean`
  - `panelsForType(type: DocumentType): PanelMeta[]`
  - `resolveActivePanel(type: DocumentType, preferredByType: Partial<Record<DocumentType, PanelId>>): PanelId`
  - `PANELS`, `DEFAULT_PANEL`, `PanelId`, `PanelMeta`, `PanelGroup` unchanged.

- [ ] **Step 1: Read the existing test, then update it (failing)**

Open `src/shared/shell/panels.test.ts`, replace any `Surface`/`'architect'`/`'whiteboard'` usage with `DocumentType` values and these assertions (add if missing):

```ts
import { describe, it, expect } from 'vitest';
import { isPanelAvailable, panelsForType, resolveActivePanel } from './panels';

describe('panels by document type', () => {
  it('diagram exposes every panel', () => {
    const ids = panelsForType('diagram').map((p) => p.id);
    expect(ids).toContain('shapes');
    expect(ids).toContain('templates');
    expect(ids).toContain('outline');
    expect(ids).toContain('search');
  });

  it('whiteboard is universal-only (no shapes/templates/outline/search)', () => {
    expect(isPanelAvailable('shapes', 'whiteboard')).toBe(false);
    expect(isPanelAvailable('templates', 'whiteboard')).toBe(false);
    expect(isPanelAvailable('outline', 'whiteboard')).toBe(false);
    expect(isPanelAvailable('search', 'whiteboard')).toBe(false);
    expect(isPanelAvailable('project', 'whiteboard')).toBe(true);
    expect(isPanelAvailable('git', 'whiteboard')).toBe(true);
  });

  it('markdown adds outline and search but not shapes/templates', () => {
    expect(isPanelAvailable('outline', 'markdown')).toBe(true);
    expect(isPanelAvailable('search', 'markdown')).toBe(true);
    expect(isPanelAvailable('shapes', 'markdown')).toBe(false);
    expect(isPanelAvailable('templates', 'markdown')).toBe(false);
  });

  it('falls back to project when a remembered panel is unavailable on the type', () => {
    expect(resolveActivePanel('whiteboard', { whiteboard: 'shapes' })).toBe('project');
    expect(resolveActivePanel('markdown', { markdown: 'outline' })).toBe('outline');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/shared/shell/panels.test.ts` → FAIL.

- [ ] **Step 3: Rewrite `panels.ts`**

Replace the `Surface` type and the availability logic. Keep `PANELS`, `PanelId`, `PanelMeta`, `PanelGroup`, `DEFAULT_PANEL` exactly as they are; change the rest:

```ts
import type { DocumentType } from '../project/documentType';

// ...PanelId, PanelGroup, PanelMeta, PANELS, DEFAULT_PANEL unchanged...

/** Panels that only make sense on the structured Diagram surface. */
const DIAGRAM_ONLY: ReadonlySet<PanelId> = new Set<PanelId>(['shapes', 'templates']);
/** Panels tied to document structure (nodes or headings). */
const STRUCTURE_PANELS: ReadonlySet<PanelId> = new Set<PanelId>(['outline', 'search']);

export function isPanelAvailable(panel: PanelId, type: DocumentType): boolean {
  if (DIAGRAM_ONLY.has(panel)) return type === 'diagram';
  if (STRUCTURE_PANELS.has(panel)) return type === 'diagram' || type === 'markdown';
  return true; // project, git, settings, help — universal
}

export function panelsForType(type: DocumentType): PanelMeta[] {
  return PANELS.filter((p) => isPanelAvailable(p.id, type));
}

export function resolveActivePanel(
  type: DocumentType,
  preferredByType: Partial<Record<DocumentType, PanelId>>,
): PanelId {
  const preferred = preferredByType[type] ?? DEFAULT_PANEL;
  return isPanelAvailable(preferred, type) ? preferred : DEFAULT_PANEL;
}
```

Delete the old `Surface` export.

- [ ] **Step 4: Run + typecheck (node project only for now)**

Run: `npx vitest run src/shared/shell/panels.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/shell/panels.ts src/shared/shell/panels.test.ts
git commit -m "feat(shared): panel availability keyed by document type"
```

---

## Task 6: Markdown outline + search (pure)

Extract heading structure and searchable text from markdown so Outline and Search work on markdown documents.

**Files:**
- Create: `src/shared/markdown/markdownOutline.ts`
- Test: `src/shared/markdown/markdownOutline.test.ts`

**Interfaces:**
- Produces:
  - `interface MarkdownHeading { id: string; level: number; text: string; line: number }`
  - `markdownHeadings(text: string): MarkdownHeading[]` — ATX `#`..`######`, skipping fenced code blocks; `id` is a slug unique within the doc.
  - `searchMarkdown(text: string, query: string): MarkdownHeading[]` — headings whose text matches (case-insensitive).

- [ ] **Step 1: Write the failing test**

```ts
// src/shared/markdown/markdownOutline.test.ts
import { describe, it, expect } from 'vitest';
import { markdownHeadings, searchMarkdown } from './markdownOutline';

describe('markdownHeadings', () => {
  it('extracts ATX headings with level, text, and line', () => {
    const md = '# Title\n\nintro\n\n## Section A\ntext\n### Sub\n';
    expect(markdownHeadings(md)).toEqual([
      { id: 'title', level: 1, text: 'Title', line: 0 },
      { id: 'section-a', level: 2, text: 'Section A', line: 4 },
      { id: 'sub', level: 3, text: 'Sub', line: 6 },
    ]);
  });

  it('ignores # inside fenced code blocks', () => {
    const md = '# Real\n\n```\n# not a heading\n```\n## Also real\n';
    expect(markdownHeadings(md).map((h) => h.text)).toEqual(['Real', 'Also real']);
  });

  it('disambiguates duplicate heading slugs', () => {
    const md = '# Setup\n# Setup\n';
    expect(markdownHeadings(md).map((h) => h.id)).toEqual(['setup', 'setup-2']);
  });

  it('searchMarkdown matches heading text case-insensitively', () => {
    const md = '# Auth\n## Database\n';
    expect(searchMarkdown(md, 'data').map((h) => h.text)).toEqual(['Database']);
    expect(searchMarkdown(md, '')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/shared/markdown/markdownOutline.test.ts` → FAIL.

- [ ] **Step 3: Write the implementation**

```ts
// src/shared/markdown/markdownOutline.ts
/**
 * Pure heading extraction for markdown documents, feeding the Outline and Search
 * panels. Deliberately tiny: ATX headings only, code fences skipped. Not a full
 * markdown parser (rendering uses `marked` in the renderer).
 */

export interface MarkdownHeading {
  id: string;
  level: number;
  text: string;
  line: number;
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  );
}

export function markdownHeadings(text: string): MarkdownHeading[] {
  const lines = text.split('\n');
  const headings: MarkdownHeading[] = [];
  const used = new Map<string, number>();
  let inFence = false;

  lines.forEach((raw, line) => {
    const trimmed = raw.trim();
    if (/^(```|~~~)/.test(trimmed)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const m = /^(#{1,6})\s+(.*\S)\s*$/.exec(raw);
    if (!m) return;
    const level = m[1].length;
    const headingText = m[2].replace(/\s+#+\s*$/, ''); // strip trailing closing #'s
    const base = slugify(headingText);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    const id = seen === 0 ? base : `${base}-${seen + 1}`;
    headings.push({ id, level, text: headingText, line });
  });

  return headings;
}

export function searchMarkdown(text: string, query: string): MarkdownHeading[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return markdownHeadings(text).filter((h) => h.text.toLowerCase().includes(q));
}
```

- [ ] **Step 4: Run + typecheck**

Run: `npx vitest run src/shared/markdown/markdownOutline.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/markdown/markdownOutline.ts src/shared/markdown/markdownOutline.test.ts
git commit -m "feat(shared): markdown heading extraction for outline/search"
```

---

## Task 7: Add the `marked` dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

Run: `npm install marked@^14`
Expected: `marked` added to `dependencies` in `package.json` and `package-lock.json`.

- [ ] **Step 2: Verify it imports under the web tsconfig**

Create a scratch check (then delete): add `import { marked } from 'marked';` to `src/renderer/src/editor/MarkdownView.tsx` in Task 11 — for now just confirm install succeeded:

Run: `node -e "require('marked'); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add marked for markdown rendering"
```

---

## Task 8: `useProject` — track and dispatch by document type

The hook now tracks the open document's type, opens by type (diagrams load into the sync engine; whiteboard/markdown do not), exposes `newDocument(type)`, and resets the sync engine to empty when a non-diagram opens so a stale diagram never leaks into panels/backdrop-independent chrome.

**Files:**
- Modify: `src/renderer/src/hooks/useProject.ts`

**Interfaces:**
- Consumes: `documentTypeForFile`, `DocumentType`; `parseDiagram`; `emptyDiagram`; `DocumentEntry`; `window.solarchitect.{listDocuments,readDocument,writeDocument,createDocument,newProject,openFolder,gitStatus}`.
- Produces (hook return, additions/renames):
  - `entries: DocumentEntry[]`
  - `currentFile: string | null`, `currentType: DocumentType | null`
  - `openDocument(fileName: string): Promise<void>`
  - `newDocument(type: DocumentType): Promise<void>`
  - `saveDocument(text: string): Promise<void>` (renamed from `saveDiagram`)
  - `openProject`, `newProject`, `setIoError`, `dismissError`, `projectDir`, `ioError` unchanged.

- [ ] **Step 1: Rewrite `useProject.ts`**

```ts
import { useCallback, useState } from 'react';
import { parseDiagram } from '@shared/yaml/parse';
import { emptyDiagram, type Diagram } from '@shared/ir/types';
import { documentTypeForFile, type DocumentType } from '@shared/project/documentType';
import type { DocumentEntry } from '@shared/project/types';

/**
 * Project = a folder of typed documents. Owns the open folder, its document list,
 * the current file + its type, and drives load/save/create through the preload
 * bridge. Only diagrams flow into the sync engine; opening a whiteboard or
 * markdown resets the engine to empty so no stale diagram bleeds into chrome.
 */
export function useProject(loadDiagram: (d: Diagram) => void) {
  const [projectDir, setProjectDir] = useState<string | null>(null);
  const [entries, setEntries] = useState<DocumentEntry[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [currentType, setCurrentType] = useState<DocumentType | null>(null);
  const [ioError, setIoError] = useState<string | null>(null);

  const refresh = useCallback(async (dir: string) => {
    setEntries(await window.solarchitect.listDocuments(dir));
  }, []);

  const openDocument = useCallback(
    async (fileName: string) => {
      const dir = projectDir;
      if (!dir) return;
      const type = documentTypeForFile(fileName);
      if (!type) return;
      try {
        if (type === 'diagram') {
          const text = await window.solarchitect.readDocument(dir, fileName);
          const result = parseDiagram(text);
          if (!result.ok) {
            setIoError(`${fileName}: ${result.error.message}`);
            return;
          }
          loadDiagram(result.diagram);
        } else {
          // Whiteboard/markdown own their editors; the sync engine holds nothing.
          loadDiagram(emptyDiagram());
        }
        setCurrentFile(fileName);
        setCurrentType(type);
      } catch (e) {
        setIoError(`Could not open ${fileName}: ${(e as Error).message}`);
      }
    },
    [projectDir, loadDiagram],
  );

  const openAt = useCallback(
    async (dir: string) => {
      setProjectDir(dir);
      setCurrentFile(null);
      setCurrentType(null);
      loadDiagram(emptyDiagram());
      await refresh(dir);
    },
    [refresh, loadDiagram],
  );

  const openProject = useCallback(async () => {
    try {
      const dir = await window.solarchitect.openFolder();
      if (dir) await openAt(dir);
    } catch (e) {
      setIoError(`Could not open project: ${(e as Error).message}`);
    }
  }, [openAt]);

  const newProject = useCallback(async () => {
    try {
      const result = await window.solarchitect.newProject();
      if (result) await openAt(result.dir);
    } catch (e) {
      setIoError(`Could not create project: ${(e as Error).message}`);
    }
  }, [openAt]);

  const newDocument = useCallback(
    async (type: DocumentType) => {
      if (!projectDir) return;
      try {
        const fileName = await window.solarchitect.createDocument(projectDir, type);
        await refresh(projectDir);
        await openDocument(fileName);
      } catch (e) {
        setIoError(`Could not create document: ${(e as Error).message}`);
      }
    },
    [projectDir, refresh, openDocument],
  );

  const saveDocument = useCallback(
    async (text: string) => {
      if (!projectDir || !currentFile) return;
      try {
        await window.solarchitect.writeDocument(projectDir, currentFile, text);
        await refresh(projectDir);
      } catch (e) {
        setIoError(`Could not save ${currentFile}: ${(e as Error).message}`);
      }
    },
    [projectDir, currentFile, refresh],
  );

  return {
    projectDir,
    entries,
    currentFile,
    currentType,
    ioError,
    setIoError,
    dismissError: () => setIoError(null),
    openProject,
    newProject,
    openDocument,
    newDocument,
    saveDocument,
  };
}
```

Note: the legacy `migrateLegacyAnnotations` helper is gone — the whiteboard file format (Task 2) now absorbs the `pendingAnnotations` seed, and diagrams no longer carry annotations.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: `useProject.ts` is clean; `App.tsx` still errors (uses old names) — fixed in Task 10.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/hooks/useProject.ts
git commit -m "feat(renderer): project hook tracks document type and dispatches by it"
```

---

## Task 9: `useWorkspaceLayout` + `ActivityBar` keyed by document type

Drop the surface selector; the activity bar shows the panels for the current document type plus a read-only type indicator. Layout preferences are remembered per document type.

**Files:**
- Modify: `src/renderer/src/hooks/useWorkspaceLayout.ts`
- Modify: `src/renderer/src/ui/ActivityBar.tsx`

**Interfaces:**
- Consumes: `DocumentType`, `resolveActivePanel`, `panelsForType`, `PanelId`.
- Produces:
  - `useWorkspaceLayout(type: DocumentType)` → same shape as today (`activePanel`, `collapsed`, `width`, `selectPanel`, `toggleCollapsed`, `setWidth`), preferences keyed by type.
  - `ActivityBar` props: `{ documentType: DocumentType; activePanel; collapsed; onSelectPanel }` — no `surface`/`onSurfaceChange`.

- [ ] **Step 1: Update `useWorkspaceLayout.ts`**

Change the import and the surface references:

```ts
import { resolveActivePanel, type PanelId } from '@shared/shell/panels';
import type { DocumentType } from '@shared/project/documentType';

interface LayoutState {
  preferredByType: Partial<Record<DocumentType, PanelId>>;
  collapsed: boolean;
  width: number;
}
```

In `load()`, rename `preferredBySurface` → `preferredByType` (and the localStorage-parse guard). Bump `const LS_KEY = 'solarchitect.layout.v2';` so the reshaped state doesn't collide with v1. Change the signature to `useWorkspaceLayout(type: DocumentType)` and pass `type` everywhere `surface` was passed:

```ts
export function useWorkspaceLayout(type: DocumentType) {
  const [state, setState] = useState<LayoutState>(load);
  // ...persist effect unchanged...
  const activePanel = resolveActivePanel(type, state.preferredByType);

  const selectPanel = useCallback(
    (panel: PanelId) => {
      setState((s) => {
        const current = resolveActivePanel(type, s.preferredByType);
        if (!s.collapsed && panel === current) return { ...s, collapsed: true };
        return { ...s, collapsed: false, preferredByType: { ...s.preferredByType, [type]: panel } };
      });
    },
    [type],
  );
  // ...toggleCollapsed, setWidth, return unchanged...
}
```

- [ ] **Step 2: Update `ActivityBar.tsx`**

Remove the surface-selector `<div className="actbar__surface">` block and the `SURFACE_LABEL`/`Surface` usage. Keep the panel-icon rendering. The type indicator is a small non-interactive badge at the top.

Replace the component signature and top group:

```tsx
import { panelsForType, type PanelId } from '@shared/shell/panels';
import type { DocumentType } from '@shared/project/documentType';

const TYPE_LABEL: Record<DocumentType, string> = {
  diagram: 'Diagram',
  whiteboard: 'Whiteboard',
  markdown: 'Markdown',
};

// Keep the ICONS map but change its key type to PanelId | DocumentType and ensure
// entries exist for 'diagram' | 'whiteboard' | 'markdown' (reuse the existing
// 'architect' art for 'diagram'; add a simple document glyph for 'markdown').

export function ActivityBar({
  documentType,
  activePanel,
  collapsed,
  onSelectPanel,
}: {
  documentType: DocumentType | null;
  activePanel: PanelId;
  collapsed: boolean;
  onSelectPanel: (p: PanelId) => void;
}) {
  const panels = documentType ? panelsForType(documentType) : panelsForType('diagram');
  const primary = panels.filter((p) => p.group === 'primary');
  const utility = panels.filter((p) => p.group === 'utility');
  // ...panelButton unchanged...
  return (
    <nav className="actbar" role="tablist" aria-label="Activity bar" aria-orientation="vertical">
      {documentType && (
        <div className="actbar__group actbar__typebadge" role="img" aria-label={`${TYPE_LABEL[documentType]} document`} title={`${TYPE_LABEL[documentType]} document`} data-testid={`doctype-${documentType}`}>
          <Icon name={documentType} />
        </div>
      )}
      <span className="actbar__sep" />
      <div className="actbar__group">{primary.map((p) => panelButton(p.id, p.label))}</div>
      <span className="actbar__spacer" />
      <div className="actbar__group">{utility.map((p) => panelButton(p.id, p.label))}</div>
    </nav>
  );
}
```

Update the `ICONS` record type to `Record<PanelId | DocumentType, JSX.Element>`: rename the `architect` key to `diagram`, keep `whiteboard`, and add a `markdown` glyph:

```tsx
  markdown: (
    <>
      <path d="M4 5h16v14H4z" />
      <path d="M7 15V9l2.5 2.5L12 9v6M15.5 9v4.5M15.5 13.5L14 12M15.5 13.5L17 12" />
    </>
  ),
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck` — `useWorkspaceLayout.ts` and `ActivityBar.tsx` clean; `App.tsx` still errors (Task 10).

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/hooks/useWorkspaceLayout.ts src/renderer/src/ui/ActivityBar.tsx
git commit -m "feat(renderer): activity bar shows type-scoped panels + type badge, no surface toggle"
```

---

## Task 10: `App.tsx` — render by document type; gate diagram-only chrome

`App` no longer holds a `surface`; it derives the active editor from `project.currentType`. Diagram-only chrome (Animate, Present, the Visual/Split/Code footer) shows only for diagrams. The New menu, grouped list, backdrop, and markdown editor are wired here.

**Files:**
- Modify: `src/renderer/src/App.tsx`

**Interfaces:**
- Consumes: `project.currentType`, `project.newDocument`, `project.openDocument`, `project.saveDocument` (Task 8); `useWorkspaceLayout(type)` (Task 9); `MarkdownView` (Task 11); updated `WhiteboardView` (Task 12); updated `ProjectSidebar` (Task 13).
- Produces: the composed shell.

- [ ] **Step 1: Replace surface state with a derived type**

Remove `const [surface, setSurface] = useState<Mode>('architect');` and the `import type { Mode }`. Derive:

```tsx
const docType = project.currentType ?? 'diagram';
const layout = useWorkspaceLayout(docType);
```

Change the `view` gating and `reveal` to key off `docType === 'diagram'` instead of `surface === 'architect'`. Replace `effectiveView`:

```tsx
const [view, setView] = useState<View>('split');
const isDiagram = docType === 'diagram';
const showCanvas = isDiagram ? view !== 'code' : false;
const showSource = isDiagram && view === 'split';
```

- [ ] **Step 2: Gate the top-bar chrome**

Wrap the Animate/Present group so it only renders for diagrams:

```tsx
{isDiagram && showCanvas && (
  <div className="topgroup">
    {/* existing Animate + Present buttons unchanged */}
  </div>
)}
```

- [ ] **Step 3: Render the correct editor in `<main className="stage">`**

Replace the `surface === 'whiteboard' ? ... : showCanvas ? ... : <YamlCodeEditor .../>` block with a type switch:

```tsx
<main className="stage">
  {!project.currentFile ? (
    <div className="stage__empty" data-testid="no-document">
      <p>No document open.</p>
      <p className="muted">Use <strong>New</strong> in the Project panel to create a diagram, whiteboard, or markdown document.</p>
    </div>
  ) : docType === 'whiteboard' ? (
    <WhiteboardView
      key={project.currentFile}
      projectDir={project.projectDir}
      fileName={project.currentFile}
      entries={project.entries}
      onError={project.setIoError}
    />
  ) : docType === 'markdown' ? (
    <MarkdownView
      key={project.currentFile}
      projectDir={project.projectDir}
      fileName={project.currentFile}
      view={view}
      revealTarget={revealTarget}
      onError={project.setIoError}
      onGitRefresh={git.refresh}
      autosave={settings.autosave}
    />
  ) : showCanvas ? (
    <CanvasView
      diagram={diagram}
      templates={templates.templates}
      mode="architect"
      animate={animate}
      presenting={presenting}
      presentIndex={presentIndex}
      grid={settings.grid}
      revealTarget={revealTarget}
      onCanvasEdit={onCanvasEdit}
      onSaveTemplate={beginSaveTemplate}
      onError={project.setIoError}
    />
  ) : (
    <YamlCodeEditor yamlText={yamlText} yamlError={yamlError} canvasEditSeq={canvasEditSeq} onYamlEdit={onYamlEdit} full />
  )}
</main>
```

- [ ] **Step 4: Fix the footer view control + autosave + ActivityBar props**

- Footer segmented control: change `{surface === 'architect' && (` to `{isDiagram && (` for the Visual/Split/Code group; add a parallel Preview/Split/Source group for markdown:

```tsx
{docType === 'markdown' && (
  <div className="segmented" role="tablist" aria-label="Markdown view">
    {([['visual', 'Preview'], ['split', 'Split'], ['code', 'Source']] as const).map(([v, label]) => (
      <button key={v} role="tab" data-testid={`md-view-${v}`} aria-selected={view === v}
        className={`segmented__btn${view === v ? ' on' : ''}`} onClick={() => setView(v)} title={`${label} view`}>
        {label}
      </button>
    ))}
  </div>
)}
```

- Autosave effect (`App.tsx:97-104`): the diagram autosave must only run for diagrams (markdown handles its own autosave inside `MarkdownView`; whiteboard already self-saves). Change the guard:

```tsx
if (!settings.autosave || !project.currentFile || !isDiagram || yamlError) return;
const t = setTimeout(() => {
  void project.saveDocument(yamlText).then(() => git.refresh());
}, 600);
```

- Update the `<ActivityBar>` usage — remove `surface`/`onSurfaceChange`, pass `documentType={project.currentType}`:

```tsx
<ActivityBar
  documentType={project.currentType}
  activePanel={layout.activePanel}
  collapsed={layout.collapsed}
  onSelectPanel={layout.selectPanel}
/>
```

- Update the ProjectSidebar props: replace `onNewDiagram={project.newDiagram}` with `onNewDocument={project.newDocument}`, and `onSave`/`onOpenDiagram` to call `project.saveDocument`/`project.openDocument` (and `canSave` to `!!project.currentFile && (isDiagram ? !yamlError : true)`).

- Fix `reveal` to use `docType`:

```tsx
const reveal = useCallback((id: string) => {
  if (docType === 'diagram' && view === 'code') setView('split');
  revealNonce.current += 1;
  setRevealTarget({ id, nonce: revealNonce.current });
}, [docType, view]);
```

- The Outline/Search panels need the markdown text when a markdown doc is open. Add a small state that mirrors the open markdown source (lifted from `MarkdownView` via an `onTextChange` callback), or read it in App. Simplest: keep a `markdownText` state in App, set by `MarkdownView` through an `onTextChange` prop, and pass to `OutlinePanel`/`SearchPanel` (Task 13 consumes it).

```tsx
const [markdownText, setMarkdownText] = useState('');
```
Pass `onTextChange={setMarkdownText}` to `MarkdownView` and `markdownText`/`docType` to the panels.

- [ ] **Step 5: Typecheck (expected: fails only where Task 11/12/13 components don't yet match)**

Run: `npm run typecheck`
Expected: remaining errors point only at `MarkdownView`, `WhiteboardView`, `ProjectSidebar`, `OutlinePanel`, `SearchPanel` signatures — resolved in Tasks 11–13. Do not commit until Step 6 compiles; if you are executing strictly task-by-task, implement Tasks 11–13 before this typecheck goes green. (This task's commit may be grouped with 11–13 at the executor's discretion; see note.)

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/App.tsx
git commit -m "feat(renderer): render editor by document type; gate diagram-only chrome"
```

> Executor note: Tasks 10–13 are mutually referential (App wires components whose props change here). If your workflow requires each commit to typecheck green, implement Tasks 11, 12, 13 first, then Task 10, and squash-commit as one "render by type" change. The task split reflects reviewable units, not a hard commit order.

---

## Task 11: `MarkdownView` (new editor)

A Preview / Split / Source markdown editor: a `<textarea>` source pane and a rendered-HTML preview via `marked`. Autosaves through the bridge; reports its text upward for Outline/Search; supports reveal-to-heading.

**Files:**
- Create: `src/renderer/src/editor/MarkdownView.tsx`

**Interfaces:**
- Consumes: `marked`; `markdownHeadings` (for anchor ids); `window.solarchitect.{readDocument,writeDocument}`.
- Produces: `MarkdownView` component with props
  `{ projectDir: string | null; fileName: string | null; view: 'visual' | 'split' | 'code'; revealTarget: { id: string; nonce: number } | null; onError: (m: string) => void; onGitRefresh: () => void; autosave: boolean; onTextChange: (t: string) => void }`.

- [ ] **Step 1: Write the component**

```tsx
// src/renderer/src/editor/MarkdownView.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import { markdownHeadings } from '@shared/markdown/markdownOutline';

const SAVE_DEBOUNCE_MS = 600;

/**
 * The Markdown document editor. A raw source textarea and a rendered preview
 * (via `marked`), laid out per the shared Preview/Split/Source control. Content
 * is the user's own local file; rendered inside the app's strict CSP with no
 * network access. Autosaves on change and reports its text up so the Outline and
 * Search panels can index headings.
 */
export function MarkdownView({
  projectDir,
  fileName,
  view,
  revealTarget,
  onError,
  onGitRefresh,
  autosave,
  onTextChange,
}: {
  projectDir: string | null;
  fileName: string | null;
  view: 'visual' | 'split' | 'code';
  revealTarget: { id: string; nonce: number } | null;
  onError: (m: string) => void;
  onGitRefresh: () => void;
  autosave: boolean;
  onTextChange: (t: string) => void;
}) {
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const previewRef = useRef<HTMLDivElement>(null);

  // Load the file once on mount (keyed by fileName from the parent).
  useEffect(() => {
    let cancelled = false;
    if (projectDir && fileName) {
      void window.solarchitect
        .readDocument(projectDir, fileName)
        .then((t) => {
          if (cancelled) return;
          setText(t);
          onTextChange(t);
          setLoaded(true);
        })
        .catch((e) => onError(`Could not open ${fileName}: ${e instanceof Error ? e.message : String(e)}`));
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectDir, fileName]);

  const onChange = useCallback(
    (next: string) => {
      setText(next);
      onTextChange(next);
      if (!autosave || !projectDir || !fileName || !loaded) return;
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void window.solarchitect
          .writeDocument(projectDir, fileName, next)
          .then(() => onGitRefresh())
          .catch((e) => onError(`Could not save ${fileName}: ${e instanceof Error ? e.message : String(e)}`));
      }, SAVE_DEBOUNCE_MS);
    },
    [autosave, projectDir, fileName, loaded, onTextChange, onGitRefresh, onError],
  );

  // Rendered HTML. Anchor ids come from the same slugger as the outline so
  // reveal-to-heading lines up. `marked` is synchronous with default options.
  const html = useMemo(() => {
    const headings = markdownHeadings(text);
    let i = 0;
    const renderer = new marked.Renderer();
    renderer.heading = ({ tokens, depth }) => {
      const raw = tokens.map((t) => ('raw' in t ? (t as { raw: string }).raw : '')).join('');
      const id = headings[i]?.id ?? '';
      i += 1;
      const inner = marked.parseInline(raw) as string;
      return `<h${depth} id="md-${id}">${inner}</h${depth}>`;
    };
    return marked.parse(text, { renderer, breaks: true, async: false }) as string;
  }, [text]);

  // Reveal-to-heading: scroll the preview to the requested anchor.
  useEffect(() => {
    if (!revealTarget || !previewRef.current) return;
    const el = previewRef.current.querySelector(`#md-${CSS.escape(revealTarget.id)}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [revealTarget]);

  const showSource = view !== 'visual';
  const showPreview = view !== 'code';

  return (
    <div className={`markdown markdown--${view}`} data-testid="markdown">
      {showSource && (
        <textarea
          data-testid="markdown-source"
          className="markdown__source"
          value={text}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          placeholder="# Start writing…"
        />
      )}
      {showPreview && (
        <div
          ref={previewRef}
          data-testid="markdown-preview"
          className="markdown__preview"
          // Local, user-authored content rendered under the app's strict CSP.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add minimal styles**

In `src/renderer/src/styles/theme.css`, append layout rules mirroring the split canvas/source (real values to match the existing two-pane look):

```css
.markdown { display: flex; height: 100%; overflow: hidden; }
.markdown__source, .markdown__preview { flex: 1 1 50%; height: 100%; overflow: auto; }
.markdown--visual .markdown__source { display: none; }
.markdown--code .markdown__preview { display: none; }
.markdown--visual .markdown__preview, .markdown--code .markdown__source { flex-basis: 100%; }
.markdown__source { border: 0; resize: none; padding: 16px; font-family: var(--font-mono, monospace); font-size: 13px; line-height: 1.6; background: var(--bg, #fff); color: var(--fg, #111); }
.markdown__preview { padding: 16px 24px; line-height: 1.65; }
.markdown__preview h1, .markdown__preview h2, .markdown__preview h3 { line-height: 1.25; }
.markdown__preview code { font-family: var(--font-mono, monospace); }
.stage__empty { display: flex; flex-direction: column; gap: 8px; align-items: center; justify-content: center; height: 100%; text-align: center; }
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck` — `MarkdownView.tsx` compiles (paired with Task 10).

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/editor/MarkdownView.tsx src/renderer/src/styles/theme.css
git commit -m "feat(renderer): markdown editor with preview/split/source"
```

---

## Task 12: `WhiteboardView` — standalone file + backdrop from referenced diagram

The whiteboard now owns its own file (wrapped format) and picks its backdrop by referencing a diagram in the project, read at open. It no longer receives "the current diagram".

**Files:**
- Modify: `src/renderer/src/canvas/WhiteboardView.tsx`

**Interfaces:**
- Consumes: `parseWhiteboardFile`, `serializeWhiteboardFile`, `isWhiteboardEmpty`, `WhiteboardFile`; `parseDiagram`; `annotationToShape`; `DiagramBackdrop`; `DocumentEntry`; `window.solarchitect.{readDocument,writeDocument}`.
- Produces: `WhiteboardView` with props `{ projectDir: string | null; fileName: string | null; entries: DocumentEntry[]; onError: (m: string) => void }`.

- [ ] **Step 1: Rewrite `WhiteboardView.tsx`**

```tsx
import { Tldraw, react, getSnapshot, loadSnapshot, type Editor } from 'tldraw';
import 'tldraw/tldraw.css';
import { getAssetUrlsByImport } from '@tldraw/assets/imports.vite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { annotationToShape } from './annotationAdapters';
import { DiagramBackdrop } from './DiagramBackdrop';
import { parseWhiteboardFile, serializeWhiteboardFile } from '@shared/whiteboard/whiteboardFile';
import { parseDiagram } from '@shared/yaml/parse';
import { emptyDiagram, type Diagram } from '@shared/ir/types';
import type { DocumentEntry } from '@shared/project/types';

const assetUrls = getAssetUrlsByImport();
const SAVE_DEBOUNCE_MS = 500;

/**
 * The standalone freeform whiteboard document — a plain tldraw editor whose sketch
 * is persisted to its own `name.whiteboard.json` (wrapped format: snapshot +
 * optional backdrop reference). It may name a diagram in the same project to show
 * read-only beneath the sketch; that diagram is read once at open (one document is
 * open at a time, so no live sync is needed). A dangling reference degrades to no
 * backdrop, never an error.
 */
export function WhiteboardView({
  projectDir,
  fileName,
  entries,
  onError,
}: {
  projectDir: string | null;
  fileName: string | null;
  entries: DocumentEntry[];
  onError: (msg: string) => void;
}) {
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const backdropRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const [showBackdrop, setShowBackdrop] = useState(true);
  const [backdropDiagram, setBackdropDiagram] = useState<string | null>(null);
  const [backdrop, setBackdrop] = useState<Diagram>(() => emptyDiagram());

  const diagramOptions = entries.filter((e) => e.type === 'diagram' && e.status === 'ok');

  // Load the referenced diagram's IR for the backdrop (or clear it).
  const loadBackdrop = useCallback(
    async (ref: string | null) => {
      if (!projectDir || !ref) {
        setBackdrop(emptyDiagram());
        return;
      }
      try {
        const text = await window.solarchitect.readDocument(projectDir, ref);
        const result = parseDiagram(text);
        setBackdrop(result.ok ? result.diagram : emptyDiagram());
      } catch {
        setBackdrop(emptyDiagram()); // dangling reference → no backdrop
      }
    },
    [projectDir],
  );

  const persist = useCallback(
    (editor: Editor, ref: string | null) => {
      if (!projectDir || !fileName) return;
      const empty = editor.getCurrentPageShapes().length === 0;
      const file = {
        version: 1 as const,
        snapshot: empty ? null : getSnapshot(editor.store),
        backdropDiagram: ref,
      };
      void window.solarchitect
        .writeDocument(projectDir, fileName, serializeWhiteboardFile(file))
        .catch((e) => onError(`Could not save the whiteboard: ${e instanceof Error ? e.message : String(e)}`));
    },
    [projectDir, fileName, onError],
  );

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      react('whiteboard-backdrop-camera', () => {
        const c = editor.getCamera();
        if (backdropRef.current) {
          backdropRef.current.style.transform = `translate(${c.x * c.z}px, ${c.y * c.z}px) scale(${c.z})`;
        }
      });

      if (projectDir && fileName) {
        void window.solarchitect.readDocument(projectDir, fileName).then((raw) => {
          const file = parseWhiteboardFile(raw);
          setBackdropDiagram(file.backdropDiagram);
          void loadBackdrop(file.backdropDiagram);
          if (file.snapshot) {
            loadSnapshot(editor.store, file.snapshot as Parameters<typeof loadSnapshot>[1]);
          } else if (file.pendingAnnotations?.length) {
            // One-time materialization of legacy annotations, then persist proper.
            editor.createShapes(file.pendingAnnotations.map(annotationToShape));
            persist(editor, file.backdropDiagram);
          }
        }).catch(() => { /* corrupt file → blank; handled by parseWhiteboardFile */ });
      }

      editor.store.listen(
        () => {
          clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => persist(editor, backdropDiagramRef.current), SAVE_DEBOUNCE_MS);
        },
        { source: 'user', scope: 'document' },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectDir, fileName, loadBackdrop, persist],
  );

  // Keep a ref of the current backdrop selection for the store listener closure.
  const backdropDiagramRef = useRef<string | null>(null);
  useEffect(() => { backdropDiagramRef.current = backdropDiagram; }, [backdropDiagram]);

  const onPickBackdrop = useCallback(
    (ref: string | null) => {
      setBackdropDiagram(ref);
      void loadBackdrop(ref);
      if (editorRef.current) persist(editorRef.current, ref);
    },
    [loadBackdrop, persist],
  );

  const hasBackdrop = backdrop.nodes.length + backdrop.clusters.length + (backdrop.frames?.length ?? 0) > 0;

  return (
    <div className="whiteboard" data-testid="whiteboard">
      {showBackdrop && hasBackdrop && (
        <div className="wb-backdrop" aria-hidden="true">
          <div className="wb-backdrop__layer" ref={backdropRef}>
            <DiagramBackdrop diagram={backdrop} />
          </div>
        </div>
      )}
      <Tldraw assetUrls={assetUrls} onMount={handleMount} />
      <div className="wb-controls">
        <select
          data-testid="backdrop-select"
          className="btn btn--sm"
          value={backdropDiagram ?? ''}
          onChange={(e) => onPickBackdrop(e.target.value || null)}
          title="Show a diagram beneath your sketch"
        >
          <option value="">No backdrop</option>
          {diagramOptions.map((e) => (
            <option key={e.fileName} value={e.fileName}>{e.fileName}</option>
          ))}
        </select>
        {hasBackdrop && (
          <button
            type="button"
            data-testid="backdrop-toggle"
            className={`btn btn--sm${showBackdrop ? ' btn--on' : ''}`}
            aria-pressed={showBackdrop}
            onClick={() => setShowBackdrop((v) => !v)}
            title="Show/hide the diagram backdrop"
          >
            {showBackdrop ? '◉ Backdrop' : '◎ Backdrop'}
          </button>
        )}
      </div>
    </div>
  );
}
```

Add a small style for `.wb-controls` in `theme.css` (position the picker + toggle together, top-right, mirroring the old `.wb-backdrop-toggle` placement):

```css
.wb-controls { position: absolute; top: 12px; right: 12px; z-index: 300; display: flex; gap: 8px; }
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck` — `WhiteboardView.tsx` compiles.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/canvas/WhiteboardView.tsx src/renderer/src/styles/theme.css
git commit -m "feat(renderer): standalone whiteboard with backdrop picker from project diagrams"
```

---

## Task 13: `ProjectSidebar`, `NewDocumentMenu`, and type-aware Outline/Search

**Files:**
- Create: `src/renderer/src/project/NewDocumentMenu.tsx`
- Modify: `src/renderer/src/project/ProjectSidebar.tsx`
- Modify: `src/renderer/src/project/OutlinePanel.tsx`
- Modify: `src/renderer/src/project/SearchPanel.tsx`

**Interfaces:**
- `NewDocumentMenu` props: `{ disabled: boolean; onNew: (type: DocumentType) => void }`.
- `ProjectSidebar` props: `{ projectDir; entries: DocumentEntry[]; currentFile; canSave; onOpenProject; onNewProject; onNewDocument: (t: DocumentType) => void; onOpenDocument: (f: string) => void; onSave }`.
- `OutlinePanel` props gain `{ documentType: DocumentType | null; markdownText: string }` alongside the existing `diagram`/`onReveal`.
- `SearchPanel` props gain `{ documentType; markdownText }`.

- [ ] **Step 1: Create `NewDocumentMenu.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { DOCUMENT_TYPES, type DocumentType } from '@shared/project/documentType';

const LABEL: Record<DocumentType, string> = {
  diagram: 'Diagram',
  whiteboard: 'Whiteboard',
  markdown: 'Markdown',
};

/** The "New" button and its type menu. Picking a type creates and opens a
 *  document of that type. */
export function NewDocumentMenu({ disabled, onNew }: { disabled: boolean; onNew: (t: DocumentType) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div className="newmenu" ref={ref}>
      <button data-testid="new-document-btn" className="btn btn--sm" disabled={disabled} onClick={() => setOpen((v) => !v)}>
        New ▾
      </button>
      {open && (
        <div className="newmenu__list" role="menu" data-testid="new-document-menu">
          {DOCUMENT_TYPES.map((t) => (
            <button
              key={t}
              role="menuitem"
              data-testid={`new-${t}`}
              className="newmenu__item"
              onClick={() => {
                setOpen(false);
                onNew(t);
              }}
            >
              {LABEL[t]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

Styles in `theme.css`:

```css
.newmenu { position: relative; }
.newmenu__list { position: absolute; z-index: 400; margin-top: 4px; min-width: 160px; background: var(--panel, #fff); border: 1px solid var(--border, #ddd); border-radius: 6px; box-shadow: 0 6px 20px rgba(0,0,0,.12); display: flex; flex-direction: column; }
.newmenu__item { text-align: left; padding: 8px 12px; background: none; border: 0; cursor: pointer; }
.newmenu__item:hover { background: var(--hover, #f2f2f2); }
```

- [ ] **Step 2: Rewrite `ProjectSidebar.tsx`** (grouped list + icons + empty state + New menu)

```tsx
import { NewDocumentMenu } from './NewDocumentMenu';
import { DOCUMENT_TYPES, type DocumentType } from '@shared/project/documentType';
import type { DocumentEntry } from '@shared/project/types';

const basename = (dir: string) => dir.split(/[/\\]/).filter(Boolean).pop() ?? dir;
const GROUP_LABEL: Record<DocumentType, string> = {
  diagram: 'Diagrams',
  whiteboard: 'Whiteboards',
  markdown: 'Documents',
};

function TypeIcon({ type }: { type: DocumentType }) {
  // 14px inline glyphs matching the activity-bar icons; kept tiny here.
  const paths: Record<DocumentType, JSX.Element> = {
    diagram: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="8.5" y="14" width="7" height="7" rx="1" /></>,
    whiteboard: <><path d="M4 5h16v11H4z" /><path d="M8 9l2.5 2.5L16 6" /></>,
    markdown: <><path d="M4 5h16v14H4z" /><path d="M7 15V9l2.5 2.5L12 9v6" /></>,
  };
  return (
    <svg className="diagram-item__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      {paths[type]}
    </svg>
  );
}

export function ProjectSidebar({
  projectDir,
  entries,
  currentFile,
  canSave,
  onOpenProject,
  onNewProject,
  onNewDocument,
  onOpenDocument,
  onSave,
}: {
  projectDir: string | null;
  entries: DocumentEntry[];
  currentFile: string | null;
  canSave: boolean;
  onOpenProject: () => void;
  onNewProject: () => void;
  onNewDocument: (type: DocumentType) => void;
  onOpenDocument: (fileName: string) => void;
  onSave: () => void;
}) {
  return (
    <>
      <div className="sidebar__head">
        <span className="eyebrow">Project</span>
        <div className={`sidebar__project${projectDir ? '' : ' empty'}`}>
          {projectDir ? basename(projectDir) : 'No project open'}
        </div>
        <div className="sidebar__actions">
          <button data-testid="new-project-btn" onClick={onNewProject} className="btn btn--sm">New project</button>
          <button data-testid="open-project-btn" onClick={onOpenProject} className="btn btn--sm">Open…</button>
        </div>
        <div className="sidebar__actions">
          <NewDocumentMenu disabled={!projectDir} onNew={onNewDocument} />
          <button data-testid="save-btn" onClick={onSave} disabled={!canSave} className="btn btn--sm btn--primary">Save</button>
        </div>
      </div>
      <div className="list" data-testid="document-list">
        {entries.length === 0 && projectDir && (
          <div className="list__empty" data-testid="project-empty">No documents yet — use “New” to create one.</div>
        )}
        {DOCUMENT_TYPES.map((type) => {
          const group = entries.filter((e) => e.type === type);
          if (group.length === 0) return null;
          return (
            <div key={type} className="list__group">
              <div className="list__grouphead">{GROUP_LABEL[type]}</div>
              {group.map((e) => (
                <button
                  key={e.fileName}
                  onClick={() => e.status === 'ok' && onOpenDocument(e.fileName)}
                  disabled={e.status === 'error'}
                  title={e.errorMessage}
                  className={`diagram-item${e.fileName === currentFile ? ' active' : ''}${e.status === 'error' ? ' error' : ''}`}
                >
                  {e.status === 'error' ? <span className="warn" aria-hidden="true">⚠</span> : <TypeIcon type={type} />}
                  {e.fileName}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
```

Styles in `theme.css`:

```css
.list__group { margin-bottom: 8px; }
.list__grouphead { padding: 6px 10px 2px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted, #888); }
.diagram-item__icon { flex: none; margin-right: 6px; vertical-align: middle; }
```

- [ ] **Step 3: Make `OutlinePanel` markdown-aware**

At the top of `OutlinePanel`, branch on `documentType`. Keep the existing diagram rendering; add a headings list for markdown.

```tsx
import { markdownHeadings } from '@shared/markdown/markdownOutline';
import type { DocumentType } from '@shared/project/documentType';

export function OutlinePanel({
  diagram,
  onReveal,
  documentType,
  markdownText,
}: {
  diagram: Diagram;
  onReveal: (id: string) => void;
  documentType: DocumentType | null;
  markdownText: string;
}) {
  if (documentType === 'markdown') {
    const headings = markdownHeadings(markdownText);
    return (
      <div className="outline" data-testid="outline">
        {headings.length === 0 && <div className="list__empty">No headings.</div>}
        {headings.map((h) => (
          <button key={h.id} className={`outline__item lvl${h.level}`} data-testid={`outline-h-${h.id}`} onClick={() => onReveal(h.id)}>
            {h.text}
          </button>
        ))}
      </div>
    );
  }
  // ...existing diagram outline rendering unchanged...
}
```

- [ ] **Step 4: Make `SearchPanel` markdown-aware**

Add `documentType` and `markdownText` props; when `documentType === 'markdown'`, use `searchMarkdown(markdownText, query)` and render heading hits (clicking calls `onReveal(id)`). Keep the diagram/file search path otherwise. (Mirror the existing results structure; render a `Headings` group in place of `Elements`.)

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck` → both projects clean now.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/project/NewDocumentMenu.tsx src/renderer/src/project/ProjectSidebar.tsx src/renderer/src/project/OutlinePanel.tsx src/renderer/src/project/SearchPanel.tsx src/renderer/src/styles/theme.css
git commit -m "feat(renderer): New menu, grouped typed document list, markdown outline/search"
```

---

## Task 14: Full unit + typecheck green

**Files:** none (verification + any residual fixes).

- [ ] **Step 1: Run the full unit suite**

Run: `npm test`
Expected: all pass. Common residuals to fix if red:
- Any remaining import of `listDiagrams`/`readDiagram`/`writeDiagram`/`readWhiteboard`/`createDiagram`/`Surface`/`DiagramFileEntry` — replace with the new names.
- `search.test.ts` still asserts the old `searchProject` shape — that function is unchanged for diagrams, so it should pass; only touch it if it imported removed symbols.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: both projects pass.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: reconcile remaining references to the pre-document-type API"
```

---

## Task 15: E2E — document types, migration, markdown, whiteboard backdrop

Playwright drives the built app. Reuse `tests/e2e/helpers.ts` patterns (open the app, create/open a project). Read an existing spec (e.g. `tests/e2e/whiteboard.spec.ts`, `tests/e2e/persistence.spec.ts`) first to reuse the project-bootstrap helper and selector conventions.

**Files:**
- Create: `tests/e2e/document-types.spec.ts`, `tests/e2e/markdown.spec.ts`, `tests/e2e/whiteboard-standalone.spec.ts`
- Modify: `tests/e2e/whiteboard.spec.ts` (its surface-toggle assumptions no longer hold — update to open a whiteboard document instead of toggling)

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 2: `document-types.spec.ts` — New menu creates each type and opens its editor**

```ts
import { test, expect } from '@playwright/test';
import { launchApp, newProjectInTempDir } from './helpers'; // adapt to the actual helper names

test('New menu creates a diagram, whiteboard, and markdown, each opening its own editor', async () => {
  const app = await launchApp();
  const page = await app.firstWindow();
  await newProjectInTempDir(page); // opens an empty project

  await expect(page.getByTestId('project-empty')).toBeVisible();

  // Diagram
  await page.getByTestId('new-document-btn').click();
  await page.getByTestId('new-diagram').click();
  await expect(page.locator('.tl-canvas')).toBeVisible();
  await expect(page.getByTestId('doctype-diagram')).toBeVisible();
  await expect(page.getByTestId('view-visual')).toBeVisible(); // diagram footer control

  // Whiteboard
  await page.getByTestId('new-document-btn').click();
  await page.getByTestId('new-whiteboard').click();
  await expect(page.getByTestId('whiteboard')).toBeVisible();
  await expect(page.getByTestId('doctype-whiteboard')).toBeVisible();
  await expect(page.getByTestId('view-visual')).toHaveCount(0); // no diagram footer control

  // Markdown
  await page.getByTestId('new-document-btn').click();
  await page.getByTestId('new-markdown').click();
  await expect(page.getByTestId('markdown')).toBeVisible();
  await expect(page.getByTestId('md-view-split')).toBeVisible();

  // The list groups all three
  await expect(page.getByTestId('document-list')).toContainText('untitled.yaml');
  await expect(page.getByTestId('document-list')).toContainText('untitled.whiteboard.json');
  await expect(page.getByTestId('document-list')).toContainText('untitled.md');

  await app.close();
});
```

- [ ] **Step 3: `markdown.spec.ts` — edit renders in preview and persists**

```ts
import { test, expect } from '@playwright/test';
import { launchApp, newProjectInTempDir } from './helpers';

test('markdown edits render in preview and survive reopen', async () => {
  const app = await launchApp();
  const page = await app.firstWindow();
  await newProjectInTempDir(page);

  await page.getByTestId('new-document-btn').click();
  await page.getByTestId('new-markdown').click();

  const source = page.getByTestId('markdown-source');
  await source.fill('# Hello\n\nSome **bold** text.');
  await expect(page.getByTestId('markdown-preview').locator('h1')).toHaveText('Hello');
  await expect(page.getByTestId('markdown-preview').locator('strong')).toHaveText('bold');

  // Outline lists the heading
  await page.getByTestId('activity-outline').click();
  await expect(page.getByTestId('outline-h-hello')).toBeVisible();

  // Reopen → content persisted (autosave)
  await page.waitForTimeout(800);
  await page.getByTestId('activity-project').click();
  await page.getByText('untitled.md').click();
  await expect(page.getByTestId('markdown-preview').locator('h1')).toHaveText('Hello');

  await app.close();
});
```

- [ ] **Step 4: `whiteboard-standalone.spec.ts` — backdrop picker + persistence**

```ts
import { test, expect } from '@playwright/test';
import { launchApp, newProjectInTempDir } from './helpers';

test('a whiteboard can reference a project diagram as backdrop, persisted across reopen', async () => {
  const app = await launchApp();
  const page = await app.firstWindow();
  await newProjectInTempDir(page);

  // Seed a diagram to reference (create + it opens; the fileName is untitled.yaml)
  await page.getByTestId('new-document-btn').click();
  await page.getByTestId('new-diagram').click();

  // New whiteboard, pick the diagram as backdrop
  await page.getByTestId('new-document-btn').click();
  await page.getByTestId('new-whiteboard').click();
  await page.getByTestId('backdrop-select').selectOption('untitled.yaml');

  await page.waitForTimeout(700); // debounced save
  // Reopen the whiteboard → selection restored
  await page.getByTestId('activity-project').click();
  await page.getByText('untitled.whiteboard.json').click();
  await expect(page.getByTestId('backdrop-select')).toHaveValue('untitled.yaml');

  await app.close();
});
```

- [ ] **Step 5: Update `whiteboard.spec.ts`**

Open the spec; wherever it clicks `surface-whiteboard`/`surface-architect` (the removed toggle), replace with creating/opening a whiteboard document (`new-document-btn` → `new-whiteboard`) and, for diagram assertions, opening a diagram document. Remove assertions that both surfaces are reachable on one document.

- [ ] **Step 6: Run E2E**

Run: `npm run test:e2e`
Expected: all specs pass (the whole suite builds first). Fix selectors/helpers to match the actual `helpers.ts` API if names differ.

- [ ] **Step 7: Commit**

```bash
git add tests/e2e/
git commit -m "test(e2e): document types, markdown, standalone whiteboard backdrop"
```

---

## Task 16: Docs + CLAUDE.md alignment

**Files:**
- Modify: `CLAUDE.md` (the "In-flight direction" section and any diagram/whiteboard-sidecar description)

- [ ] **Step 1: Update `CLAUDE.md`**

- Replace the "In-flight direction" paragraph (which describes the superseded layer model) with a short description of the three-document-type model, pointing at `docs/adr/0001-three-document-types-standalone-whiteboard.md` and `CONTEXT.md`.
- Update the `src/main/projectManager.ts` bullet: a project holds typed documents (`.yaml` diagrams, `.whiteboard.json` whiteboards, `.md` markdown) plus `templates.yaml`; `readDocument`/`writeDocument`/`createDocument`/`listDocuments` are the generic file ops behind `resolveInProject`.
- Note the whiteboard is now a standalone document whose file wraps the tldraw snapshot + optional `backdropDiagram` reference.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: align CLAUDE.md with the three-document-type model"
```

---

## Self-Review

**Spec coverage** (against CONTEXT.md + ADR 0001):
- Three types chosen at creation, detected by extension → Tasks 1, 3, 8, 13. ✅
- Interface fixed by type; surface toggle removed → Tasks 9, 10. ✅
- Whiteboard standalone + optional stored backdrop + picker; dangling ref → no backdrop → Tasks 2, 12. ✅
- Markdown Preview/Split/Source, locally-bundled renderer → Tasks 7, 11. ✅
- New = one button → menu → Task 13. ✅
- New project empty + empty state → Tasks 4, 10, 13. ✅
- Grouped list with type icons, empty sections hidden → Task 13. ✅
- Panels by type (universal / diagram / markdown) → Task 5, plus type-aware Outline/Search → Tasks 6, 13. ✅
- Legacy bare-snapshot / pendingAnnotations whiteboards migrate to wrapped format, no backdrop → Tasks 2, 12. ✅
- Auto-name, disambiguated → Tasks 1, 3. ✅
- Git auto-init retained (openFolder/newProject) → unchanged; verified still present in Task 4. ✅
- All types git-tracked (plain files) → inherent; no `.gitignore` change needed (verify `.gitignore` doesn't exclude `*.json`/`*.md` in Task 14 if a suite touches git). 

**Out of scope (not planned, by decision):** in-app rename/delete, tabs/multiple open docs, real-time collaboration, combined whiteboard+diagram export, converting a document between types.

**Placeholder scan:** no TBD/TODO; each code step carries full content. The one deliberate hand-off is the E2E helper API (`launchApp`/`newProjectInTempDir`) — Task 15 Step 1 instructs reading `helpers.ts` to match actual names, because those are existing fixtures not defined in this plan.

**Type consistency:** `DocumentType` (`'diagram'|'whiteboard'|'markdown'`), `DocumentEntry`, and the renamed bridge methods (`listDocuments`/`readDocument`/`writeDocument`/`createDocument`) are used identically across Tasks 1–13. `WhiteboardFile.version` is the literal `1` everywhere. Panel functions renamed `panelsForSurface`→`panelsForType`, `preferredBySurface`→`preferredByType` consistently (Tasks 5, 9).

**Note on migration reach:** the old renderer-side `migrateLegacyAnnotations` (rewriting diagram YAML to drop `annotations`) is dropped. Diagrams already omit `annotations` from the IR (`src/shared/ir/types.ts` `Diagram` has no annotations field) and the parser ignores a stray legacy key, so no separate diagram migration is required; only whiteboard-file migration remains (Task 2).
