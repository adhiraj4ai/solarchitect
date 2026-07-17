# Animation Preset Library — Design

**Status:** Approved for planning
**Date:** 2026-07-16

## Problem Statement

The animation work in this session (`2026-07-16-animated-traversal-export-design.md`)
gave the diagram one staged **control-flow** traversal plus a legacy ambient
"Animate" toggle — two ad-hoc, hard-coded modes reached from two separate top-bar
buttons. Architects want to tell different stories from the same diagram: *data
flowing* through the system, a *request's end-to-end journey*, the *control-flow*
build-up, or simply *everything in motion*. There is no way to choose among
animation styles, tune them, save them, or reuse them.

## Solution

A **managed library of named animation presets**. Each preset captures *how the
diagram moves* (a style + motion timing); the export dialog keeps *how it is
rendered out* (fps/scale/region). One preset is **active** at a time; Play, the
scrubber, and GIF export all run the chosen preset. The library ships four
read-only built-ins and supports full CRUD over user presets, stored in app
settings so it follows the user across every project.

This **subsumes** today's two toggles: the ambient "Animate" becomes the "All
edges" built-in, and the staged traversal becomes "Control flow".

## Terminology

- **Style** — one of four motion semantics (below), each a parameterization of
  the shared animation engine.
- **Preset** — a named, saved bundle of a style plus motion timing.
- **Active preset** — the preset that Play / scrub / export currently run.
- **Built-in** — one of four read-only presets shipped in code.

## Core Decisions (locked in grilling, 2026-07-16)

1. **Structure:** a managed library of named presets (CRUD), not a single global
   selector and not per-object styles.
2. **Engine:** styles are *sequencing/scope over one engine* — the existing
   flowing-token + optional dim→lit build-up — not distinct visual engines.
3. **Preset scope:** a preset owns style + motion timing; the export dialog owns
   output params (fps/scale/region) plus a preset picker.
4. **Storage:** app settings (global), via the existing `mergeSettings` +
   `readSettings`/`writeSettings`.
5. **Built-ins:** four read-only built-ins + custom CRUD, with duplicate-to-
   customize.
6. **Library UX:** a new "Animations" activity-bar panel (mirrors Templates).
7. **Toggles:** collapse to a single Play of the active preset; remove the
   ambient Animate toggle.
8. **End-to-end:** a token walks each source→sink simple path in turn, looping.
9. **Active preset:** remembered globally (last-used) in settings, default
   Control flow.

## The four styles (one engine, two knobs)

`buildUp` (cumulative dim→lit or not) × `sequencing` (`all-at-once` /
`by-order` / `by-path`):

