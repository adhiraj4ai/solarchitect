# Animated Traversal Export (GIF + WebP) — Design

**Status:** Approved for planning
**Date:** 2026-07-16

## Problem Statement

Solution architects need to *explain* a diagram, not just show it. A static PNG
shows the topology but not the story — how a request enters the system and moves
through it. Today the app has a decorative `animate` toggle that flows a dot
along every edge continuously (SVG `<animateMotion>` gated by an `.animate-on`
ancestor, `EdgeShapeUtil.tsx:143`) and static PNG/SVG export
(`CanvasView.tsx:549`). There is no way to author a *sequence* over the diagram,
and no way to capture motion as a shareable artifact.

The ask: author a staged "request traverses the system" build-up and export it
as an animated **GIF** (and **WebP**) for READMEs, Slack, and slides.

## Solution

**One feature: animated traversal export.** The architect assigns an order over
the diagram (mostly derived from arrow direction, overridable per element); the
app plays a cumulative build-up — elements light up in sequence as the flow
reaches them — and exports that animation as a GIF or WebP. "Arrow direction"
and "object properties" from the original ask become concrete: a per-edge
`direction` field and a `step` field on nodes/edges.

## Terminology

- **Traversal** — the staged animation: flow entering at sources and moving
  outward along arrows, lighting elements as it reaches them.
- **Step / order** — an element's position in the sequence. Equal order = plays
  simultaneously.
- **Cumulative build-up** — elements start dimmed, light to full opacity when
  their step plays, and stay lit; the whole diagram is lit at the end.
- **Traversal preview** — playing the traversal live, in-app (distinct from the
  existing ambient continuous flow, which is retained).
- **Timeline** — the resolved, timed sequence of keyframes derived from the
  order plus the export/preview timing settings.

## User Stories

1. As an architect, I want the flow to enter at my source nodes and move along
   the arrows automatically, so I don't have to number anything for a simple
   diagram.
2. As an architect, I want to override the order on specific elements (a
   `step`), so I can fix the narrative where topology is ambiguous.
3. As an architect, I want a fan-out (load balancer → 3 servers) to light up in
   one beat, so parallelism reads as parallel.
4. As an architect, I want to flip an edge's flow direction (and its arrowhead)
   without re-drawing endpoints, and to mark bidirectional links.
5. As an architect, I want to see step-number badges and scrub the traversal
   in-app, so I can author and verify the sequence before exporting.
6. As an architect, I want to export the traversal as a GIF or WebP, choosing
   what region to capture (selection, whole diagram, or viewport).
7. As an architect, I want the diagram YAML to stay clean — timing lives in the
   export dialog, not on every object.

## Core Decisions (locked in grilling, 2026-07-16)

1. **Scope:** a single feature — animated traversal export. Arrow direction and
   object `step` are knobs serving it.
2. **Animation type:** staged reveal / traversal (not a continuous loop, not a
   frame-by-frame Present replay).
3. **Sequencing:** hybrid with a **unified order value** — an element's order is
   its explicit `step` if set, else its topological depth from the source
   (BFS following arrow direction). Group by order, play ascending.
4. **Step lives on both nodes and edges.**
5. **Reveal style:** cumulative build-up (dim → lit), lit elements persist.
6. **Simultaneity:** equal order value plays together.
7. **Timing:** global, set in the export/preview dialog. No per-object timing.
8. **Capture engine:** deterministic render-per-frame (a pure state function of
   time), not screen-capture of live CSS animation.
9. **Arrow direction:** per-edge `direction: forward | reverse | both`, flips
   flow *and* arrowhead together; `both` = bidirectional.
10. **Region:** user-chosen — selection, whole diagram, or viewport.
11. **In-app:** keep both the existing ambient continuous flow **and** a new
    stepped traversal preview.
12. **Loop:** default play-once, freeze fully lit; loop count is a dialog option.
13. **Containers:** frames are static backdrop (always lit); a cluster lights
    with its first member.
