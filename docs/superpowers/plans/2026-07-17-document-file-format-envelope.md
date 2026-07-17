# Document File Format + Envelope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic `.yaml`/`.whiteboard.json`/`.md` document extensions with a dedicated, self-describing family (`.sold`/`.solw`/`.solm`) carrying a metadata envelope, saved through a durable atomic-write path, with a one-time auto-migration on project open.

**Architecture:** The envelope lives only at the file boundary, inside the main process. The renderer keeps reading/writing **body** text through the existing IPC (diagram YAML, whiteboard JSON, markdown) — `readDocument` strips the envelope and returns the body; `writeDocument` re-attaches/updates it and writes atomically. A pure shared codec (`src/shared/project/envelope.ts`) encodes the envelope as YAML front-matter for text types and as top-level JSON keys for whiteboards. The tested diagram core (SyncEngine, parse/serialize, editors) is untouched.

**Tech Stack:** TypeScript, Electron (main), React + tldraw (renderer), the `yaml` package, vitest (unit), Playwright-for-Electron (e2e).

## Global Constraints

- **Extensions:** diagram = `.sold`, whiteboard = `.solw`, markdown = `.solm`. Exact values.
- **Envelope fields (every type):** `solar` (integer, current = `1`), `type`, `id` (`globalThis.crypto.randomUUID()`), `title`, `created` (ISO 8601), `modified` (ISO 8601).
- **Encoding:** `.sold`/`.solm` → YAML front-matter (`---` fenced) + raw body; `.solw` → envelope fields as top-level JSON keys beside `snapshot`/`backdropDiagram`.
- **IPC signatures stay string-typed** — `readDocument(dir, file): Promise<string>` returns the **body**; `writeDocument(dir, file, body): Promise<void>` takes the **body**. The envelope is never exposed to the renderer.
- **`modified` bumps only when the body content changed** vs. what is on disk.
- **`templates.yaml` is out of scope** — unchanged, still classifies as `null`.
- **`*.bak` is not a document** — classifier returns `null`; add `*.bak` to the project `.gitignore`.
- **Two TS projects:** a `src/shared` change must typecheck under both `tsconfig.node.json` and `tsconfig.web.json`; `npm run typecheck` runs both.
- **`src/main` unit tests must not import `electron`** and run in the vitest `node` env.
- **Purity:** `src/shared` stays framework-free; envelope timestamp values are passed in by callers (`now: string`), never read from the clock inside shared code.

---

## File Structure

- **Create** `src/shared/project/envelope.ts` — `DocumentEnvelope` type; `createEnvelope`; front-matter split/join (text); JSON envelope read/attach/strip (whiteboard). Pure.
- **Create** `src/shared/project/envelope.test.ts` — codec unit tests.
- **Modify** `src/shared/project/documentType.ts` — new extension map, `documentTypeForFile` for new exts, `.bak`→null, `legacyDocumentTypeForFile`.
- **Modify** `src/shared/project/documentType.test.ts` — new-ext + legacy + `.bak` cases.
- **Modify** `src/shared/project/types.ts` — `DocumentEntry.title?: string`.
- **Modify** `src/main/projectManager.ts` — `atomicWrite` + `.bak`; envelope-aware `readDocument`/`writeDocument`/`createDocument`; `migrateProject`; `ensureGitignore`; `listDocuments` surfaces `title`.
- **Modify** `src/main/projectManager.test.ts` — atomic write, `.bak`, envelope round-trip, `modified` bump, migration, `title`.
- **Modify** `src/main/ipcHandlers.ts` — run `migrateProject(dir)` on project open.
- **Modify** `src/renderer/src/project/ProjectSidebar.tsx` — show `entry.title` with fileName fallback.
- **Modify** e2e specs + fixtures — new extensions; add a legacy sample project + migration spec.

No renderer hooks (`useProject`), `WhiteboardView`, `MarkdownView`, `parse.ts`, `serialize.ts`, `whiteboardFile.ts`, or `preload/index.ts` changes are required — they already deal in body text and tolerate extra JSON keys.

---

## Task 1: New extension family + legacy classifier

**Files:**
- Modify: `src/shared/project/documentType.ts`
- Test: `src/shared/project/documentType.test.ts`

**Interfaces:**
- Produces: `documentExtension(type)` now returns `.sold`/`.solw`/`.solm`; `documentTypeForFile(fileName)` maps new exts → type, everything else (old exts, `.bak`, `templates.yaml`) → `null`; new `legacyDocumentTypeForFile(fileName): DocumentType | null` maps `.yaml`/`.yml` (not `templates.yaml`) → `diagram`, `.whiteboard.json` → `whiteboard`, `.md` → `markdown`, else `null`.

