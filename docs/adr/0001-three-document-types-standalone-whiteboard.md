# Three standalone document types; whiteboard is no longer a diagram layer

**Status:** accepted
**Date:** 2026-07-16

## Decision

A project is a folder of **documents**, and a document has exactly one **type**,
chosen at creation from a "New" menu and detected purely by file extension:

- **Diagram** — `.yaml` (structured canvas + YAML, unchanged)
- **Whiteboard** — `.whiteboard.json` (freeform tldraw sketch)
- **Markdown** — `.md` (prose, Preview/Split/Source)

The document's type fixes which editor opens. There is no per-document surface
switch, so the old activity-bar **Diagram | Whiteboard** toggle is removed.

A **Whiteboard is a first-class standalone document**, not a layer of a diagram. It
may optionally store a `backdropDiagram` filename referencing a Diagram in the same
project, rendered read-only beneath the sketch; the reference is stored in the
whiteboard file, the rendered backdrop is not. A missing/dangling reference degrades
to no backdrop, never an error.

## Why

The product needs diagrams, freeform whiteboards, and prose to be equal, separately
creatable artifacts a user versions in git — not one artifact with modes. Making type
an intrinsic, extension-detected property (no manifest/index file) keeps documents as
plain, git-diffable files with no side index to drift or merge-conflict, and makes the
editor a pure function of the opened file.

## Considered and rejected

- **Whiteboard as a layer of a diagram** (the prior approved
  `whiteboard-diagram-separation-design.md`): a whiteboard was a sidecar of a diagram
  with the diagram as a live camera-synced backdrop. Rejected because it forced every
  whiteboard to belong to a diagram and kept both surfaces accessible on one document —
  the exact coupling we wanted gone. This ADR **supersedes** that spec.
- **A project manifest/index file** typing each document: rejected to avoid a second
  source of truth that can drift from disk and complicate git merges.

## Consequences

- One document is open at a time, so a whiteboard's backdrop is rendered from its
  referenced diagram file read at open — **no live cross-document sync**, which retires
  the camera-synced-live-backdrop spike the prior spec flagged as its top risk.
- Existing bare-snapshot `*.whiteboard.json` files migrate to a wrapped
  `{ version, snapshot, backdropDiagram }` format with no backdrop on first touch.
- `listDiagrams` generalizes to `listDocuments` (carrying a type per entry); the
  project list groups by type. Search/Outline become type-aware.