14. **No source (cycles / all-incoming):** fall back to first-declared node,
    visit-once BFS, non-blocking hint; never block export.
15. **Formats:** GIF + WebP.
16. **Authoring UX:** fullest support — canvas step badges, timeline scrubber,
    properties-panel + YAML editing, WYSIWYG preview.

## Schema changes (IR / YAML)

Add to `src/shared/ir/types.ts` and the YAML parser/serializer, with round-trip
and validation coverage:

- **`step?: number`** on `Node` and `Edge` — optional explicit order. Omitted =
  derived from topology.
- **`direction?: 'forward' | 'reverse' | 'both'`** on `Edge` — default
  `forward` (source → target). `reverse` flips both flow and the rendered
  arrowhead to target → source without editing endpoints. `both` = bidirectional
  (flow both ways, double arrowhead).

Both fields are optional and absent-by-default so existing diagrams round-trip
unchanged and the YAML stays clean. Positions remain explicit; nothing here
touches layout.

## Order resolution (pure, `src/shared/animation/order.ts`)

Given a `Diagram`, compute an integer order per node and edge:

1. **Sources** = nodes with no incoming edge (respecting each edge's effective
   `direction`; a `reverse` edge's "target" is its declared source). If none
   exist, **fall back** to the first-declared node and emit a non-blocking
   warning (decision 14).
2. **Derived depth:** BFS from sources following effective arrow direction,
   visit-once (cycles terminate). A node's derived order = its BFS depth; an
   edge's derived order = the step at which flow crosses it (its source node's
   order, i.e. it animates as the flow leaves the already-lit source).
3. **Explicit pins:** if an element has `step`, that value **is** its order,
   overriding the derived value (decision 3). Explicit and derived values share
   one integer space.
4. **Clusters:** a cluster's order = the minimum order among its member nodes
   (`node.clusterId` is the single source of truth per CLAUDE.md) — it lights
   with its first member (decision 13). Clusters carry no `step` of their own.
5. **Frames:** excluded from ordering; always lit (static backdrop).
6. **Grouping:** elements are grouped by resulting order; each group is one beat.

This module is the primary test seam: pure, framework-free, unit-tested with
fixtures for linear chains, fan-out, explicit-pin overrides, cycles/no-source,
`direction: reverse`/`both`, and clustered nodes.

## Timeline & state (pure, `src/shared/animation/{timeline,state}.ts`)

- `buildTimeline(order, timing)` → an ordered list of beats with start/end times
  from the global timing settings (seconds-per-step, dot travel duration,
  end-hold). Total duration is deterministic.
- `stateAt(diagram, timeline, t)` → `{ nodeOpacity, edgeOpacity, clusterOpacity,
  dotPositions, edgeDirection }` — a pure function of time. Dimmed elements sit
  at the configured dim opacity; a beat's elements ramp to full; the active
  edge's dot position is a fraction along its path (respecting `direction`).
  This single function drives **both** the live preview (rAF-sampled `t`) and
  frame capture (discrete `t` per GIF frame), guaranteeing WYSIWYG parity.

Unit-tested independent of tldraw/DOM.

## Capture & encode (renderer)

Deterministic render-per-frame (decision 8):

1. For each frame at time `t` (frame count = fps × total duration): compute
   `stateAt`, apply the resulting opacity/dot props to the tldraw shapes, and
   render.
2. Grab the frame — reuse the existing `exportToBlob`/region path
   (`CanvasView.tsx:558`), producing raster pixels per frame.
3. Encode: GIF via a dependency-free JS encoder (e.g. gifenc — small, fast, good
   quantizer for the 256-color limit); WebP via an acceptable wasm/JS encoder.
4. Hand the resulting bytes to the main process to write, reusing
   `exportImage` / `writeExportedImage` (`exportService.ts`) with `.gif` /
   `.webp` save-dialog filters — no new IPC method strictly required.

**Progress indicator** required: ~100 frames per export, each an export+encode
step.