- [ ] **Step 1: Write failing tests**

Add to `src/shared/project/documentType.test.ts`:

```ts
import { documentTypeForFile, documentExtension, legacyDocumentTypeForFile } from './documentType';

it('classifies the new dedicated extensions', () => {
  expect(documentTypeForFile('payments.sold')).toBe('diagram');
  expect(documentTypeForFile('sketch.solw')).toBe('whiteboard');
  expect(documentTypeForFile('notes.solm')).toBe('markdown');
});

it('no longer treats generic or backup files as documents', () => {
  expect(documentTypeForFile('payments.yaml')).toBeNull();
  expect(documentTypeForFile('sketch.whiteboard.json')).toBeNull();
  expect(documentTypeForFile('notes.md')).toBeNull();
  expect(documentTypeForFile('payments.sold.bak')).toBeNull();
  expect(documentTypeForFile('templates.yaml')).toBeNull();
});

it('emits the new extensions when creating documents', () => {
  expect(documentExtension('diagram')).toBe('.sold');
  expect(documentExtension('whiteboard')).toBe('.solw');
  expect(documentExtension('markdown')).toBe('.solm');
});

it('legacyDocumentTypeForFile recognizes the pre-migration shapes', () => {
  expect(legacyDocumentTypeForFile('payments.yaml')).toBe('diagram');
  expect(legacyDocumentTypeForFile('payments.yml')).toBe('diagram');
  expect(legacyDocumentTypeForFile('sketch.whiteboard.json')).toBe('whiteboard');
  expect(legacyDocumentTypeForFile('notes.md')).toBe('markdown');
  expect(legacyDocumentTypeForFile('templates.yaml')).toBeNull();
  expect(legacyDocumentTypeForFile('payments.sold')).toBeNull();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/shared/project/documentType.test.ts`
Expected: FAIL (`legacyDocumentTypeForFile` is not exported; new-ext assertions fail).

- [ ] **Step 3: Implement**

In `src/shared/project/documentType.ts` replace `EXTENSION_BY_TYPE` and `documentTypeForFile`, and add the legacy classifier:

```ts
const EXTENSION_BY_TYPE: Record<DocumentType, string> = {
  diagram: '.sold',
  whiteboard: '.solw',
  markdown: '.solm',
};

/**
 * Classify a file name into a document type, or null if it is not a document.
 * Backups (*.bak), templates.yaml, and legacy pre-migration files all return
 * null here — legacy files are handled only by the migration pass.
 */
export function documentTypeForFile(fileName: string): DocumentType | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.bak')) return null;
  if (lower.endsWith('.sold')) return 'diagram';
  if (lower.endsWith('.solw')) return 'whiteboard';
  if (lower.endsWith('.solm')) return 'markdown';
  return null;
}

/**
 * Classify a legacy (pre-migration) file. Used ONLY by the one-time migration,
 * never by the live app. templates.yaml is a resource, not a document.
 */
export function legacyDocumentTypeForFile(fileName: string): DocumentType | null {
  const lower = fileName.toLowerCase();
  if (lower === TEMPLATES_FILE) return null;
  if (lower.endsWith('.whiteboard.json')) return 'whiteboard';
  if (lower.endsWith('.md')) return 'markdown';
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'diagram';
  return null;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/shared/project/documentType.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/project/documentType.ts src/shared/project/documentType.test.ts
git commit -m "feat: dedicated .sold/.solw/.solm extensions + legacy classifier"
```

---

## Task 2: Envelope codec (`src/shared/project/envelope.ts`)

**Files:**
- Create: `src/shared/project/envelope.ts`
- Test: `src/shared/project/envelope.test.ts`

**Interfaces:**
- Consumes: `DocumentType` from `./documentType`; `parse`/`stringify` from `yaml`.
- Produces:
  - `interface DocumentEnvelope { solar: number; type: DocumentType; id: string; title: string; created: string; modified: string }`
  - `SOLAR_VERSION = 1`
  - `createEnvelope(type: DocumentType, title: string, now: string): DocumentEnvelope`
  - `splitFrontMatter(raw: string): { envelope: Partial<DocumentEnvelope> | null; body: string }`
  - `joinFrontMatter(envelope: DocumentEnvelope, body: string): string`
  - `readJsonEnvelope(raw: string): Partial<DocumentEnvelope> | null`
  - `attachJsonEnvelope(bodyJson: string, envelope: DocumentEnvelope): string`
  - `stripJsonEnvelope(raw: string): string`

- [ ] **Step 1: Write failing tests**

