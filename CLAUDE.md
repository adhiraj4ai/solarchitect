# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Solarchitect is a local-only Electron desktop app for solution architects to build
architecture diagrams by direct manipulation (drag-and-drop, tldraw canvas) with a
live, **bidirectionally-synced YAML code view**. Diagrams are plain files a user
edits, versions in git, and reviews like code. Single-user, offline; git is the
collaboration mechanism. See `docs/superpowers/specs/2026-07-15-solarchitect-design.md`
for the full v1 design and the numbered core decisions it locks in.

## Commands

```bash
npm run dev            # electron-vite dev (HMR renderer + main)
npm run build          # production build into out/
npm run typecheck      # tsc --noEmit for BOTH projects (node + web) — run this, tsc alone won't
npm test               # vitest run (unit tests: src/shared + src/main only)
npm run test:e2e       # builds, then runs Playwright-for-Electron against out/
```

Run a single unit test file / test:
```bash
npx vitest run src/shared/sync/syncEngine.test.ts
npx vitest run -t "freezes on invalid YAML"
```
Run a single E2E spec (build first — Playwright drives the built app in `out/`):
```bash
npm run build && npx playwright test tests/e2e/yaml-edit.spec.ts
```

## Architecture

Three layers, and the golden rule is that **the two views never talk to each other
directly** — both project from one in-memory IR through the Sync Engine.

1. **`src/shared/`** — the pure, framework-free core (no Electron, no React, no DOM).
   This is the primary test seam. Aliased as `@shared` in the renderer and
   electron-vite; imported by relative path from `src/main`.
   - `ir/types.ts` — the `Diagram` IR: `nodes / edges / clusters / frames`
     (+ legacy `annotations`, being removed — see below). Node/cluster positions
     are first-class `x/y` fields. **Cluster membership lives on the node**
     (`node.clusterId`), never as a member list on the cluster — single source of truth.
   - `ir/taxonomy.ts` — `NODE_TAXONOMY`, the curated node-type vocabulary
     (`aws.compute.EC2`, etc). `node.type` must satisfy `isValidNodeType()`. Adding a
     service = one row here plus a glyph in `renderer/src/canvas/icons.tsx`.
   - `yaml/{parse,serialize}.ts` — pure `IR ⇄ YAML`. Round-trip fidelity and
     invalid-input validation are enforced by tests (`roundtrip.test.ts`, etc).
   - `sync/syncEngine.ts` — the coordinator. `applyCanvasPatch` (canvas→YAML) and
     `applyYamlEdit` (YAML→IR). **Freeze-on-error**: invalid YAML leaves the last-valid
     IR/canvas untouched and returns the error; there is no partial/best-effort render.
   - `templates/` — reusable IR-subtree templates, stored in the project's
     `templates.yaml`, round-tripped through the same parser/serializer.

2. **`src/main/`** — Electron main (Node). Owns **all** filesystem + dialogs; the
   renderer never touches disk.
   - `projectManager.ts` — a project is a folder of `.yaml` diagram files plus one
     `templates.yaml`. `resolveInProject()` is the path-traversal trust boundary for
     every fileName arriving over IPC — keep new file ops behind it. A diagram's
     freeform sketch is a sidecar `name.whiteboard.json` next to `name.yaml`.
   - `gitService.ts` — shells out to `git`; `exportService.ts` — writes PNG/SVG bytes
     from the renderer to disk. `ipcHandlers.ts` registers every `project:*` channel.
   - `index.ts` — serves the packaged renderer over a **loopback HTTP server**
     (127.0.0.1), not `file://`: Chromium only decodes tldraw's SVG icon sprite over
     http(s). CSP is strict in prod, loosened in dev for Vite HMR.

3. **`src/renderer/`** — React + tldraw. State is orchestrated by hooks:
   - `hooks/useSyncEngine.ts` — owns the single `SyncEngine` **and** the unified
     undo/redo history (Diagram snapshots, debounced ~300ms so a drag = one entry).
     Canvas edits, YAML edits, and template drops all flow through here so undo is
     unified. Undo/redo is in-app and independent of git.
   - `canvas/` — tldraw integration. Structured nodes/clusters/edges/frames are
     **custom tldraw shape types** (`*ShapeUtil.tsx`); `shapeAdapters.ts` maps
     `IR → shape records` and `shape change → IR patch`. Note: a shape only carries
     some IR fields (id/type/label/position); fields with no shape representation
     (e.g. `clusterId`) must be merged back from the prior IR by the caller.
   - `editor/YamlCodeEditor.tsx` — the code view (the YAML *is* the code panel; no
     pretend-Python DSL). `App.tsx` composes the Visual / Split / Code layout.

### The IPC contract is single-sourced

`SolarchitectApi` in `src/shared/project/types.ts` is the one source of truth for the
bridge. The preload (`src/preload/index.ts`) is typed against it and the renderer's
`window.solarchitect` augmentation references it, so they can't drift. Add a feature
that crosses the boundary = add the method there first, then implement in preload +
`ipcHandlers.ts` + `projectManager.ts`/service.

## Conventions & gotchas

- **TypeScript is split into two projects**: `tsconfig.node.json` (main/preload/shared,
  Node types) and `tsconfig.web.json` (renderer/shared, DOM + React). `npm run typecheck`
  runs both — a change to `src/shared` must typecheck under both.
- **Unit tests must stay pure**: vitest only includes `src/shared` and `src/main` and
  runs in the `node` environment. `src/main` tests must not import `electron`
  (keep Electron-dependent code out of `projectManager.ts` and friends). The renderer/
  canvas is covered by E2E, not unit tests.
- **E2E requires a build**: Playwright drives the real built app in `out/`, so
  `npm run test:e2e` builds first; if running specs directly, build first.
- Positions are explicit in YAML; auto-layout (`ir/layout.ts`) only seeds coordinates
  for brand-new nodes and never repositions existing ones.

## In-flight direction

`docs/superpowers/specs/2026-07-16-whiteboard-diagram-separation-design.md` (approved for
planning) splits each document into two surfaces that never share a canvas: a structured
**Diagram** surface and a freeform **Whiteboard** surface (with the diagram as a
read-only backdrop). This **removes `annotations` from the IR** and migrates existing
annotations into the whiteboard sidecar. Today's code still has the single-canvas
architect/whiteboard `mode` and `annotations` in the IR — treat that as legacy when
touching annotation, mode, or whiteboard code.
