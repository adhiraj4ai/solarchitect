# Solarchitect

Local-only desktop app for solution architects to author architecture documents —
structured diagrams, freeform whiteboards, and prose — as plain files versioned in git.

## Language

**Project**:
A folder on disk containing an architect's documents, always under git version
control (initialized automatically when the folder becomes a project).

**Document**:
One authored artifact stored as a file in a project. Every document has exactly
one **document type** that fixes which editing interface opens for it.
_Avoid_: file (a document maps to a file, but "document" is the domain concept), diagram (that's one type)

**Document type**:
The kind of a document — one of **Diagram**, **Whiteboard**, or **Markdown**.
Chosen once at creation (via "New") and determines the editor. Not switchable in
place.

**Diagram**:
A structured architecture document: nodes, edges, clusters, frames, projected from
one IR through the Sync Engine and stored as human-editable YAML.
_Avoid_: architect surface (legacy term for its editor)

**Whiteboard**:
A standalone freeform-sketch document (pen, arrows, shapes, text, images) stored as
a tldraw snapshot. May optionally name a Diagram in the same project to render
beneath it as a **backdrop**.
_Avoid_: annotation layer, sketch layer (it is its own document now, not a layer of a diagram)

**Markdown**:
A prose document (notes, decisions, docs) stored as a `.md` file.

**Backdrop**:
A Diagram rendered read-only beneath a Whiteboard, so the architect can sketch over
real architecture. Derived from the referenced diagram, never stored in the
whiteboard file. The reference (a diagram filename) IS stored in the whiteboard
file; the rendered backdrop is not. Optional and toggleable; a dangling reference
(diagram deleted/renamed) degrades to no backdrop, never an error.

## Resolved decisions (this session)

- **Type by extension**: `.yaml` = Diagram, `.whiteboard.json` = Whiteboard,
  `.md` = Markdown. No manifest/index file. `templates.yaml` is not a document.
- **Interface is fixed by type**: opening a document opens its one editor. There is
  **no** per-document surface switch (the old Diagram|Whiteboard activity-bar toggle
  is removed).
- **"New" is one button → menu** offering the three types.
- Git is auto-initialized when a project folder is created or opened (already true in
  code).
- **Whiteboard is standalone with optional backdrop**: its file stores the sketch
  plus an optional `backdropDiagram` filename referencing a Diagram in the same
  project. Missing/dangling reference ⇒ no backdrop, no error.
- **One document open at a time** (single editor). A whiteboard's backdrop is
  rendered from the referenced diagram file read at open — no live cross-document
  sync, so the old camera-synced-live-backdrop risk does not apply.
- **New project is empty**; the Project panel's empty state points at "New".
- **New documents are auto-named** `untitled.<ext>`, disambiguated on collision. No
  in-app rename yet.
- **Panels by type**: universal = Project, Version control, Settings, Help. Diagram
  adds Search, Outline, Shapes, Templates. Markdown adds Search + Outline (its text
  and headings). Whiteboard = universal only.
- **Markdown editor** is Preview | Split | Source, rendered by a locally-bundled
  markdown renderer (strict CSP — no CDN).
- **Document list** is grouped by type (Diagrams / Whiteboards / Documents), each row
  carrying a type icon; empty sections hidden.
- Existing bare-snapshot whiteboard files migrate to the wrapped format with **no**
  backdrop on first touch.
