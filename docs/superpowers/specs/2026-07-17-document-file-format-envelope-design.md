# Dedicated Document File Format + Envelope — Design

**Status:** approved
**Date:** 2026-07-17

## Problem Statement

Document types are detected purely by extension (ADR 0001), but the extensions are
generic and clunky:

- `.yaml` / `.yml` — any YAML file in the project folder is treated as a diagram, so a
  stray `docker-compose.yaml` or CI config is mis-typed and shows as an errored
  "diagram" in the sidebar.
- `.whiteboard.json` — a double-extension that is awkward and still collides with the
  generic `.json` space.
- `.md` — fine as a format, but nothing marks it as *ours*.

There is also no self-describing structure on disk (no schema version, no stable id,
no title/metadata that travels with the file) and the save path is a plain
`writeFile`, which can leave a half-written document if the process dies mid-write.

## Decisions (locked in during brainstorming)

1. **Dedicated, unambiguous extension per type** — the type is self-evident from the
   file name and a stray `.yaml`/`.md` is never mis-classified.
2. **Self-describing envelope** — every document carries a consistent metadata header
   (schema version, type, id, title, created, modified).
3. **Robust, durable save** — atomic writes plus a one-deep backup.
4. **Auto-migrate on open** — a one-time pass converts legacy files to the new format.
5. **Full metadata in the file**, accepting some git churn — mitigated by bumping
   `modified` only on real content changes.

## The Format

| Type       | Extension | Body format |
|------------|-----------|-------------|
| Diagram    | `.sold`   | YAML        |
| Whiteboard | `.solw`   | JSON        |
| Markdown   | `.solm`   | Markdown    |

`templates.yaml` is a project **resource**, not a document; it is left unchanged and
out of scope. `*.bak` files are not documents (classifier returns `null`).

### Envelope

Same fields for every type:

| Field      | Type    | Notes                                              |
|------------|---------|----------------------------------------------------|
| `solar`    | integer | Schema version (starts at `1`).                    |
| `type`     | string  | `diagram` \| `whiteboard` \| `markdown`.           |
| `id`       | string  | Stable identity via `crypto.randomUUID()`.         |
| `title`    | string  | Human title; seeded from the base name.            |
| `created`  | string  | ISO 8601, set once at creation/migration.          |
| `modified` | string  | ISO 8601, bumped **only when the body changes**.   |

### Encoding — idiomatic to each base format

The envelope is encoded natively per format so the **body stays hand-editable**:

- **`.sold` and `.solm`** → **YAML front-matter**: a `---`-delimited envelope block on
  top, then the raw body (diagram YAML / markdown) below.