Create `src/shared/project/envelope.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  createEnvelope,
  splitFrontMatter,
  joinFrontMatter,
  readJsonEnvelope,
  attachJsonEnvelope,
  stripJsonEnvelope,
  SOLAR_VERSION,
} from './envelope';

const NOW = '2026-07-17T09:00:00.000Z';

describe('front-matter (text types)', () => {
  it('round-trips envelope + body', () => {
    const env = createEnvelope('diagram', 'Payments', NOW);
    const body = 'nodes: []\nedges: []\n';
    const raw = joinFrontMatter(env, body);
    expect(raw.startsWith('---\n')).toBe(true);
    const out = splitFrontMatter(raw);
    expect(out.body).toBe(body);
    expect(out.envelope).toMatchObject({ solar: SOLAR_VERSION, type: 'diagram', title: 'Payments', created: NOW });
  });

  it('treats a file with no front-matter as pure body', () => {
    const out = splitFrontMatter('nodes: []\n');
    expect(out.envelope).toBeNull();
    expect(out.body).toBe('nodes: []\n');
  });

  it('tolerates a malformed front-matter block (envelope null, body preserved)', () => {
    const raw = '---\n: : bad yaml :\n---\nnodes: []\n';
    const out = splitFrontMatter(raw);
    expect(out.envelope).toBeNull();
    expect(out.body).toBe('nodes: []\n');
  });
});

describe('json envelope (whiteboard)', () => {
  it('attaches, reads, and strips envelope keys', () => {
    const env = createEnvelope('whiteboard', 'Sketch', NOW);
    const body = JSON.stringify({ version: 1, snapshot: null, backdropDiagram: null });
    const raw = attachJsonEnvelope(body, env);
    expect(readJsonEnvelope(raw)).toMatchObject({ type: 'whiteboard', title: 'Sketch', created: NOW });
    expect(JSON.parse(stripJsonEnvelope(raw))).toEqual({ version: 1, snapshot: null, backdropDiagram: null });
  });

  it('returns null envelope for non-JSON or envelope-less JSON', () => {
    expect(readJsonEnvelope('not json')).toBeNull();
    expect(readJsonEnvelope('{"version":1}')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/shared/project/envelope.test.ts`
Expected: FAIL (module does not exist).

- [ ] **Step 3: Implement**

Create `src/shared/project/envelope.ts`:

```ts
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { DocumentType } from './documentType';

export const SOLAR_VERSION = 1;

/** Self-describing metadata carried by every document file. */
export interface DocumentEnvelope {
  solar: number;
  type: DocumentType;
  id: string;
  title: string;
  created: string;
  modified: string;
}

const ENVELOPE_KEYS: (keyof DocumentEnvelope)[] = ['solar', 'type', 'id', 'title', 'created', 'modified'];

/** A fresh envelope; `created` and `modified` both start at `now`. */
export function createEnvelope(type: DocumentType, title: string, now: string): DocumentEnvelope {
  return { solar: SOLAR_VERSION, type, id: globalThis.crypto.randomUUID(), title, created: now, modified: now };
}

const FRONT_MATTER = /^---\n([\s\S]*?)\n---\n?/;

/** Split a text document into its (partial) envelope and body. No front-matter → envelope null. */
export function splitFrontMatter(raw: string): { envelope: Partial<DocumentEnvelope> | null; body: string } {
  const m = raw.match(FRONT_MATTER);
  if (!m) return { envelope: null, body: raw };
  const body = raw.slice(m[0].length);
  try {
    const parsed = parseYaml(m[1]);
    if (!parsed || typeof parsed !== 'object') return { envelope: null, body };
    return { envelope: parsed as Partial<DocumentEnvelope>, body };
  } catch {
    return { envelope: null, body };
  }
}

/** Serialize `---` front-matter + body for text types (.sold/.solm). */
export function joinFrontMatter(envelope: DocumentEnvelope, body: string): string {
  return `---\n${stringifyYaml(envelope)}---\n${body}`;
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Read envelope keys from a whiteboard JSON file, or null if absent/invalid. */
export function readJsonEnvelope(raw: string): Partial<DocumentEnvelope> | null {
  const obj = parseJsonObject(raw);
  if (!obj || obj.solar === undefined) return null;
  const env: Partial<DocumentEnvelope> = {};
  for (const k of ENVELOPE_KEYS) if (k in obj) (env as Record<string, unknown>)[k] = obj[k];
  return env;
}

/** Merge envelope keys into a whiteboard JSON body (envelope first, content after). */
export function attachJsonEnvelope(bodyJson: string, envelope: DocumentEnvelope): string {
  const body = parseJsonObject(bodyJson) ?? {};
  for (const k of ENVELOPE_KEYS) delete (body as Record<string, unknown>)[k];
  return JSON.stringify({ ...envelope, ...body });
}

/** Remove envelope keys from a whiteboard JSON file, returning the canonical body JSON. */
export function stripJsonEnvelope(raw: string): string {
  const obj = parseJsonObject(raw) ?? {};
  for (const k of ENVELOPE_KEYS) delete (obj as Record<string, unknown>)[k];
  return JSON.stringify(obj);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/shared/project/envelope.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck both projects**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/shared/project/envelope.ts src/shared/project/envelope.test.ts
git commit -m "feat: document envelope codec (front-matter + json)"
```

