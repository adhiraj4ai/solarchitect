# Whiteboard / Diagram Separation — Design

**Status:** Approved for planning
**Date:** 2026-07-16

## Problem Statement

Today a document is a single `Diagram` (nodes/edges/clusters/frames/annotations)
in one `.yaml` file, rendered on one tldraw canvas. A `mode` flag
(architect/whiteboard) just changes behavior on that single canvas: architect
shows structured shapes only; whiteboard adds tldraw's freeform tools and shows
annotations. Freeform sketch and the structured diagram therefore live on the
**same canvas and in the same file**, so they intermix — which is exactly what
we want to stop. At the same time, users sometimes want to view/work an
architecture diagram in either a structured way or a freeform way, so the two
can't simply be unrelated.

## Solution

Split each document into two **surfaces that never share a canvas**:

- **Diagram** (renamed from "Architect") — the structured surface: nodes, edges,
  clusters, frames; IR ⇄ YAML. No freeform tools.
- **Whiteboard** — a separate freeform tldraw canvas (pen, arrows, shapes, text,
  images) with the diagram shown beneath it as a live, read-only, toggleable
  backdrop.

A per-document toggle **Diagram | Whiteboard** switches surfaces. "Open an
architecture diagram in either mode" is just flipping that toggle on the same
document — the structured diagram is the single source of truth, and the
whiteboard is a distinct sketch layer over it.

## Terminology

- **Document** — one diagram file `name.yaml` plus an optional whiteboard
  sidecar `name.whiteboard.json`.
- **Diagram surface** — the structured editor (existing `CanvasView`).
- **Whiteboard surface** — the freeform editor (new `WhiteboardView`).
- **Backdrop** — the diagram rendered read-only beneath the whiteboard.
- **Surface toggle** — the top-bar `Diagram | Whiteboard` control (replaces the
  old architect/whiteboard `mode`).

## User Stories

1. As an architect, I want the Diagram surface to hold only structured shapes,
   so freeform scribbles never pollute my architecture.
2. As an architect, I want a separate Whiteboard surface with real freeform
   tools (pen, arrows, shapes, text, images), so I can sketch freely.
3. As an architect, I want the current diagram shown read-only beneath the
   whiteboard, so I can annotate/sketch over the real architecture.
4. As an architect, I want to hide the backdrop, so I can sketch on a blank
   surface when I prefer.
5. As an architect, I want to flip one document between Diagram and Whiteboard,
   so "opening the architecture diagram in either mode" is one click.
6. As an architect, I want my whiteboard sketch saved automatically alongside
   the diagram, so it's retained when I reopen the document.
7. As an architect, I want the diagram `.yaml` to stay clean and human-editable,
   with the sketch kept out of it.
8. As an existing user, I want my current sticky/box/text annotations preserved
   automatically when the app moves to the new model.
9. As an architect, I want the YAML source (Split/Code) to stay tied to the
   diagram, since a freeform whiteboard has no meaningful YAML.

## Architecture & Components

### Surfaces are distinct tldraw editors

- **Diagram surface**: today's `CanvasView`, with the whiteboard/annotation
  branches removed. Retains all diagram features: connect-by-drag, properties
  panel, clusters, frames, present, animate, export, grid.
- **Whiteboard surface**: a new `WhiteboardView` wrapping a plain tldraw editor
  with the full default toolset. Its store holds only the user's freeform
  shapes. Diagram shapes never enter this store; freeform shapes never enter the
  diagram store. This is the separation.

Switching the surface toggle mounts/shows one surface; the other is not on
screen. (Keep both mounted but hidden if remount cost is a problem — decide in
planning; correctness does not depend on it.)

### Backdrop (live, read-only, toggleable) — highest-risk piece

The diagram is rendered to SVG (reuse the existing export-to-SVG path) and
placed on a layer **behind** the whiteboard canvas. It is kept aligned with the
whiteboard by tracking the whiteboard editor's camera (pan/zoom) and applying a
matching transform to the backdrop layer, so page coordinates line up (a stroke
drawn over a node lands over that node). It regenerates when the diagram
changes, is non-interactive, and has a show/hide toggle on the whiteboard
surface.

Because it is a separate DOM/SVG layer (not tldraw shapes in the whiteboard
store), the whiteboard store stays pure. The camera-synced alignment is the
riskiest detail and should get a small spike first; if faithful live alignment
proves impractical, fall back to a snapshot backdrop image fitted to the
diagram's bounds (documented downgrade, not a silent one).

