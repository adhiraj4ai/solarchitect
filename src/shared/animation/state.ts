import type { Diagram, EdgeDirection } from '../ir/types';
import type { ResolvedOrder } from './order';
import type { Timeline } from './timeline';

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

/** Compute the traversal's visual state at time `t` (seconds). */
export function stateAt(diagram: Diagram, order: ResolvedOrder, timeline: Timeline, t: number): AnimationState {
  const { fadeSeconds, dotTravelSeconds } = timeline.timing;

  const nodeOpacity: Record<string, number> = {};
  for (const n of diagram.nodes) {
    const start = timeline.beatStart[order.nodeOrder[n.id] ?? 0] ?? 0;
    nodeOpacity[n.id] = litLevel(start, t, fadeSeconds);
  }

  const clusterOpacity: Record<string, number> = {};
  for (const c of diagram.clusters) {
    const v = order.clusterOrder[c.id];
    // A cluster with no members has no order; keep it lit as static context.
    const start = v === undefined ? 0 : (timeline.beatStart[v] ?? 0);
    clusterOpacity[c.id] = v === undefined ? 1 : litLevel(start, t, fadeSeconds);
  }

  const edgeOpacity: Record<string, number> = {};
  const dotPositions: Record<string, number | null> = {};
  const edgeDirection: Record<string, EdgeDirection> = {};
  for (const e of diagram.edges) {
    const v = order.edgeOrder[e.id] ?? 0;
    const start = timeline.beatStart[v] ?? 0;
    edgeOpacity[e.id] = litLevel(start, t, fadeSeconds);
    edgeDirection[e.id] = e.direction;

    // The token flows only during this edge's beat, over [start, start+travel].
    if (t < start || t > start + dotTravelSeconds || dotTravelSeconds <= 0) {
      dotPositions[e.id] = null;
    } else {
      const flow = Math.min(1, Math.max(0, (t - start) / dotTravelSeconds));
      // dotPositions is geometric (0 at `from`, 1 at `to`); reverse flips it.
      dotPositions[e.id] = e.direction === 'reverse' ? 1 - flow : flow;
    }
  }

  return { nodeOpacity, edgeOpacity, clusterOpacity, dotPositions, edgeDirection };
}
