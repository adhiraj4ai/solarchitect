import type { ResolvedOrder } from './order';

/** Global timing for the traversal animation (set in the export/preview UI). */
export interface TimingSettings {
  /** Seconds each beat holds before the next lights. */
  secondsPerStep: number;
  /** Seconds the dim→lit fade takes at a beat's start (clamped to ≤ secondsPerStep). */
  fadeSeconds: number;
  /** Seconds the flow token takes to cross the active edge (clamped to ≤ secondsPerStep). */
  dotTravelSeconds: number;
  /** Seconds to hold the fully-lit diagram at the end. */
  endHoldSeconds: number;
}

export const DEFAULT_TIMING: TimingSettings = {
  secondsPerStep: 1,
  fadeSeconds: 0.35,
  dotTravelSeconds: 0.9,
  endHoldSeconds: 1,
};

/** A timed sequence of beats derived from a resolved order plus timing. */
export interface Timeline {
  /** Distinct order values, ascending; the array index is the beat index. */
  beatValues: number[];
  /** order value → beat start time (seconds). */
  beatStart: Record<number, number>;
  /** Total duration including the end hold (seconds). */
  totalSeconds: number;
  timing: TimingSettings;
}

/**
 * Build a timeline from a resolved order. Distinct order values (across nodes,
 * edges, and clusters) are collapsed to contiguous beats — so pins that leave
 * gaps (0, 2, 5) still play gap-free (beats 0, 1, 2) — each beat starting
 * `secondsPerStep` after the previous.
 */
export function buildTimeline(order: ResolvedOrder, timing: TimingSettings): Timeline {
  const values = new Set<number>();
  for (const v of Object.values(order.nodeOrder)) values.add(v);
  for (const v of Object.values(order.edgeOrder)) values.add(v);
  for (const v of Object.values(order.clusterOrder)) values.add(v);
  const beatValues = [...values].sort((a, b) => a - b);

  const beatStart: Record<number, number> = {};
  beatValues.forEach((v, i) => {
    beatStart[v] = i * timing.secondsPerStep;
  });

  const totalSeconds =
    beatValues.length > 0 ? beatValues.length * timing.secondsPerStep + timing.endHoldSeconds : 0;

  return { beatValues, beatStart, totalSeconds, timing };
}