---

## Task 3: Atomic write + `.bak` backup in projectManager

**Files:**
- Modify: `src/main/projectManager.ts`
- Test: `src/main/projectManager.test.ts`

**Interfaces:**
- Produces: `atomicWrite(filePath: string, text: string): Promise<void>` — writes to a sibling temp file, fsyncs, renames over the target; if the target already exists, copies its prior contents to `<filePath>.bak` first.

- [ ] **Step 1: Write failing tests**

Add to `src/main/projectManager.test.ts` (follow the file's existing tmp-dir setup pattern):

```ts
import { atomicWrite } from './projectManager';
import { readFile, writeFile, mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

it('atomicWrite writes a new file and leaves no temp files behind', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'aw-'));
  const f = path.join(dir, 'a.sold');
  await atomicWrite(f, 'hello');
  expect(await readFile(f, 'utf-8')).toBe('hello');
  expect((await readdir(dir)).filter((n) => n.includes('.tmp'))).toHaveLength(0);
});

it('atomicWrite backs up the previous contents to .bak on overwrite', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'aw-'));
  const f = path.join(dir, 'a.sold');
  await writeFile(f, 'v1', 'utf-8');
  await atomicWrite(f, 'v2');
  expect(await readFile(f, 'utf-8')).toBe('v2');
  expect(await readFile(f + '.bak', 'utf-8')).toBe('v1');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/main/projectManager.test.ts`
Expected: FAIL (`atomicWrite` not exported).

- [ ] **Step 3: Implement**

In `src/main/projectManager.ts` add imports and the helper (place near the top, after existing imports):

```ts
import { readFile, writeFile, readdir, access, rename, copyFile, open } from 'node:fs/promises';

/**
 * Durable write: serialize to a sibling temp file, fsync it, then atomically
 * rename over the target. Before overwriting an existing file, copy its prior
 * contents to `<path>.bak` (a one-deep undo, independent of git).
 */
export async function atomicWrite(filePath: string, text: string): Promise<void> {
  if (await fileExists(filePath)) {
    await copyFile(filePath, `${filePath}.bak`);
  }
  const tmp = `${filePath}.${process.pid}.tmp`;
  const fh = await open(tmp, 'w');
  try {
    await fh.writeFile(text, 'utf-8');
    await fh.sync();
  } finally {
    await fh.close();
  }
  await rename(tmp, filePath);
}
```

(Note: `fileExists` already exists in this file; keep the existing single `readFile`/`writeFile` import line consolidated with the new names — do not duplicate the import.)

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/main/projectManager.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/projectManager.ts src/main/projectManager.test.ts
git commit -m "feat: atomic document writes with .bak backup"
```

---

## Task 4: Envelope-aware read / write / create

**Files:**
- Modify: `src/main/projectManager.ts`
- Test: `src/main/projectManager.test.ts`

**Interfaces:**
- Consumes: `atomicWrite` (Task 3); envelope codec (Task 2); `documentTypeForFile` (Task 1).
- Produces (signatures unchanged from today):
  - `readDocument(dir, fileName): Promise<string>` — returns the **body** (envelope stripped).
  - `writeDocument(dir, fileName, body): Promise<void>` — preserves/creates the envelope, bumps `modified` only when the body changed, atomic-writes.
  - `createDocument(dir, type): Promise<string>` — seeds a fresh envelope around the starter body.

- [ ] **Step 1: Write failing tests**

Add to `src/main/projectManager.test.ts`:

```ts
import { readDocument, writeDocument, createDocument } from './projectManager';
import { readEnvelopeForTest } from './projectManager'; // helper added below

it('createDocument writes an enveloped file and readDocument returns only the body', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'doc-'));
  const name = await createDocument(dir, 'diagram');
  expect(name).toBe('untitled.sold');
  const onDisk = await readFile(path.join(dir, name), 'utf-8');
  expect(onDisk.startsWith('---\n')).toBe(true);
  const body = await readDocument(dir, name);
  expect(body.startsWith('---')).toBe(false);
  expect(body).toContain('nodes:');
});

