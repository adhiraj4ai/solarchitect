import { useEffect, useRef, useState } from 'react';
import type { ParseError } from '@shared/yaml/parse';

const DEBOUNCE_MS = 300;

/**
 * Editable YAML view of the diagram.
 *
 * The editor holds a local draft. External (canvas-originated) changes to
 * `yamlText` are synced into the draft; the user's own keystrokes are debounced
 * and pushed out via `onYamlEdit`. On a parse error the engine freezes and
 * `yamlError` is shown inline while the user's (invalid) draft is left intact
 * so they can fix it in place.
 */
export function YamlCodeEditor({
  yamlText,
  yamlError,
  canvasEditSeq,
  onYamlEdit,
}: {
  yamlText: string;
  yamlError: ParseError | null;
  canvasEditSeq: number;
  onYamlEdit: (text: string) => void;
}) {
  const [draft, setDraft] = useState(yamlText);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Pull in canvas-originated changes only (keyed on canvasEditSeq, not yamlText).
  // Keying on yamlText would echo the user's own accepted edits back and could
  // clobber a keystroke that raced the re-render, or overwrite a frozen invalid
  // draft with the last-valid text.
  useEffect(() => {
    setDraft(yamlText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasEditSeq]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  function handleChange(text: string) {
    setDraft(text);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onYamlEdit(text), DEBOUNCE_MS);
  }

  return (
    <div className="code">
      <div className="code__head">
        <span className="eyebrow">Source · YAML</span>
        <span className="eyebrow" style={{ color: yamlError ? 'var(--danger-ink)' : 'var(--faint)' }}>
          {yamlError ? 'frozen — fix to resume' : 'live ⇄ canvas'}
        </span>
      </div>
      <textarea
        className={`code__area${yamlError ? ' has-error' : ''}`}
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        spellCheck={false}
        aria-label="Diagram YAML"
      />
      {yamlError && (
        <div role="alert" className="code__error">
          {yamlError.path ? `${yamlError.path}: ` : ''}
          {yamlError.message}
        </div>
      )}
    </div>
  );
}
