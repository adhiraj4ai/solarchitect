import { useState } from 'react';
import {
  ANIMATION_STYLES,
  isBuiltinPreset,
  type AnimationPreset,
  type AnimationStyle,
} from '@shared/animation/presets';

const STYLE_LABEL: Record<AnimationStyle, string> = {
  'all-edges': 'All edges',
  dataflow: 'Dataflow',
  'control-flow': 'Control flow',
  'end-to-end': 'End-to-end',
};

/**
 * The Animations panel: the preset library. Lists built-in + custom presets,
 * lets the user pick the active one (what Play / scrub / export run), and
 * create / duplicate / delete / edit custom presets. Built-ins are read-only
 * but can be duplicated to customize.
 */
export function AnimationsPanel({
  presets,
  activeId,
  onSelectActive,
  onCreate,
  onDuplicate,
  onUpdate,
  onDelete,
}: {
  presets: AnimationPreset[];
  activeId: string;
  onSelectActive: (id: string) => void;
  onCreate: () => void;
  onDuplicate: (id: string) => void;
  onUpdate: (preset: AnimationPreset) => void;
  onDelete: (id: string) => void;
}) {
  const active = presets.find((p) => p.id === activeId) ?? presets[0];

  return (
    <div className="animations">
      <div className="animations__head">
        <span className="eyebrow">Animations</span>
        <button data-testid="anim-new" className="btn btn--sm" onClick={onCreate}>
          New
        </button>
      </div>

      <div className="animations-list" data-testid="animations-list">
        {presets.map((p) => (
          <div key={p.id} className={`anim-item${p.id === activeId ? ' on' : ''}`} data-testid={`anim-item-${p.id}`}>
            <button
              className="anim-item__pick"
              aria-pressed={p.id === activeId}
              title="Set as the active animation"
              onClick={() => onSelectActive(p.id)}
            >
              <span className="anim-item__name">{p.name}</span>
              <span className="anim-item__style">{STYLE_LABEL[p.style]}</span>
            </button>
            <button className="anim-item__act" title="Duplicate to customize" onClick={() => onDuplicate(p.id)}>
              ⧉
            </button>
            {!isBuiltinPreset(p.id) && (
              <button
                className="anim-item__act"
                data-testid={`anim-delete-${p.id}`}
                title="Delete preset"
                onClick={() => onDelete(p.id)}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      {active && (
        <PresetEditor key={active.id} preset={active} readOnly={isBuiltinPreset(active.id)} onUpdate={onUpdate} />
      )}
    </div>
  );
}

function PresetEditor({
  preset,
  readOnly,
  onUpdate,
}: {
  preset: AnimationPreset;
  readOnly: boolean;
  onUpdate: (preset: AnimationPreset) => void;
}) {
  const [draft, setDraft] = useState<AnimationPreset>(preset);

  // Push a field change up immediately (settings persistence is debounced there).
  const patch = (p: Partial<AnimationPreset>) => {
    const next = { ...draft, ...p };
    setDraft(next);
    onUpdate(next);
  };
  const num = (value: string, fallback: number) => {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  return (
    <div className="anim-editor" data-testid="anim-editor">
      <div className="animations__head">
        <span className="eyebrow">{readOnly ? 'Built-in (read-only)' : 'Edit preset'}</span>
      </div>
      <label className="props-field">
        <span className="props-field__label">Name</span>
        <input
          className="props-input"
          data-testid="anim-name"
          disabled={readOnly}
          value={draft.name}
          onChange={(e) => patch({ name: e.target.value })}
        />
      </label>
      <label className="props-field">
        <span className="props-field__label">Style</span>
        <select
          data-testid="anim-style"
          disabled={readOnly}
          value={draft.style}
          onChange={(e) => patch({ style: e.target.value as AnimationStyle })}
        >
          {ANIMATION_STYLES.map((s) => (
            <option key={s} value={s}>
              {STYLE_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="props-field">
        <span className="props-field__label">Seconds / step</span>
        <input
          type="number"
          min={0.2}
          step={0.1}
          className="props-input"
          disabled={readOnly}
          value={draft.secondsPerStep}
          onChange={(e) => patch({ secondsPerStep: num(e.target.value, draft.secondsPerStep) })}
        />
      </label>
      <label className="props-field">
        <span className="props-field__label">Token travel (s)</span>
        <input
          type="number"
          min={0.1}
          step={0.1}
          className="props-input"
          disabled={readOnly}
          value={draft.dotTravelSeconds}
          onChange={(e) => patch({ dotTravelSeconds: num(e.target.value, draft.dotTravelSeconds) })}
        />
      </label>
      <label className="props-field">
        <span className="props-field__label">Fade (s)</span>
        <input
          type="number"
          min={0}
          step={0.05}
          className="props-input"
          disabled={readOnly}
          value={draft.fadeSeconds}
          onChange={(e) => patch({ fadeSeconds: num(e.target.value, draft.fadeSeconds) })}
        />
      </label>
      <label className="props-field">
        <span className="props-field__label">Loop</span>
        <select
          data-testid="anim-loop"
          disabled={readOnly}
          value={draft.loop}
          onChange={(e) => patch({ loop: e.target.value as 'once' | 'forever' })}
        >
          <option value="once">Play once</option>
          <option value="forever">Loop forever</option>
        </select>
      </label>
    </div>
  );
}