| Style          | buildUp | sequencing  | Behavior |
|----------------|---------|-------------|----------|
| **All edges**  | off     | all-at-once | every edge's token flows continuously, all at once, looping. Nodes stay lit. (= legacy ambient Animate.) |
| **Dataflow**   | off     | by-order    | tokens propagate outward from sources beat-by-beat (a wavefront by resolved order), looping. Nodes stay lit. |
| **Control flow** | on    | by-order    | staged dim→lit cumulative build-up following resolved order (this session's traversal). |
| **End-to-end** | off     | by-path     | one token walks each **source→sink simple path** in turn (effective direction, visit-once for cycles), deterministic order, looping. Nodes stay lit. |

- `by-order` reuses `resolveOrder` (explicit `step` pins + topological depth,
  pins propagate) and the beat timeline.
- `by-path` is new: enumerate distinct simple paths from each source (no
  incoming edge) to each reachable sink (no outgoing), following effective edge
  direction, visit-once so cycles terminate. Deterministic order (by source
  declaration, then discovery). **Cap the path count with a logged limit** —
  never silently truncate.
- Non-build-up styles hold every node/cluster at full opacity; only tokens move.

## Data model

```
interface AnimationPreset {
  id: string;
  name: string;
  style: 'all-edges' | 'dataflow' | 'control-flow' | 'end-to-end';
  secondsPerStep: number;
  dotTravelSeconds: number;
  fadeSeconds: number;     // used by build-up styles
  dimOpacity: number;      // used by build-up styles
  loop: 'once' | 'forever';
  tokenColor?: string;     // optional; defaults to the sync accent
}
```

- **Built-ins** are defined in code (a `BUILTIN_PRESETS` constant), read-only,
  always present. The library shown to the user = built-ins ++ custom presets.
- **Settings** persists only `customPresets: AnimationPreset[]` and
  `activePresetId: string`. `mergeSettings` validates them tolerantly (unknown
  style → drop/repair; bad `activePresetId` → the default built-in), so a
  corrupt settings file can never crash the app (existing invariant).

## Engine changes (`src/shared/animation`)

- Generalize the timeline/state so `stateAt` (or a thin wrapper) takes a
  **sequencing strategy** + `buildUp`:
  - `all-at-once`: every edge's `dotT` cycles over `dotTravelSeconds`, phase-
    independent of order; opacities all 1.
  - `by-order`: today's behavior; `buildUp` decides whether opacities ramp
    (control-flow) or stay lit (dataflow).
  - `by-path`: a new `paths.ts` enumerates simple paths; the timeline sequences
    one path's token journey after another; opacities all 1.
- Each style yields a deterministic **total period** so the scrubber and export
  have a finite duration (looping styles = one cycle; `once` build-up = build-up
  + end-hold).
- `FlowToken`, `applyTraversalState`, and the `captureTraversalGif` pipeline are
  reused unchanged — they already consume opacity + `dotT` per shape.

## UI

- **New "Animations" activity-bar panel** beside Templates: lists built-ins +
  custom presets; clicking one makes it active; an edit form (style dropdown +
  timing fields) for custom presets; create / duplicate (incl. duplicating a
  built-in) / delete. Read-only built-ins show their settings but disable edits.
- **Top bar:** a single **Play** runs the active preset (label reflects it);
  the ambient **Animate** toggle is removed. The **scrubber** stays, driven by
  the active preset's finite period.
- **Export dialog:** unchanged output params (fps/scale/region) plus a **preset
  picker** defaulting to the active preset; capture runs that preset.

## IPC / persistence

- No new channels: extend `AppSettings` and reuse `readSettings`/`writeSettings`.
  The renderer's Animations panel reads/writes settings like the existing
  settings UI.

## Testing

- **Unit (`src/shared`):** `mergeSettings` with presets (valid, partial,
  corrupt, bad `activePresetId`); the new `paths.ts` enumeration (linear,
  fan-out/in, multiple sources/sinks, cycle visit-once, cap-with-log); the
  sequencing-strategy `stateAt` variants (all-at-once phase, by-order wavefront
  vs build-up, by-path per-path token position).
- **E2E:** create/duplicate/delete a custom preset; switch active preset and see
  Play change behavior; export each built-in style to a non-empty GIF.

## Migration / compatibility

- Removing the ambient Animate toggle: the "All edges" built-in reproduces it.
  No IR or YAML change (styles/presets live in settings, not diagrams) — the
  clean-YAML thesis is preserved.

## Dependencies & sequencing

- **Stacks on `worktree-feat+animate-traversal-export`** (tickets #24–#30 of the
  prior spec). It requires that branch's `order`/`timeline`/`state`, `FlowToken`,
  and capture pipeline, none of which are on `main` yet. Build on a new worktree
  branched off it, and land it after (or together with) the animation branch.

## Out of scope

- Per-object animation styles (an edge/group animating differently from others).
- Distinct per-style visual engines (comet trails, node pulses); styles remain
  parameterizations of the one engine.
- Per-diagram preferred preset; the active selection is global.
- Animated WebP/APNG export (GIF only, per the prior spike).

## Further notes

- The two-knob model (`buildUp` × `sequencing`) is the key simplification: four
  named styles fall out of two booleans/enums over the engine already built.
- `by-path` enumeration is the one genuinely new algorithm and the main risk on
  dense graphs; the logged cap keeps it bounded and honest.