it('writeDocument bumps modified only when the body changes', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'doc-'));
  const name = await createDocument(dir, 'diagram');
  const first = await readEnvelopeForTest(dir, name);
  await writeDocument(dir, name, await readDocument(dir, name)); // no-op save
  const same = await readEnvelopeForTest(dir, name);
  expect(same.modified).toBe(first.modified);
  await writeDocument(dir, name, 'nodes:\n  - id: x\n    type: aws.compute.EC2\n    label: X\n    x: 0\n    y: 0\nedges: []\nclusters: []\n');
  const changed = await readEnvelopeForTest(dir, name);
  expect(changed.modified).not.toBe(first.modified);
  expect(changed.id).toBe(first.id); // identity preserved
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/main/projectManager.test.ts`
Expected: FAIL (`readEnvelopeForTest` not exported; behavior not implemented).

- [ ] **Step 3: Implement**

In `src/main/projectManager.ts`:

1. Add imports:

```ts
import {
  createEnvelope,
  splitFrontMatter,
  joinFrontMatter,
  readJsonEnvelope,
  attachJsonEnvelope,
  stripJsonEnvelope,
  SOLAR_VERSION,
  type DocumentEnvelope,
} from '../shared/project/envelope';
import { documentTypeForFile } from '../shared/project/documentType';
```

2. Add codec dispatch helpers and rewrite read/write/create:

```ts
function isWhiteboardName(fileName: string): boolean {
  return documentTypeForFile(fileName) === 'whiteboard';
}

/** Extract the body (envelope removed) from a raw file's contents. */
function bodyOf(fileName: string, raw: string): string {
  return isWhiteboardName(fileName) ? stripJsonEnvelope(raw) : splitFrontMatter(raw).body;
}

/** Extract a partial envelope from a raw file's contents (null if none). */
function envelopeOf(fileName: string, raw: string): Partial<DocumentEnvelope> | null {
  return isWhiteboardName(fileName) ? readJsonEnvelope(raw) : splitFrontMatter(raw).envelope;
}

/** Wrap a body in a full envelope, encoded per the file's type. */
function wrap(fileName: string, envelope: DocumentEnvelope, body: string): string {
  return isWhiteboardName(fileName) ? attachJsonEnvelope(body, envelope) : joinFrontMatter(envelope, body);
}

/** Fill a (possibly partial/absent) envelope with defaults for a given file. */
function completeEnvelope(
  fileName: string,
  partial: Partial<DocumentEnvelope> | null,
  now: string,
): DocumentEnvelope {
  const type = documentTypeForFile(fileName) ?? 'diagram';
  const base = createEnvelope(type, fileName.replace(/\.[^.]+$/, ''), now);
  return {
    solar: SOLAR_VERSION,
    type,
    id: partial?.id ?? base.id,
    title: partial?.title ?? base.title,
    created: partial?.created ?? now,
    modified: partial?.modified ?? now,
  };
}

/** Read any document's body (envelope stripped). */
export async function readDocument(projectDir: string, fileName: string): Promise<string> {
  const raw = await readFile(resolveInProject(projectDir, fileName), 'utf-8');
  return bodyOf(fileName, raw);
}

/** Write a document's body, preserving/creating its envelope. `modified` bumps
 *  only when the serialized body differs from what is on disk. */
export async function writeDocument(projectDir: string, fileName: string, body: string): Promise<void> {
  const filePath = resolveInProject(projectDir, fileName);
  const now = new Date().toISOString();
  let prior: Partial<DocumentEnvelope> | null = null;
  let priorBody: string | null = null;
  if (await fileExists(filePath)) {
    const raw = await readFile(filePath, 'utf-8');
    prior = envelopeOf(fileName, raw);
    priorBody = bodyOf(fileName, raw);
  }
  const env = completeEnvelope(fileName, prior, now);
  env.modified = priorBody !== null && priorBody === body ? env.modified : now;
  await atomicWrite(filePath, wrap(fileName, env, body));
}

/** Test-only: read a document's completed envelope. */
export async function readEnvelopeForTest(projectDir: string, fileName: string): Promise<DocumentEnvelope> {
  const raw = await readFile(resolveInProject(projectDir, fileName), 'utf-8');
  return completeEnvelope(fileName, envelopeOf(fileName, raw), new Date().toISOString());
}
```

3. Replace the existing `createDocument` body write with the enveloped path (keep the name-disambiguation loop; change only the final write):

```ts
  const now = new Date().toISOString();
  const env = createEnvelope(type, fileName.replace(/\.[^.]+$/, ''), now);
  await atomicWrite(
    resolveInProject(projectDir, fileName),
    wrap(fileName, env, starterContent(type)),
  );
  return fileName;
