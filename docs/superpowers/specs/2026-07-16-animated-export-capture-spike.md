# Capture & Encoder Feasibility — Spike (#28)

**Status:** Decision note
**Date:** 2026-07-16

De-risks the export half (#29 GIF, #31 WebP) before building it. Two unknowns
from the design: per-frame capture throughput, and animated-WebP encoding.

## Method

- Throwaway measurement harness: temporarily exposed the tldraw `editor` on
  `window` and drove `getSvgString` + a canvas rasterize loop from a built app.
  The hook was **reverted** and never committed. The harness proved flaky under
  the current activity-bar launch state (the diagram canvas mounts at zero
  width, and the editor handle wasn't reliably reachable), so a precise
  per-frame number is deferred to #29, which produces a real GIF and can time
  the actual run behind its progress indicator.
- Registry/availability checks for candidate encoders.

## Capture pipeline (decision)

Reuse the path the app already ships for PNG/SVG export:
`editor.getSvgString(ids, { background, padding, scale })` → `Image` from a
`data:image/svg+xml` URL → draw to an offscreen `<canvas>` → read pixels. The
deterministic preview (#26) already proves the frame state is a pure function of
`t` (`stateAt`), so capturing frame *i* is: set `stateAt(t_i)` onto the shapes,
serialize, rasterize. tldraw's `exportToBlob` wraps exactly this.

- **Primary risk — throughput.** ~100 frames × (serialize + rasterize). Expect
  this to be seconds, not sub-second; **#29 must show a progress indicator** and
  run off the main interaction path. Measure the real number during #29.
- **Documented fallback (not silent).** If tldraw serialization proves too slow
  per frame, render frames on a self-owned offscreen `<canvas>` from the IR +
  `stateAt` (reusing the icon glyphs), bypassing tldraw's SVG path. Heavier to
  build; only if needed.

## GIF encoder (decision)

**Use `gifenc`** (v1.0.3, MIT, ~zero-dependency, fast palette quantizer).
Confirmed on the registry. It accepts RGBA frame buffers + per-frame delay and
supports a loop count, which covers #29's needs (play-once default, tunable). Add
it as a runtime dependency in #29. The 256-color limit is inherent to GIF; its
quantizer keeps architecture palettes acceptable.

## Animated WebP (decision — the genuine unknown)

**No mature, dependency-free, browser-side *animated* WebP encoder exists.**
- `canvas.toDataURL('image/webp')` / `toBlob` produces **still** WebP only
  (Chromium), not an animation container.
- Animated WebP needs libwebp's `WebPAnimEncoder`; wasm builds are heavy/niche
  and not cleanly packaged for a renderer. `@jsquash/webp` encodes single frames
  but does not expose animation muxing.

**Recommendation for #31 (raise with the user):**
1. **Document the downgrade** and ship GIF only for v1 (the spec already allows
   this as a "documented, not silent" fallback), **or**
2. **Substitute animated PNG (APNG)** as the true-color companion via `upng-js`
   (v2.1.0, available) — no 256-color limit, broadly supported, inline-able in
   READMEs. Same frame pipeline as GIF; only the encoder differs. This deviates
   from the literal "WebP" wording but delivers the intent (a higher-fidelity
   animated export alongside GIF).

`MediaRecorder`→WebM is possible but is video (doesn't inline like GIF/APNG), so
it's not recommended for the README/Slack use case.

## Outcome

- #29 (GIF): **proceed** with `gifenc` + the tldraw capture pipeline + a progress
  indicator; measure real throughput there and record the fallback if hit.
- #31 (WebP): **at risk** — decide downgrade-to-GIF-only vs APNG-substitute with
  the user before building.