- **`.solw`** → **top-level JSON keys**: envelope fields become siblings of
  `snapshot` / `backdropDiagram` (extends today's wrapped whiteboard format).

```
payments.sold                 sketch.solw                    notes.solm
---                           {                              ---
solar: 1                        "solar": 1,                  solar: 1
type: diagram                   "type": "whiteboard",        type: markdown
id: 7f3c…                       "id": "9a2e…",               id: b81d…
title: Payments                 "title": "Sketch",           title: Notes
created: 2026-07-17T09:00:00Z   "created": "…",              created: 2026-07-17T09:00:00Z
modified: 2026-07-17T09:10:00Z  "modified": "…",            modified: 2026-07-17T09:10:00Z
---                             "snapshot": { … },           ---
nodes:                          "backdropDiagram": "…"       # Notes
  - id: web …                 }                              Prose here…
edges: [ … ]
```

Consistent envelope *fields* everywhere; format-native *encoding*. The diagram body is
still pure YAML you can hand-edit and diff.

## Robust Save Process

Every document write (all three types, plus migration) goes through one hardened path
in `projectManager`, behind `resolveInProject`:

- **Atomic write** — serialize → write a temp file in the same directory → `fsync` →
  `rename()` over the target. Rename is atomic on a single filesystem, so a crash
  mid-save leaves either the old file or the new one, never a truncated document.
- **Single backup** — before the rename overwrites an existing file, copy the current
  contents to a sibling `<name>.bak`: a one-deep undo against a bad save, independent
  of git. `.bak` is excluded from the document list and added to the project's
  `.gitignore`.
- **Quiet `modified`** — `modified` is bumped only when the serialized body differs
  from what is already on disk, so autosave/no-op saves do not churn git.

## Migration (auto, one-time, on project open)

When a project opens, one pass converts legacy files before the sidebar lists them:

- **Detect legacy:** `*.yaml`/`*.yml` (except `templates.yaml`), `*.whiteboard.json`,
  `*.md`, via `legacyDocumentTypeForFile`.
- **Convert each:** read → generate `id`, set `title` from the base name, set
  `created`/`modified` from the file's filesystem mtime → write the new
  `.sold`/`.solw`/`.solm` through the atomic path → remove the legacy file (rename +
  envelope wrap).
- **Safety rails:** everything stays inside `resolveInProject`; if a new-format file
  with the same base already exists, the legacy file is **left untouched** (never
  clobber); git is the backstop for the renames.
- **Reference fix-up:** a whiteboard's `backdropDiagram: "payments.yaml"` is rewritten
  to `"payments.sold"` in the same pass, so backdrops survive the cutover.
- **Idempotent:** once converted there are no legacy files, so it never runs again.

## Architecture & Components

**Guiding principle: the envelope lives only at the file boundary. The app core keeps
working on pure bodies, unchanged.** The diagram `SyncEngine`, `yaml/parse` +
`yaml/serialize`, `YamlCodeEditor`, and `CanvasView` never see the envelope — the YAML
code view stays exactly the pure diagram YAML it is today. This keeps the tested core
untouched and the change low-risk.

- **`src/shared/project/documentType.ts`** — new extension map (`.sold`/`.solw`/`.solm`);
  `documentTypeForFile` matches them; `.bak` → `null`; a separate
  `legacyDocumentTypeForFile` used **only** by migration so the primary classifier
  stays clean.
- **New `src/shared/project/envelope.ts`** (pure, framework-free) —
  `DocumentEnvelope` type; `splitFrontMatter(raw) → { envelope, body }` and
  `joinFrontMatter(envelope, body)` for the text types; envelope parsing/validation and
  schema-version handling. Timestamps are supplied by callers (kept pure). `id` via
  `crypto.randomUUID()` — no new dependency.
- **`src/shared/whiteboard/whiteboardFile.ts`** — extend the wrapped JSON to carry the
  same envelope fields alongside `snapshot` / `backdropDiagram`; continues to absorb the
  legacy on-disk shapes (bare snapshot, `pendingAnnotations` seed, current wrapped).
- **`src/main/projectManager.ts`** — owns durability + timestamps:
  - `atomicWrite` (temp → fsync → rename) + `.bak` backup.
  - Envelope-aware `readDocument → { envelope, body }` and
    `writeDocument(dir, file, body)` — reads the prior envelope, bumps `modified` only
    if the body changed, re-joins, atomic-writes.
  - `createDocument(type)` seeds a fresh envelope; `migrateProject(dir)` runs the
    one-time pass on open.
  - `listDocuments` may surface the envelope `title` (cheap: read only the front-matter
    header) so the sidebar can show titles.
- **IPC contract (`src/shared/project/types.ts`)** — `readDocument` / `writeDocument`
  become envelope-aware (body in/out); the preload bridge and `ipcHandlers.ts` follow
  the single-sourced `SolarchitectApi`.
- **Renderer** — deals only in bodies: the diagram load path parses the returned
  `body`; `WhiteboardView` uses the extended `whiteboardFile` codec; `MarkdownView`'s
  source textarea shows the markdown body (not the envelope). No envelope logic leaks
  into the editors.

## Error Handling

- **Malformed envelope / missing fields** — tolerated: fill defaults (bump `solar` to
  current, regenerate a missing `id`, `title` from base name, timestamps = now) rather
  than erroring, mirroring the whiteboard file's existing tolerance.
- **Diagram body invalid** — unchanged freeze-on-error semantics from the SyncEngine;
  the envelope split never changes that behavior.
- **Migration failure on one file** — log, skip that file, continue the rest; a project
  is never blocked from opening by one bad legacy file.
- **Atomic write failure** — surfaced via the existing `onError` toast; the original
  file (and `.bak`) remain intact.

## Testing

- **`src/shared` unit:** front-matter split/join round-trip; envelope validation +
  schema-version handling; classifier for the new extensions, `.bak` exclusion, and
  legacy detection; `whiteboardFile` envelope round-trip + legacy absorption; the
  diagram body still round-trips through the **unchanged** parser/serializer with an
  envelope attached.
- **`src/main` unit (stay pure — no `electron` import):** atomic write leaves no
  partial file; `.bak` written on overwrite; `modified` bumps only on real change;
  migration converts each legacy type, removes the old file, **no-clobber** when the
  target exists, rewrites `backdropDiagram`, and is idempotent on a second run.
- **E2E:** open a legacy sample fixture → files migrate and each opens in the right
  editor; create each type → correct extension + envelope on disk; edit/save/reopen
  each type → body intact; `.bak` never appears in the sidebar.
- **Fixtures:** add a legacy sample project for the migration E2E; update existing
  specs/fixtures that hardcode `.yaml` / `.md` / `.whiteboard.json` (yaml-edit,
  persistence, document-types, whiteboard, markdown).

## Out of Scope

- **Single-file project bundle/container** (zip-based archive) — explicitly rejected in
  favor of loose files.
- **Id-based cross-document references** — the stable `id` enables rename-proof
  references (e.g. `backdropDiagram` by id), but migration keeps filename references
  (rewritten on rename); switching references to ids is an optional follow-on.
- **Multi-version history / snapshot archiving** — only a one-deep `.bak`; deeper
  history remains git's job.
- **`templates.yaml`** — unchanged; the `solar` version field leaves a path to version
  it later if wanted.

## ADR Note

This supersedes the extension choices in
[ADR 0001](../../adr/0001-three-document-types-standalone-whiteboard.md) (the
`.yaml`/`.whiteboard.json`/`.md` extensions and the "no envelope" implication) while
keeping its core decision that document type is intrinsic and extension-detected with
no project manifest. A follow-up ADR should record the new extension family and
envelope once implemented.