```

(Delete the old `await writeDocument(projectDir, fileName, starterContent(type));` line — `starterContent` returns the body only, unchanged.)

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/main/projectManager.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/main/projectManager.ts src/main/projectManager.test.ts
git commit -m "feat: envelope-aware readDocument/writeDocument/createDocument"
```

---

## Task 5: One-time migration (`migrateProject`) + `.gitignore`

**Files:**
- Modify: `src/main/projectManager.ts`
- Test: `src/main/projectManager.test.ts`

**Interfaces:**
- Consumes: `legacyDocumentTypeForFile` (Task 1); envelope wrap (Task 4); `atomicWrite` (Task 3).
- Produces:
  - `migrateProject(projectDir: string): Promise<void>` — converts every legacy file to the new format, removes the legacy file, rewrites whiteboard `backdropDiagram` references, never clobbers an existing new-format file, and is idempotent.
  - `ensureGitignore(projectDir: string, pattern: string): Promise<void>` — creates/appends the pattern to the project `.gitignore` if absent.

- [ ] **Step 1: Write failing tests**

Add to `src/main/projectManager.test.ts`:

```ts
import { migrateProject } from './projectManager';
import { stat } from 'node:fs/promises';

async function exists(p: string) { try { await stat(p); return true; } catch { return false; } }

it('migrates legacy files to the new format and removes the originals', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'mig-'));
  await writeFile(path.join(dir, 'payments.yaml'), 'nodes: []\nedges: []\nclusters: []\n', 'utf-8');
  await writeFile(path.join(dir, 'notes.md'), '# Hi\n', 'utf-8');
  await writeFile(
    path.join(dir, 'sketch.whiteboard.json'),
    JSON.stringify({ version: 1, snapshot: null, backdropDiagram: 'payments.yaml' }),
    'utf-8',
  );
  await migrateProject(dir);

  expect(await exists(path.join(dir, 'payments.yaml'))).toBe(false);
  expect(await exists(path.join(dir, 'payments.sold'))).toBe(true);
  expect(await exists(path.join(dir, 'notes.solm'))).toBe(true);
  expect(await exists(path.join(dir, 'sketch.solw'))).toBe(true);
  // backdrop reference rewritten to the new name:
  const wb = await readFile(path.join(dir, 'sketch.solw'), 'utf-8');
  expect(JSON.parse(wb).backdropDiagram).toBe('payments.sold');
  // envelope present on a migrated text file:
  expect((await readFile(path.join(dir, 'payments.sold'), 'utf-8')).startsWith('---\n')).toBe(true);
});

it('never clobbers an existing new-format file and is idempotent', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'mig-'));
  await writeFile(path.join(dir, 'payments.yaml'), 'nodes: []\nedges: []\nclusters: []\n', 'utf-8');
  await writeFile(path.join(dir, 'payments.sold'), '---\nsolar: 1\n---\nnodes: []\n', 'utf-8');
  await migrateProject(dir);
  expect(await exists(path.join(dir, 'payments.yaml'))).toBe(true); // left untouched
  await migrateProject(dir); // second run is a no-op, does not throw
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/main/projectManager.test.ts`
Expected: FAIL (`migrateProject` not exported).

- [ ] **Step 3: Implement**

In `src/main/projectManager.ts` add:

```ts
import { legacyDocumentTypeForFile } from '../shared/project/documentType';
import { unlink } from 'node:fs/promises';

function newNameForLegacy(fileName: string, type: DocumentType): string {
  // Strip the legacy extension (handles the double .whiteboard.json) then add the new one.
  const base = fileName.replace(/\.whiteboard\.json$/i, '').replace(/\.(ya?ml|md)$/i, '');
  return `${base}${documentExtension(type)}`;
}

/** Ensure a project .gitignore contains `pattern` (create/append if missing). */
export async function ensureGitignore(projectDir: string, pattern: string): Promise<void> {
  const gi = path.join(projectDir, '.gitignore');
  let current = '';
  try {
    current = await readFile(gi, 'utf-8');
  } catch {
    /* no .gitignore yet */
  }
  if (current.split('\n').some((line) => line.trim() === pattern)) return;
  const next = current && !current.endsWith('\n') ? `${current}\n${pattern}\n` : `${current}${pattern}\n`;
  await writeFile(gi, next, 'utf-8');
}

/**
 * One-time, idempotent migration of a project's legacy files to the new
 * .sold/.solw/.solm envelope format. Renames + wraps each legacy file, rewrites
 * whiteboard backdrop references, and never overwrites an existing new file.
 */
export async function migrateProject(projectDir: string): Promise<void> {
  const names = await readdir(projectDir);
  // old legacy name -> new name, for rewriting cross-references.
  const renames = new Map<string, string>();
  for (const fileName of names) {
    const type = legacyDocumentTypeForFile(fileName);
    if (type) renames.set(fileName, newNameForLegacy(fileName, type));
  }
  if (renames.size === 0) return;

  const now = new Date().toISOString();
  for (const [oldName, newName] of renames) {
    const type = legacyDocumentTypeForFile(oldName)!;
    const newPath = resolveInProject(projectDir, newName);
    if (await fileExists(newPath)) continue; // never clobber

    try {
      let body = await readFile(resolveInProject(projectDir, oldName), 'utf-8');
      if (type === 'whiteboard') {
        // Rewrite a backdrop reference that points at a legacy diagram name.
        const obj = JSON.parse(body) as { backdropDiagram?: string };
        if (obj.backdropDiagram && renames.has(obj.backdropDiagram)) {
          obj.backdropDiagram = renames.get(obj.backdropDiagram)!;
          body = JSON.stringify(obj);
        }
        body = stripJsonEnvelope(body); // normalize (no-op if no envelope keys)
      }
      const env = createEnvelope(type, newName.replace(/\.[^.]+$/, ''), now);
      await atomicWrite(newPath, wrap(newName, env, body));
      await unlink(resolveInProject(projectDir, oldName));
    } catch {
      // Skip a single bad legacy file; never block the whole project from opening.
    }
  }
  await ensureGitignore(projectDir, '*.bak');
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/main/projectManager.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/main/projectManager.ts src/main/projectManager.test.ts
git commit -m "feat: one-time legacy->envelope migration + .bak gitignore"
```

---

## Task 6: Surface envelope `title` in the document list

**Files:**
- Modify: `src/shared/project/types.ts`
- Modify: `src/main/projectManager.ts`
- Modify: `src/main/projectManager.test.ts`
- Modify: `src/renderer/src/project/ProjectSidebar.tsx`

**Interfaces:**
- Consumes: `envelopeOf` (Task 4).
- Produces: `DocumentEntry.title?: string`; `listDocuments` populates `title` from each file's envelope.

- [ ] **Step 1: Write failing test**

Add to `src/main/projectManager.test.ts`:

```ts
import { listDocuments } from './projectManager';

it('listDocuments surfaces the envelope title', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'list-'));
  await createDocument(dir, 'diagram'); // untitled.sold, title "untitled"
  const entries = await listDocuments(dir);
  const sold = entries.find((e) => e.fileName === 'untitled.sold');
  expect(sold?.title).toBe('untitled');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/main/projectManager.test.ts`
Expected: FAIL (`title` undefined).

- [ ] **Step 3: Implement**

In `src/shared/project/types.ts` add to `DocumentEntry`:

```ts
  /** Human title from the document envelope (falls back to fileName in the UI). */
  title?: string;
```

In `src/main/projectManager.ts` `listDocuments`, after computing `type` for each recognized file, read the file and derive the title (reuse the existing read where diagrams already read text; for whiteboard/markdown add a lightweight read):

```ts
    const raw = await readFile(path.join(projectDir, fileName), 'utf-8').catch(() => '');
    const title = envelopeOf(fileName, raw)?.title;
    if (type !== 'diagram') {
      entries.push({ fileName, type, status: 'ok', title });
      continue;
    }
    const result = parseDiagram(bodyOf(fileName, raw));
    entries.push(
      result.ok
        ? { fileName, type, status: 'ok', title }
        : { fileName, type, status: 'error', errorMessage: result.error.message, title },
    );
```

(The diagram branch now validates `bodyOf(...)` — the body without the envelope — not the raw text.)

In `src/renderer/src/project/ProjectSidebar.tsx`, render `e.title ?? e.fileName` as the visible label (keep `title={e.errorMessage}` tooltip and the `fileName` as the click key).

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/main/projectManager.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/shared/project/types.ts src/main/projectManager.ts src/main/projectManager.test.ts src/renderer/src/project/ProjectSidebar.tsx
git commit -m "feat: show document titles from the envelope in the sidebar"
```

---

## Task 7: Run migration on project open

**Files:**
- Modify: `src/main/ipcHandlers.ts`

**Interfaces:**
- Consumes: `migrateProject` (Task 5).

- [ ] **Step 1: Implement**

In `src/main/ipcHandlers.ts` import `migrateProject` alongside the other `projectManager` imports, then call it right after a project directory is resolved in both handlers, before returning:

```ts
// project:openFolder — after `if (!status.isRepo) await gitInit(dir);`
await migrateProject(dir);
return dir;
```

```ts
// project:newProject — after `if (!status.isRepo) await gitInit(dir);`
await migrateProject(dir);
return { dir };
```

- [ ] **Step 2: Verify it builds + unit suite still green**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; all unit tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/main/ipcHandlers.ts
git commit -m "feat: auto-migrate a project's legacy documents on open"
```

