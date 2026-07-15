import { useEffect, useRef, useState } from 'react';
import type { NamedTemplate } from '@shared/templates/templatesFile';
import { TEMPLATE_DND_MIME } from '../canvas/dnd';

const DEBOUNCE_MS = 300;

export function TemplatesPanel({
  templates,
  templatesText,
  yamlError,
  onApplyYaml,
}: {
  templates: NamedTemplate[];
  templatesText: string;
  yamlError: string | null;
  onApplyYaml: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="templates">
      <div className="templates__head">
        <span className="eyebrow">Templates</span>
        <button
          data-testid="templates-edit-toggle"
          onClick={() => setEditing((v) => !v)}
          className="btn btn--sm"
        >
          {editing ? 'Done' : 'Edit YAML'}
        </button>
      </div>
      {editing ? (
        <TemplatesYamlEditor templatesText={templatesText} yamlError={yamlError} onApplyYaml={onApplyYaml} />
      ) : (
        <div className="templates-list" data-testid="templates-list">
          {templates.length === 0 && (
            <div className="list__empty">Select 2+ nodes, then “Save as Template”.</div>
          )}
          {templates.map((t) => (
            <div
              key={t.name}
              className="template-item"
              draggable
              onDragStart={(e) => e.dataTransfer.setData(TEMPLATE_DND_MIME, t.name)}
              title="Drag onto the canvas to instantiate"
            >
              <span className="grip" aria-hidden="true">⠿</span>
              {t.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplatesYamlEditor({
  templatesText,
  yamlError,
  onApplyYaml,
}: {
  templatesText: string;
  yamlError: string | null;
  onApplyYaml: (text: string) => void;
}) {
  const [draft, setDraft] = useState(templatesText);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Pull in programmatic changes (e.g. a "Save as Template" that appended one).
  useEffect(() => setDraft(templatesText), [templatesText]);
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  return (
    <div className="templates-yaml">
      <textarea
        data-testid="templates-yaml"
        aria-label="Templates YAML"
        value={draft}
        spellCheck={false}
        onChange={(e) => {
          setDraft(e.target.value);
          clearTimeout(debounceRef.current);
          const text = e.target.value;
          debounceRef.current = setTimeout(() => onApplyYaml(text), DEBOUNCE_MS);
        }}
        onBlur={(e) => {
          // Flush immediately so a pending edit isn't lost when the editor is
          // closed (which unmounts it and clears the debounce timer). Read the
          // live value — `draft` state may not have committed yet on a fast blur.
          clearTimeout(debounceRef.current);
          onApplyYaml(e.target.value);
        }}
      />
      {yamlError && (
        <div role="alert" className="yaml-error">
          {yamlError}
        </div>
      )}
    </div>
  );
}
