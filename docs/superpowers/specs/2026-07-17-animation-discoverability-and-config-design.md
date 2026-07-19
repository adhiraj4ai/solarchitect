# Animation: discoverability + configuration — design

**Date:** 2026-07-17
**Status:** Approved (brainstorm) — pending implementation plan

## Problem

Solarchitect already ships a mature traversal-animation feature (built across #23
and #43): an "Animations" activity-bar panel with preset CRUD + a properties
editor, a top-bar Play toggle, a timeline scrubber, and animated-GIF export. Yet
users report there is "no UI option" for animation. Two root causes:

1. **Discoverability.** The animation controls are hard to find:
   - The activity-bar entry uses an ambiguous play-triangle-in-a-circle icon
     (`ActivityBar.tsx:75`) whose only cue that it means "animation" is the tooltip.
   - The timeline scrubber only appears *while already playing* — it is gated on
     `traversalPlaying && previewPeriod > 0` (`CanvasView.tsx:1369`). A user who has
     not started playback sees no animation controls on the canvas at all.

2. **Phantom configuration.** The `AnimationPreset` model carries fields that are
   never wired to rendering, so even a user who finds the editor cannot change them:
   - `dimOpacity` is in the model and coerced from settings, but `state.ts:8`
     hardcodes `DIM_OPACITY = 0.15` and never reads the preset value.
   - `tokenColor` is in the model but `FlowToken` (`EdgeShapeUtil.tsx:24`) hardcodes
     `fill="var(--sync, #d9822b)"`.
   - The flow token's size is hardcoded `r="5"` (`EdgeShapeUtil.tsx:24`); there is no
     model field for it.
   - There is no easing control — the token crosses an edge at a constant rate.

## Goals

- Make the animation controls easy to find (clearer entry points **and** a
  persistent on-canvas control bar).
- Expose four configuration options in the preset properties editor, wiring the
  three phantom concerns to rendering and adding one new field.

## Non-goals (YAGNI)

- Per-edge / per-node animation. Animation stays **global** via named presets; the
  diagram IR continues to carry only `step` (order) and edge `direction`.
- New animation styles beyond the existing four.
- Changes to the GIF export dialog (it already selects a preset; because capture
  reads the preset, it inherits every new option for free).
- Storing presets in diagram YAML. Presets remain in app settings.

## Design

### Part A — Discoverability

**A1. Clearer entry points.**
- `ActivityBar.tsx` — replace the play-in-circle glyph with a more recognizable
  motion icon and keep the "Animations" tooltip (label already "Animations" in
  `panels.ts:37`).
- Keep the existing top-bar `▶ [preset name]` Play button (`App.tsx:326`) — it is
  already a reasonable entry point and doubles as the active-preset indicator.

**A2. Persistent canvas control bar** — new component
`renderer/src/canvas/AnimationControlBar.tsx`.

Today the scrubber JSX lives inline in `CanvasView.tsx` (1369–1413) and is gated on
playback. Extract it into a control bar docked at the bottom of the canvas, visible
whenever a **diagram** canvas is shown (`showCanvas && isDiagram`), regardless of
whether playback has started. Contents:

- Play/Pause toggle (drives the existing traversal state).
- Scrubber track with beat ticks and the `t / total` time readout (existing logic).
  At rest it shows `0.0 / N.Ns` and seeking starts playback paused.
- Active-preset **dropdown** for quick switching without opening the panel (writes
  the same `activePresetId` setting the panel's "set active" does).
- **⚙ gear** button that opens the Animations panel
  (`layout.selectPanel('animations')`) for full editing.

`CanvasView` owns the traversal state (`traversalPlaying`, `traversalRunning`,
`seekTraversal`, `toggleTraversalRunning`, `previewTimeline`, `previewPeriod`,
`traversalTime`) and passes it into the bar as props. The old inline scrubber JSX
is removed in favor of the bar.

State note: `traversalPlaying` (App-level: animation preview is engaged at all) and
`traversalRunning` (CanvasView-level: rAF advancing vs. paused for scrubbing) are
kept as-is; the bar's Play/Pause maps onto them the same way the current top-bar
button and inline scrubber do. No new state model is introduced.

### Part B — Configuration

Four controls added to `PresetEditor` in `AnimationsPanel.tsx` (built-ins remain
read-only; they render with defaults):

| Control | Model field | Today | Work |
|---|---|---|---|
| Dim opacity (slider 0–1) | `dimOpacity` | ignored (hardcoded `0.15`) | thread into engine |
| Token color (color input + reset-to-accent) | `tokenColor` | ignored (hardcoded fill) | thread into render + capture |
| Token size (slider, px radius) | `tokenSize` *(new)* | hardcoded `r="5"` | add field + wire |
| Travel easing (Linear / Ease-in-out) | `travelEasing` *(new)* | none | add field + engine |

Dim opacity only affects the build-up (control-flow) style; the control is disabled
with an explanatory hint for the other styles.

### Where each change lands

The golden rule holds: the two views never talk directly; both project from the IR
through the animation engine, so timing/opacity/easing live in `shared/animation`
and only rendering-time cosmetics (token color/size) touch the renderer.

- **`shared/animation/presets.ts`** — add optional `tokenSize?: number` and
  `travelEasing?: 'linear' | 'ease-in-out'` to `AnimationPreset`. Extend
  `coercePreset` to read them tolerantly (defaults: `tokenSize` 5, `travelEasing`
  `'linear'`; `dimOpacity` default stays `0.15`). Built-ins may omit the new fields.
- **`shared/animation/timeline.ts`** — add `easing: 'linear' | 'ease-in-out'` (and
  the resolved `dimOpacity`) to `TimingSettings`; `presetTiming()` maps
  `preset.travelEasing ?? 'linear'` and `preset.dimOpacity`.
- **`shared/animation/state.ts`** — replace the hardcoded `DIM_OPACITY` with the
  value threaded via `timeline.timing`; add a pure `applyEasing(fraction, easing)`
  and apply it to the token fraction in all three code paths (all-edges continuous
  `cyclePhase`, by-order beat flow, and `stateAtByPath`). The `AnimationState`
  shape is unchanged.
- **`renderer/src/canvas/EdgeShapeUtil.tsx` + `captureAnimation.ts`** — `FlowToken`
  honors token color and size. Because both are **global to the active preset**, set
  them as CSS variables (`--token-color`, `--token-size`) on the canvas root for the
  live preview, and apply the same to the exported SVG during capture so live and
  GIF match. (Alternative considered: carry color/size as edge shape props like
  `dotT`; deferred to the implementation plan, which will choose based on tldraw's
  shape-migration cost.)
- **`renderer/src/project/AnimationsPanel.tsx`** — four new fields in `PresetEditor`.
- **`renderer/src/ui/ActivityBar.tsx`** — icon swap.
- **`renderer/src/canvas/CanvasView.tsx`** — render `AnimationControlBar`; remove the
  inline playback-gated scrubber.
- **`renderer/src/App.tsx`** — pass the gear's panel-open handler through to the
  canvas; no top-bar changes beyond what already exists.

Because the GIF export path reads the resolved preset, all four options flow into
capture with no dialog changes.

## Data flow

```
settings (customPresets + activePresetId)
   └─ resolvePreset ─► AnimationPreset (style, timing, dimOpacity, tokenColor,
                                        tokenSize, travelEasing)
        ├─ presetTiming ─► TimingSettings (…, easing, dimOpacity)
        │      └─ buildTimeline ─► Timeline
        │            └─ stateAt / stateAtByPath ─► AnimationState (opacity + dotT)
        │                  ├─ live: applyTraversalState → tldraw shapes
        │                  └─ capture: per-frame SVG → GIF
        └─ cosmetics (tokenColor, tokenSize)
               ├─ live: CSS vars on canvas root → FlowToken
               └─ capture: applied to exported SVG
```

## Error handling / edge cases

- Unknown or out-of-range config values coerce to defaults (`coercePreset` already
  does this for existing fields; extend for the new ones). Sliders clamp to their
  documented ranges.
- Built-in presets stay read-only; new fields render at their defaults and cannot be
  edited (duplicate to customize, as today).
- Dim opacity has no visual effect outside build-up styles; the control is disabled
  with a hint rather than silently ignored.
- A dim opacity of 1 makes build-up a no-op (everything lit) — allowed, not an error.

## Testing

- **Unit `state.test.ts`** — an un-reached element's opacity equals the preset's
  `dimOpacity` (not the old constant); `applyEasing` curves the token fraction
  (ease-in-out ≠ linear at the midpoint's neighbors, endpoints still 0 and 1).
- **Unit `presets.test.ts`** — `coercePreset` reads `tokenSize`/`travelEasing`,
  rejects bad values to defaults, round-trips through `coercePresets`.
- **Unit `timeline.test.ts`** — `presetTiming` carries `easing` and `dimOpacity`.
- **E2E** — the control bar is visible on a diagram *without* first playing; the gear
  opens the Animations panel; the preset dropdown switches the active preset; the
  four new inputs render, edit, and persist across reopen.

## Rollout

Single change set. No migration: existing stored custom presets lack the new fields
and coerce to defaults; existing `dimOpacity` values (currently ignored) start taking
effect, which matches user intent.