## Data Flow

- **Diagram**: unchanged. IR ⇄ YAML through the existing SyncEngine; saved to
  `name.yaml`.
- **Whiteboard**: the tldraw store snapshot (`getSnapshot`/`loadSnapshot`) is
  the source of truth for the sketch. On change (debounced) it is written to the
  sidecar; on document open it is loaded from the sidecar.
- **Backdrop**: derived, never stored. Generated from the current diagram IR on
  entering the whiteboard and whenever the diagram changes.

## Persistence & the sidecar

- New main-process functions in `projectManager`: `readWhiteboard(dir,
  diagramFileName)` and `writeWhiteboard(dir, diagramFileName, snapshotJson)`,
  resolving the sidecar name as `<base>.whiteboard.json` next to the diagram,
  guarded by the existing path-traversal check. A `deleteWhiteboard` may remove
  an emptied sidecar.
- New IPC handlers + preload bridge methods + `SolarchitectApi` entries for read/
  write (and optional delete).
- **Lazy creation**: the sidecar is written only once the sketch is non-empty; a
  document with no sketch has no sidecar file.
- **Missing sidecar = blank whiteboard**, never an error.
- `listDiagrams` continues to list only `.yaml` diagram files; `*.whiteboard.json`
  is excluded from the diagram list.

## Migration (one-time, automatic)

When a document opens, if its diagram YAML still contains `annotations`:

1. Convert each annotation to the equivalent tldraw shape (reuse the existing
   `annotationToShape` logic: sticky → note, shape → geo rectangle, text → text).
2. Merge those shapes into the whiteboard snapshot and write the sidecar.
3. Re-serialize the diagram YAML without the `annotations` key.

This is idempotent (after migration there is no `annotations` key, so it never
runs again for that file).

## Schema changes

- Remove `annotations` from the `Diagram` IR, the YAML serializer, and the
  parser. The parser should ignore a legacy `annotations` key gracefully (the
  migration handles it) rather than error.
- `Diagram` becomes `nodes`, `edges`, `clusters`, and optional `frames`.
- Remove annotation handling from the diagram reconcile/assemble paths; the
  `annotationAdapters` conversion logic is reused only by the migration and the
  whiteboard seed.

## UI

- Rename the top-bar segmented control from "Architect" to **Diagram**; it now
  reads **Diagram | Whiteboard** and switches surfaces for the open document.
- **Visual / Split / Code** applies only to the Diagram surface (it concerns the
  diagram's YAML). On the Whiteboard surface the view control is hidden; the
  whiteboard is a single full-canvas view with a **backdrop show/hide** toggle.
- The whiteboard surface uses tldraw's native tools; Solarchitect's diagram-only
  chrome (connect ports, properties panel, frame menu) is absent there.

## Error handling

- Invalid/corrupt sidecar JSON → log, treat as blank whiteboard, surface a
  non-blocking toast; never block opening the diagram.
- Diagram YAML errors keep today's freeze-on-error behavior, unaffected by the
  whiteboard.
- Backdrop generation failure → hide the backdrop and continue; the whiteboard
  still works.

## Testing

- **Primary seam** stays the SyncEngine for the diagram (now annotation-free);
  existing tests updated to drop annotations.
- **New unit tests** (`src/main`, `src/shared`): sidecar read/write/round-trip
  and lazy creation; the annotation→whiteboard migration (input YAML with
  annotations → whiteboard shapes + annotation-free YAML).
- **New E2E**: surface toggle switches canvases; a freeform sketch persists to
  the sidecar and reloads on reopen; backdrop shows and toggles; a legacy file
  with annotations migrates on open.
- Existing annotation E2E is replaced by whiteboard-freeform E2E.

## Out of scope

- The VS Code-style left activity bar (separate spec, brainstormed next).
- Multi-page whiteboards, whiteboard templates, real-time collaboration.
- Exporting the whiteboard layer combined with the diagram (diagram export is
  unchanged; whiteboard export, if any, uses tldraw's native export).
- Standalone whiteboard documents with no diagram (a whiteboard is always a
  layer of a document whose diagram may be empty).

## Further notes

- The clean-YAML thesis is preserved: the diagram stays human-readable YAML; the
  inherently-freeform sketch is a machine-owned sidecar, clearly named and
  co-located.
- The camera-synced backdrop is the one genuine unknown; plan a spike before
  committing to it, with the snapshot-image fallback documented.
