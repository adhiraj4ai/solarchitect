import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import type { Box, Editor, TLShapeId } from 'tldraw';
import type { Diagram } from '@shared/ir/types';
import { resolveOrder } from '@shared/animation/order';
import { buildTimeline, type TimingSettings } from '@shared/animation/timeline';
import { stateAt, type AnimationState } from '@shared/animation/state';
import { getArchNodeShapes, getArchClusterShapes, getArchEdgeShapes } from './shapeAdapters';

/** Fully-lit, no-token state — resets the canvas after a capture / on stop. */
export const LIT_STATE: AnimationState = {
  nodeOpacity: {},
  edgeOpacity: {},
  clusterOpacity: {},
  dotPositions: {},
  edgeDirection: {},
};

/** Apply a traversal AnimationState to the canvas shapes (opacity build-up +
 *  edge flow token). Missing entries fall back to lit/no-token, so passing
 *  LIT_STATE resets everything. Caller wraps this in mergeRemoteChanges. */
export function applyTraversalState(editor: Editor, s: AnimationState): void {
  for (const shape of getArchNodeShapes(editor)) {
    const op = s.nodeOpacity[shape.props.nodeId] ?? 1;
    if (shape.opacity !== op) editor.updateShape({ id: shape.id, type: 'archNode', opacity: op });
  }
  for (const shape of getArchClusterShapes(editor)) {
    const op = s.clusterOpacity[shape.props.clusterId] ?? 1;
    if (shape.opacity !== op) editor.updateShape({ id: shape.id, type: 'archCluster', opacity: op });
  }
  for (const shape of getArchEdgeShapes(editor)) {
    const op = s.edgeOpacity[shape.props.edgeId] ?? 1;
    const dot = s.dotPositions[shape.props.edgeId];
    const dotT = dot == null ? -1 : dot;
    if (shape.opacity !== op || shape.props.dotT !== dotT)
      editor.updateShape({ id: shape.id, type: 'archEdge', opacity: op, props: { dotT } });
  }
}

/** What area of the diagram the GIF covers. */
export type CaptureRegion = 'all' | 'selection' | 'viewport';

/** Tunable capture settings (the export dialog owns these). */
export interface GifExportOptions extends TimingSettings {
  /** Frames per second of the GIF. */
  fps: number;
  /** Resolution multiplier on the diagram's natural size. */
  scale: number;
  /** Loop the GIF forever, or play once and hold the final frame. */
  loop: 'once' | 'forever';
  /** Region to capture: whole diagram, current selection, or viewport. */
  region: CaptureRegion;
}

export const DEFAULT_GIF_OPTIONS: GifExportOptions = {
  secondsPerStep: 1,
  fadeSeconds: 0.35,
  dotTravelSeconds: 0.9,
  endHoldSeconds: 1,
  fps: 15,
  scale: 2,
  loop: 'once',
  region: 'all',
};

/** Resolve the shapes + optional clip bounds for a capture region. Selection
 *  falls back to the whole page when nothing is selected. */
function resolveRegion(editor: Editor, region: CaptureRegion): { ids: TLShapeId[]; bounds?: Box } {
  if (region === 'selection') {
    const selected = editor.getSelectedShapeIds();
    if (selected.length > 0) return { ids: selected };
  }
  const ids = [...editor.getCurrentPageShapeIds()];
  if (region === 'viewport') return { ids, bounds: editor.getViewportPageBounds() };
  return { ids };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to rasterize a frame.'));
    img.src = src;
  });
}

/**
 * Capture the staged traversal of the current page as an animated GIF. Each
 * frame is the pure stateAt() applied to the shapes, serialized via tldraw and
 * rasterized to RGBA, then quantized and written with gifenc. The canvas is
 * restored to fully-lit afterwards. Throws 'EMPTY' if there is nothing to export.
 */
export async function captureTraversalGif(
  editor: Editor,
  diagram: Diagram,
  options: GifExportOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const { ids, bounds } = resolveRegion(editor, options.region);
  if (ids.length === 0) throw new Error('EMPTY');

  const order = resolveOrder(diagram);
  const timeline = buildTimeline(order, options);
  const total = Math.max(timeline.totalSeconds, 0.001);
  const frameCount = Math.max(1, Math.ceil(options.fps * total));
  const delayMs = Math.round(1000 / options.fps);

  const gif = GIFEncoder();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context unavailable.');
  let w = 0;
  let h = 0;

  try {
    for (let i = 0; i < frameCount; i++) {
      const t = i / options.fps;
      const s = stateAt(diagram, order, timeline, t);
      editor.store.mergeRemoteChanges(() => applyTraversalState(editor, s));

      const svg = await editor.getSvgString(ids, { background: true, padding: 8, ...(bounds ? { bounds } : {}) });
      if (!svg) throw new Error('Failed to serialize the diagram.');
      if (i === 0) {
        // Size the canvas once from the first frame. Export bounds derive from
        // shape geometry (positions), which the traversal never changes — only
        // opacity/dot props — so every frame has identical dimensions.
        w = Math.max(1, Math.ceil(svg.width * options.scale));
        h = Math.max(1, Math.ceil(svg.height * options.scale));
        canvas.width = w;
        canvas.height = h;
      }
      const img = await loadImage('data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg.svg))));
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);

      const palette = quantize(data, 256);
      const index = applyPalette(data, palette);
      gif.writeFrame(index, w, h, {
        palette,
        delay: delayMs,
        // The first frame carries the loop count: 0 = forever, -1 = play once.
        ...(i === 0 ? { repeat: options.loop === 'forever' ? 0 : -1 } : {}),
      });
      onProgress?.(i + 1, frameCount);
    }
    gif.finish();
    return gif.bytes();
  } finally {
    // Always restore the canvas to fully-lit, even if a frame failed.
    editor.store.mergeRemoteChanges(() => applyTraversalState(editor, LIT_STATE));
  }
}
