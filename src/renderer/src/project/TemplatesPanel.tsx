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
    <div style={{ borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div
        style={{
          padding: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#718096' }}>
          Templates
        </span>
        <button
          data-testid="templates-edit-toggle"
          onClick={() => setEditing((v) => !v)}
          style={{ fontSize: 11, background: 'white', border: '1px solid #cbd5e0', borderRadius: 6, cursor: 'pointer', padding: '2px 6px' }}
        >
          {editing ? 'Done' : 'Edit YAML'}
        </button>
      </div>
      {editing ? (
        <TemplatesYamlEditor templatesText={templatesText} yamlError={yamlError} onApplyYaml={onApplyYaml} />
      ) : (
        <div style={{ overflowY: 'auto', maxHeight: 200 }} data-testid="templates-list">
          {templates.length === 0 && (
            <div style={{ padding: '0 10px 8px', fontSize: 12, color: '#a0aec0' }}>
              Select 2+ nodes, then “Save as Template”.
            </div>
          )}
          {templates.map((t) => (
            <div
              key={t.name}
              draggable
              onDragStart={(e) => e.dataTransfer.setData(TEMPLATE_DND_MIME, t.name)}
              style={{
                padding: '6px 10px',
                borderBottom: '1px solid #edf2f7',
                fontSize: 13,
                cursor: 'grab',
                userSelect: 'none',
              }}
              title="Drag onto the canvas to instantiate"
            >
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
    <div style={{ display: 'flex', flexDirection: 'column' }}>
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
        style={{ height: 180, fontFamily: 'monospace', fontSize: 12, border: 'none', resize: 'none', padding: 8, outline: 'none' }}
      />
      {yamlError && (
        <div role="alert" style={{ background: '#fdecea', color: '#611a15', padding: '6px 8px', fontSize: 11 }}>
          {yamlError}
        </div>
      )}
    </div>
  );
}
