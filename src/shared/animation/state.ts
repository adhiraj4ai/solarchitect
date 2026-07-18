import type { Diagram, EdgeDirection } from '../ir/types';
import type { ResolvedOrder } from './order';
import type { Timeline } from './timeline';
import type { AnimationStyle, TravelEasing } from './presets';
import type { DiagramPath } from './paths';

/** Default opacity of an element that has not been reached yet (used when a
 *  timeline carries no explicit dimOpacity). */
export const DIM_OPACITY = 0.15;

/** Map a 0..1 travel fraction through the chosen easing curve. Linear is the
 *  identity; ease-in-out is easeInOutQuad (slow start and end) with the 0 and 1
 *  endpoints fixed, so the token still starts and ends exactly on the nodes. */
export function applyEasing(fraction: number, easing: TravelEasing): number {
  if (easing === 'linear') return fraction;
  const t = Math.min(1, Math.max(0, fraction));
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** The full visual state of the traversal at a moment in time. Pure: the same
 *  (diagram, order, timeline, t) always yields the same state, so it drives
 *  both the live preview and frame-accurate capture. */
export interface AnimationState {
  nodeOpacity: Record<string, number>;
  edgeOpacity: Record<string, number>;
  clusterOpacity: Record<string, number>;
  /** edgeId → token position as a fraction 0..1 along the from→to path while
   *  the edge is actively flowing, else null (no token shown). */
  dotPositions: Record<string, number | null>;
  /** edgeId → flow direction, so a capture consumer can render a directional
   *  cue without re-reading the IR. (dotPositions is already direction-aware.) */
  edgeDirection: Record<string, EdgeDirection>;
}

/** Cumulative dim→lit level for an element whose beat starts at `beatStart`. */
function litLevel(beatStart: number, t: number, fadeSeconds: number, dimOpacity: number): number {
  if (t < beatStart) return dimOpacity;
  if (fadeSeconds <= 0 || t >= beatStart + fadeSeconds) return 1;
  const p = (t - beatStart) / fadeSeconds;
  return dimOpacity + (1 - dimOpacity) * p;
}

/**
 * Compute the animation's visual state at time `t` (seconds) for a given style.
 * The style is two knobs over one engine:
 *  - build-up (dim→lit cumulative) is on only for `control-flow`; other styles
 *    keep every element fully lit and just move tokens.
 *  - tokens are `all-at-once` (all edges flow continuously) for `all-edges`,
 *    else `by-order` (each edge's token flows during its beat).
 *
 * `end-to-end` has its own path-walking strategy (see stateAtByPath); callers
 * route it there. If passed here it falls back to the by-order token treatment.
 */
export function stateAt(
  diagram: Diagram,
  order: ResolvedOrder,
  timeline: Timeline,
  t: number,
  style: AnimationStyle = 'control-flow',
): AnimationState {
  const { fadeSeconds, dotTravelSeconds } = timeline.timing;
  const dimOpacity = timeline.timing.dimOpacity ?? DIM_OPACITY;
  const easing = timeline.timing.easing ?? 'linear';
  const buildUp = style === 'control-flow';
  const allAtOnce = style === 'all-edges';
  const opacityFor = (v: number) => (buildUp ? litLevel(timeline.beatStart[v] ?? 0, t, fadeSeconds, dimOpacity) : 1);
  // A token's geometric position along from→to, flipped for a reverse edge.
  const geom = (dir: EdgeDirection, flow: number) => (dir === 'reverse' ? 1 - flow : flow);

  const nodeOpacity: Record<string, number> = {};
  for (const n of diagram.nodes) nodeOpacity[n.id] = opacityFor(order.nodeOrder[n.id] ?? 0);

  const clusterOpacity: Record<string, number> = {};
  for (const c of diagram.clusters) {
    const v = order.clusterOrder[c.id];
    // A cluster with no members has no order; keep it lit as static context.
    clusterOpacity[c.id] = v === undefined ? 1 : opacityFor(v);
  }

  const edgeOpacity: Record<string, number> = {};
  const dotPositions: Record<string, number | null> = {};
  const edgeDirection: Record<string, EdgeDirection> = {};
  const cyclePhase = dotTravelSeconds > 0 ? (t % dotTravelSeconds) / dotTravelSeconds : 0;
  for (const e of diagram.edges) {
    const v = order.edgeOrder[e.id] ?? 0;
    const start = timeline.beatStart[v] ?? 0;
    edgeOpacity[e.id] = opacityFor(v);
    edgeDirection[e.id] = e.direction;

    if (allAtOnce) {
      // Every edge flows continuously and in phase, independent of order.
      dotPositions[e.id] = geom(e.direction, applyEasing(cyclePhase, easing));
    } else if (t < start || t > start + dotTravelSeconds || dotTravelSeconds <= 0) {
      // by-order: the token flows only during this edge's beat.
      dotPositions[e.id] = null;
    } else {
      const flow = Math.min(1, Math.max(0, (t - start) / dotTravelSeconds));
      dotPositions[e.id] = geom(e.direction, applyEasing(flow, easing));
    }
  }

  return { nodeOpacity, edgeOpacity, clusterOpacity, dotPositions, edgeDirection };
}

/** Total duration of the end-to-end (by-path) animation: every edge of every
 *  path takes one token-travel, walked back to back. */
export function byPathDuration(paths: DiagramPath[], dotTravelSeconds: number): number {
  const edges = paths.reduce((sum, p) => sum + p.edgeIds.length, 0);
  return edges * dotTravelSeconds;
}

/**
 * The end-to-end state at time `t`: a single token walks each path's edges in
 * turn (one edge per `dotTravelSeconds`), path after path, looping. Nothing
 * dims — only the one active edge carries a token; the rest is lit context.
 */
export function stateAtByPath(
  diagram: Diagram,
  paths: DiagramPath[],
  dotTravelSeconds: number,
  t: number,
  easing: TravelEasing = 'linear',
): AnimationState {
  const nodeOpacity: Record<string, number> = {};
  for (const n of diagram.nodes) nodeOpacity[n.id] = 1;
  const clusterOpacity: Record<string, number> = {};
  for (const c of diagram.clusters) clusterOpacity[c.id] = 1;
  const edgeOpacity: Record<string, number> = {};
  const dotPositions: Record<string, number | null> = {};
  const edgeDirection: Record<string, EdgeDirection> = {};
  for (const e of diagram.edges) {
    edgeOpacity[e.id] = 1;
    edgeDirection[e.id] = e.direction;
    dotPositions[e.id] = null;
  }

  const totalEdges = paths.reduce((sum, p) => sum + p.edgeIds.length, 0);
  if (totalEdges === 0 || dotTravelSeconds <= 0) {
    return { nodeOpacity, edgeOpacity, clusterOpacity, dotPositions, edgeDirection };
  }

  const period = totalEdges * dotTravelSeconds;
  const tt = ((t % period) + period) % period;
  const globalIdx = Math.min(totalEdges - 1, Math.floor(tt / dotTravelSeconds));
  const flow = Math.min(1, Math.max(0, (tt - globalIdx * dotTravelSeconds) / dotTravelSeconds));

  // Map the global edge index to the active edge across concatenated paths.
  let acc = 0;
  let activeEdgeId: string | undefined;
  for (const p of paths) {
    if (globalIdx < acc + p.edgeIds.length) {
      activeEdgeId = p.edgeIds[globalIdx - acc];
      break;
    }
    acc += p.edgeIds.length;
  }
  if (activeEdgeId !== undefined && activeEdgeId in dotPositions) {
    const eased = applyEasing(flow, easing);
    dotPositions[activeEdgeId] = edgeDirection[activeEdgeId] === 'reverse' ? 1 - eased : eased;
  }

  return { nodeOpacity, edgeOpacity, clusterOpacity, dotPositions, edgeDirection };
}
