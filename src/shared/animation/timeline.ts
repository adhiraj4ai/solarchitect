import type { ResolvedOrder } from './order';
import type { AnimationPreset, AnimationStyle, TravelEasing } from './presets';

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
  /** Opacity of not-yet-reached elements during build-up; absent = engine default. */
  dimOpacity?: number;
  /** Token travel easing; absent = linear. */
  easing?: TravelEasing;
}

export const DEFAULT_TIMING: TimingSettings = {
  secondsPerStep: 1,
  fadeSeconds: 0.35,
  dotTravelSeconds: 0.9,
  endHoldSeconds: 1,
  dimOpacity: 0.15,
  easing: 'linear',
};

/** The finite loop period of a style (seconds), for the scrubber and export.
 *  `all-edges` cycles continuously over one token travel; every other style runs
 *  its beat timeline (build-up + end-hold, or the by-order/by-path wavefront). */
export function animationPeriod(style: AnimationStyle, timeline: Timeline): number {
  return style === 'all-edges' ? timeline.timing.dotTravelSeconds : timeline.totalSeconds;
}

/** Map a preset's motion timing to the engine's TimingSettings. The end-hold is
 *  a fixed default (it's a render-tail concern, not part of a preset's identity). */
export function presetTiming(preset: AnimationPreset): TimingSettings {
  return {
    secondsPerStep: preset.secondsPerStep,
    fadeSeconds: preset.fadeSeconds,
    dotTravelSeconds: preset.dotTravelSeconds,
    endHoldSeconds: DEFAULT_TIMING.endHoldSeconds,
    dimOpacity: preset.dimOpacity,
    easing: preset.travelEasing ?? 'linear',
  };
}

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
