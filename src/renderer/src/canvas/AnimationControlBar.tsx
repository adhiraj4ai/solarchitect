import type { AnimationPreset } from '@shared/animation/presets';
import type { Timeline } from '@shared/animation/timeline';

/**
 * The persistent animation transport docked at the bottom of the canvas. Unlike
 * the old scrubber (which only appeared once playback started), this is always
 * present on a Diagram so the animation feature is discoverable: play/pause, a
 * seekable timeline with beat ticks, an active-preset picker for quick switching,
 * and a gear that opens the full Animations panel.
 *
 * It owns no state — CanvasView passes the traversal state and handlers it already
 * keeps. Seeking before playback engages the preview (see CanvasView.seekTraversal),
 * so the user does not have to press Play first.
 */
export function AnimationControlBar({
  playing,
  running,
  time,
  period,
  timeline,
  showBeatTicks,
  presets,
  activeId,
  onPlayPause,
  onSeek,
  onSelectActive,
  onOpenSettings,
}: {
  /** Whether the preview is engaged at all (App-level traversalPlaying). */
  playing: boolean;
  /** Whether the engaged preview is advancing (vs. paused/scrubbing). */
  running: boolean;
  time: number;
  period: number;
  timeline: Timeline;
  showBeatTicks: boolean;
  presets: AnimationPreset[];
  activeId: string;
  onPlayPause: () => void;
  onSeek: (seconds: number) => void;
  onSelectActive: (id: string) => void;
  onOpenSettings: () => void;
}) {
  const advancing = playing && running;
  const hasTimeline = period > 0;
  // At rest the playhead sits at the start; while engaged it tracks the preview.
  const shown = playing ? Math.min(time, period) : 0;

  return (
    <div className="scrubber anim-bar" data-testid="traversal-scrubber" role="group" aria-label="Animation controls">
      <button
        className="btn btn--sm btn--icon"
        data-testid="scrubber-playpause"
        aria-pressed={advancing}
        aria-label={advancing ? 'Pause' : 'Play'}
        title={advancing ? 'Pause animation' : 'Play animation'}
        onClick={onPlayPause}
      >
        {advancing ? '⏸' : '▶'}
      </button>
      <div className="scrubber__track">
        <input
          type="range"
          className="scrubber__range"
          data-testid="scrubber-range"
          aria-label="Playhead"
          min={0}
          max={Math.max(period, 0.001)}
          step={0.01}
          value={shown}
          disabled={!hasTimeline}
          onChange={(e) => onSeek(Number(e.target.value))}
        />
        {/* Beat markers: click to jump to (and hold on) that beat. */}
        {showBeatTicks &&
          hasTimeline &&
          timeline.beatValues.map((v) => {
            const start = timeline.beatStart[v];
            return (
              <button
                key={v}
                className="scrubber__tick"
                data-testid="scrubber-tick"
                aria-label={`Jump to beat at ${start.toFixed(1)} seconds`}
                title={`Beat at ${start.toFixed(1)}s`}
                style={{ left: `${(start / period) * 100}%` }}
                onClick={() => onSeek(start)}
              />
            );
          })}
      </div>
      <span className="scrubber__time">
        {shown.toFixed(1)} / {period.toFixed(1)}s
      </span>
      <span className="anim-bar__sep" />
      <select
        className="anim-bar__preset"
        data-testid="anim-bar-preset"
        aria-label="Active animation"
        title="Active animation"
        value={activeId}
        onChange={(e) => onSelectActive(e.target.value)}
      >
        {presets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button
        className="btn btn--sm btn--icon"
        data-testid="anim-bar-gear"
        title="Animation settings"
        aria-label="Open animation settings"
        onClick={onOpenSettings}
      >
        ⚙
      </button>
    </div>
  );
}
