# Solarchitect — v1 Design

## Purpose

Solarchitect is a locally-installed desktop tool for solution architects to build system-design/architecture diagrams primarily by direct manipulation (drag-and-drop, Miro/Eraser.io-style), with a live, bidirectionally-synced YAML code view as an alternative editing surface. It targets a single-user, git-friendly workflow: diagrams are plain files an architect edits, versions, and reviews the way they would code.

## v1 Finish Line

A solution architect opens the app, creates a new project, drags AWS/Azure/GCP/Kubernetes nodes onto the canvas from a palette, connects them, groups some into a cluster, adds a sticky-note annotation, switches to the code view and sees matching YAML, tweaks the YAML and sees the canvas update, saves a selection as a reusable template, instantiates that template elsewhere on the canvas, exports the diagram as a PNG and as an SVG, and closes/reopens the project with everything intact.

Python `diagrams`/PlantUML/Mermaid code export is explicitly **out of scope for v1** (see Decisions, #15/#16) — the only export format in v1 is PNG/SVG images.

## Core Decisions

1. **Source of truth**: A custom declarative YAML schema is canonical; the canvas is a live bidirectional view over it — not raw Python `diagrams` code, which is too dynamic (loops/conditionals) to round-trip safely.
2. **Code view**: The "code" panel *is* the YAML directly. No pretend-Python DSL.
3. **Layout**: YAML stores explicit `x, y` per node/cluster/annotation as first-class fields. Auto-layout only computes an initial position for brand-new nodes; it never repositions existing ones.
4. **Platform**: Native desktop app via Electron (Node main process + React renderer).
5. **Canvas scope**: Hybrid — structured semantic elements (nodes/edges/clusters, round-trip with YAML) plus freeform whiteboard annotations (sticky notes, shapes, text), all stored in YAML.
6. **Collaboration**: Single-user, local-only. No real-time multi-user collaboration; git is the collaboration mechanism.
7. **Project structure**: A project is a folder (workspace) containing multiple diagram YAML files plus one shared templates file — not single flat files with no shared context.
8. **Shared resources**: Limited to reusable component templates (named, instantiable IR subtrees). No cross-diagram embedding/drill-down in v1.
9. **Canvas engine**: Built on tldraw. Structured architecture nodes/clusters are custom tldraw shape types; freeform annotations use tldraw's native shapes. tldraw also supplies undo/redo history and PNG/SVG export.
10. **Icon/node taxonomy**: A curated subset of providers for v1 (AWS, Azure, GCP, Kubernetes, generic/on-prem) — not the full `diagrams`-library catalog, not a custom-built icon set. Expand provider-by-provider post-v1 based on demand.
11. **Live-sync error handling**: On invalid YAML (syntax error, unknown node type, dangling edge reference), the canvas freezes at its last-valid render and an inline error is shown in the code editor. No partial/best-effort rendering of the valid parts.
12. **Templates authoring**: Fully symmetric — visual "save selection as template" and hand-editing the shared template YAML both work, via the same Sync Engine as diagrams.
13. **Undo/redo**: A single in-app undo/redo stack (backed by tldraw's history), covering canvas edits and YAML-originated edits alike. Independent of git.
14. **Export**: PNG/SVG image export via tldraw's built-in export, triggered from the renderer, written to disk by the main process. This is the only export path in v1.
15. **Python `diagrams` export**: Out of scope for v1 (previously considered, explicitly dropped).
16. **PlantUML/Mermaid export**: Not in v1; left open as a possible future extension (unprioritized).

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 Electron App                     │
│  ┌─────────────────────────────────────────────┐ │
│  │           Renderer (React + tldraw)          │ │
│  │  ┌───────────────┐      ┌──────────────────┐ │ │
│  │  │  Canvas view   │◄────►│  YAML code view  │ │ │
│  │  │  (tldraw +     │ sync │  (text editor)   │ │ │
│  │  │  custom shapes)│      │                  │ │ │
│  │  └───────┬───────┘      └────────┬─────────┘ │ │
│  │          └──────────┬───────────┘             │ │
│  │                 In-memory                     │ │
│  │              Diagram Model (IR)                │ │
│  └───────────────────────┬───────────────────────┘ │
│                          │ IPC                      │
│  ┌───────────────────────▼───────────────────────┐ │
│  │              Main process (Node)               │ │
│  │  - Project folder read/write (fs)              │ │
│  │  - YAML file I/O + shared templates file        │ │
│  │  - PNG/SVG export (writes tldraw-rendered image)│ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

Three layers: the canvas view (tldraw), the Diagram Model / IR (the single in-memory source both views read/write through — never talk to each other directly), and the main process (owns all filesystem access and image export, since the renderer shouldn't touch disk directly).

## Components

- **Diagram Model (IR)** — in-memory tree: `nodes[]` (id, type e.g. `aws.compute.EC2`, label, x/y, clusterId), `edges[]` (from, to, direction, label), `clusters[]` (id, label, x/y, width/height), `annotations[]` (id, kind, x/y, width/height, content). Cluster membership lives on the node (each node's optional `clusterId`), not as a member-id list on the cluster — single source of truth, no bidirectional-consistency risk.
- **YAML Serializer/Parser** — pure functions, `IR → YAML` and `YAML → IR | ParseError`. No side effects; independently unit-testable.
- **tldraw Shape Adapters** — custom shape types for nodes/clusters (annotations use tldraw's native shapes), plus `IR → shape records` and `shape change → IR patch` mappers.
- **Sync Engine** — coordinates both directions: canvas edit → IR patch → re-serialize → update code editor; YAML edit (debounced) → parse → on success, diff and patch tldraw shapes; on failure, leave IR/canvas untouched and surface the error inline.
- **Template System** — same Serializer/Parser/Sync Engine, pointed at the project's shared template file; "save as template" extracts a selection's IR subtree.
- **Project/File Manager** (main process) — project folder open/create, diagram YAML read/write, template file read/write, via Node `fs`, exposed over IPC.
- **Export Service** (main process) — tldraw's built-in PNG/SVG export, written to disk.
- **Undo/Redo Manager** — tldraw's history stack, extended so YAML-originated edits are also recorded as discrete undoable steps.

## Data Flow

**Canvas → Code:** shape change → Shape Adapter → IR patch → Sync Engine applies → Serializer regenerates YAML → code editor updates → Undo/Redo records step.

**Code → Canvas:** keystroke (debounced ~300ms) → Parser attempts `YAML → IR` → on success: diff against current IR, apply minimal shape add/update/remove to tldraw, record undo step; on failure: IR/canvas untouched, inline error shown, nothing propagates.

**Template instantiation:** drop template → read its IR subtree → reassign ids → offset position to drop point → merge into current IR via the same patch mechanism as any canvas edit.

**Export (PNG/SVG):** one-shot, does not touch IR/YAML — current tldraw canvas state → tldraw export API → main process writes file.

## Error Handling

- Invalid YAML (syntax, unknown node type, dangling edge reference): validation error, last-valid canvas/IR preserved, no silent fallback or partial rendering.
- File I/O failures (permissions, disk full, corrupt/missing file on project open): surfaced as dismissible error dialog/toast; a single bad diagram file shows as an errored entry in the project's list rather than blocking the whole project from opening; the app never crashes silently.
- Template name conflicts: prompt to rename or overwrite; no silent overwrite.
- Export failures: error toast; doesn't affect in-app diagram state since export is read-only-from-canvas.

General principle: fail loud and local, never silently drop or mutate user data, never crash the whole app over one bad file.

## Testing Strategy

- **Serializer/Parser**: unit tests for round-trip fidelity (`IR → YAML → IR` identity) and invalid-input cases (bad node types, dangling edges, malformed syntax) asserting correct validation errors.
- **Sync Engine**: integration tests feeding IR patches and YAML edits through it, asserting resulting IR, minimal shape-diff output, and freeze-on-error behavior.
- **Shape Adapters**: tests that IR fixtures produce expected tldraw shape records and vice versa, without a live canvas.
- **Templates**: unit tests for extract-to-template and instantiate-from-template, especially id reassignment and position offsetting.
- **End-to-end**: a small Playwright-for-Electron suite driving the v1 finish-line scenario (create project → drag nodes → connect → cluster → annotate → edit YAML → save template → instantiate template → export PNG/SVG → reopen project), asserting nothing is lost.

No separate API-contract/multi-service testing is needed — this is a single-user local app with no backend/network layer; the surface area is the IR/Sync Engine (heavily unit-tested) plus a thin E2E layer over the whole app.