---

## Task 8: Update e2e specs + fixtures; add migration e2e

**Files:**
- Modify: `tests/e2e/*.spec.ts` + `tests/e2e/helpers.ts` (every hardcoded `.yaml`/`.md`/`.whiteboard.json`)
- Create: `tests/e2e/migration.spec.ts`
- Create: legacy sample fixture (inline in the spec via the filesystem, or under `tests/e2e/fixtures/`)

**Interfaces:**
- Consumes: the full app built from all prior tasks.

- [ ] **Step 1: Find every hardcoded legacy extension in e2e**

Run: `grep -rnE "\.yaml|\.yml|\.md['\"\`]|whiteboard\.json" tests/e2e`
Update each created/opened document name to its new extension (`.sold`/`.solw`/`.solm`). Diagram YAML *content* typed into the editor is unchanged — only file names change. Persistence/document-types/whiteboard/markdown/yaml-edit specs are the likely hits.

- [ ] **Step 2: Write the migration e2e**

Create `tests/e2e/migration.spec.ts`: launch with a `--user-data-dir`, create a temp project dir seeded with a legacy `payments.yaml`, `notes.md`, and `sketch.whiteboard.json` (with `backdropDiagram: "payments.yaml"`), open it in the app, then assert the sidebar lists `payments`, `notes`, `sketch`, that opening each shows the right editor, and that the project dir now contains `.sold`/`.solm`/`.solw` and no legacy files. (Model the launch/open flow on `tests/e2e/document-types.spec.ts`.)

- [ ] **Step 3: Build and run the full e2e suite**

Run: `npm run test:e2e`
Expected: all specs pass (including `migration.spec.ts`). Fix any spec that still references a legacy name.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e
git commit -m "test(e2e): new document extensions + legacy migration coverage"
```

---

## Task 9: Full verification + docs

**Files:**
- Modify: `CLAUDE.md` (document-model section), add a short ADR follow-up under `docs/adr/`.

- [ ] **Step 1: Full gate**

Run: `npm run typecheck && npm test && npm run build`
Expected: all clean.

- [ ] **Step 2: Update CLAUDE.md**

Update the "Document model" + `documentType.ts` descriptions to the new extensions and the envelope/migration model.

- [ ] **Step 3: Add ADR 0002**

Create `docs/adr/0002-dedicated-document-extensions-and-envelope.md` recording the new extension family, the envelope, atomic-save/`.bak`, and auto-migration; note it refines ADR 0001's extension choices.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/adr/0002-dedicated-document-extensions-and-envelope.md
git commit -m "docs: record dedicated extensions + envelope (ADR 0002)"
```

---

## Self-Review

**Spec coverage:**
- New extensions → Task 1. Envelope fields + encoding → Task 2. Atomic save + `.bak` → Task 3. `modified`-on-change + envelope-aware read/write/create → Task 4. Migration (rename, wrap, no-clobber, backdrop rewrite, idempotent, skip-bad) → Task 5. `.gitignore *.bak` → Task 5. Title in sidebar (optional) → Task 6. Migration-on-open → Task 7. Testing (unit throughout; e2e + fixtures) → Task 8. Error handling (tolerant envelope defaults, skip bad file, freeze-on-error untouched) → Tasks 2/4/5. Docs/ADR → Task 9.
- Deviation from spec, intentional: `readDocument`/`writeDocument` stay string-typed (body in/out) rather than returning `{envelope, body}`; the renderer never needs the envelope (YAGNI), so this preserves the spec's "envelope at the boundary" principle with far less churn. `whiteboardFile.ts` needs no change because `parseWhiteboardFile` already ignores extra JSON keys.

**Placeholder scan:** none — every code step is concrete.

**Type consistency:** `DocumentEnvelope`, `createEnvelope`, `splitFrontMatter`/`joinFrontMatter`, `readJsonEnvelope`/`attachJsonEnvelope`/`stripJsonEnvelope`, `atomicWrite`, `bodyOf`/`envelopeOf`/`wrap`/`completeEnvelope`, `migrateProject`, `ensureGitignore`, `legacyDocumentTypeForFile`, `documentExtension`, `DocumentEntry.title` are used consistently across tasks.