**Risks flagged for a spike before committing:**
- Per-frame tldraw `exportToBlob` throughput. If too slow, fall back to a
  self-rendered offscreen canvas driven by `stateAt` (documented downgrade, not
  silent) — reusing the icon glyphs from `icons.tsx`.
- **Animated WebP encoding with no native dependency** is the one genuine
  unknown; if no acceptable browser-side encoder exists, WebP slips to a
  follow-up and GIF ships alone (documented, not silent).

## Timing settings (global, export/preview dialog)

Defaults (all user-adjustable): **15 fps**, **~1.0 s/step**, dot travel within
the step, **dimmed opacity ~0.15**, **end-hold ~1.0 s**, **loop once** (freeze
fully lit), **2× scale**. Region selector: selection / whole diagram / viewport.
Format selector: GIF / WebP. No timing is stored in the diagram YAML.

## In-app experience & authoring UX

- **Two animation modes coexist** (decision 11): the existing ambient continuous
  flow toggle is retained; a new **traversal preview** plays the staged
  build-up, looping, driven by `stateAt`.
- **Step badges** overlaid on nodes/edges show the resolved order (derived or
  explicit) so ordering is visible at a glance while authoring.
- **Timeline scrubber** to jump to / hold any beat.
- **Properties panel + YAML** both edit `step` and `direction`; the properties
  panel is the existing one from commit `0d3569e`.
- **Region entry points:** an "Animated GIF/WebP…" item in the export menu and a
  canvas **context-menu** entry for "Export selection as animation…" when shapes
  are selected.

## Rough module map

- `src/shared/ir/types.ts` — add `step` (node + edge) and `direction` (edge);
  `yaml/{parse,serialize}.ts` + round-trip/validation tests.
- `src/shared/animation/` (new pure core) — `order.ts`, `timeline.ts`,
  `state.ts`; unit-tested under both tsconfig projects.
- `src/renderer/src/canvas/` — `EdgeShapeUtil`/`NodeShapeUtil`/`ClusterShapeUtil`
  accept animation-driven opacity/dot/direction props (deterministic), separate
  from the retained ambient CSS flow; a preview-controller hook (rAF for
  preview, discrete `t` for capture); a badge overlay; the capture+encode loop;
  the export dialog; the context-menu entry.
- `src/renderer/src/ui` — scrubber / sequence timeline control; export dialog.
- `src/main` — `exportService.ts` reused; add gif/webp save-dialog filters.

## Testing

- **Unit (`src/shared`):** `order.ts` fixtures (linear, fan-out, explicit pins,
  cycles/no-source fallback, `reverse`/`both`, clusters); `timeline`/`state`
  determinism; YAML round-trip for `step`/`direction`.
- **E2E:** authoring a `step` reorders the preview; a `direction: reverse` edge
  flips flow + arrowhead; exporting produces a non-empty `.gif` (and `.webp`)
  file for each region option; empty-canvas export is blocked with the existing
  message.

## Error handling

- Empty region / nothing to capture → reuse the existing "Nothing to export"
  message (`CanvasView.tsx:555`).
- No source node → first-declared-node fallback + non-blocking hint; never
  blocks.
- Encode failure → surface a non-blocking toast; leave the diagram untouched.
- Diagram YAML errors keep today's freeze-on-error behavior, unaffected.

## Out of scope

- Per-object timing (durations/speeds on objects) — global-only for v1.
- MP4/H.264 export (needs ffmpeg/native or heavy wasm; GIF+WebP cover the ask).
- Audio, captions, or step annotations layered on the animation.
- Animating frame boundaries (frames are print boundaries; they stay static).
- Exporting the whiteboard surface's animation (diagram surface only).

## Further notes

- The clean-YAML thesis holds: only two small optional fields enter the IR;
  everything time-related is export-dialog state.
- `stateAt` as the single source for preview and capture is the key design move
  — it makes the exported artifact provably match what the author previews.
- The two spike items (per-frame export throughput, animated-WebP encoder)
  should be resolved before committing to the full plan.
