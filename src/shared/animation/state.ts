import type { Diagram, EdgeDirection } from '../ir/types';
import type { ResolvedOrder } from './order';
import type { Timeline } from './timeline';
import type { AnimationStyle } from './presets';

/** Opacity of an element that has not been reached yet. */
export const DIM_OPACITY = 0.15;

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
function litLevel(beatStart: number, t: number, fadeSeconds: number): number {
  if (t < beatStart) return DIM_OPACITY;
  if (fadeSeconds <= 0 || t >= beatStart + fadeSeconds) return 1;
  const p = (t - beatStart) / fadeSeconds;
  return DIM_OPACITY + (1 - DIM_OPACITY) * p;
}

/**
 * Compute the animation's visual state at time `t` (seconds) for a given style.
 * The style is two knobs over one engine:
 *  - build-up (dim→lit cumulative) is on only for `control-flow`; other styles
 *    keep every element fully lit and just move tokens.
 *  - tokens are `all-at-once` (all edges flow continuously) for `all-edges`,
 *    else `by-order` (each edge's token flows during its beat). `end-to-end`
 *    (by-path) is handled by its own strategy in #37; here it reads as by-order.
 */
export function stateAt(
  diagram: Diagram,
  order: ResolvedOrder,
  timeline: Timeline,
  t: number,
  style: AnimationStyle = 'control-flow',
): AnimationState {
  const { fadeSeconds, dotTravelSeconds } = timeline.timing;
  const buildUp = style === 'control-flow';
  const allAtOnce = style === 'all-edges';
  const opacityFor = (v: number) => (buildUp ? litLevel(timeline.beatStart[v] ?? 0, t, fadeSeconds) : 1);
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
      dotPositions[e.id] = geom(e.direction, cyclePhase);
    } else if (t < start || t > start + dotTravelSeconds || dotTravelSeconds <= 0) {
      // by-order: the token flows only during this edge's beat.
      dotPositions[e.id] = null;
    } else {
      dotPositions[e.id] = geom(e.direction, Math.min(1, Math.max(0, (t - start) / dotTravelSeconds)));
    }
  }

  return { nodeOpacity, edgeOpacity, clusterOpacity, dotPositions, edgeDirection };
}
