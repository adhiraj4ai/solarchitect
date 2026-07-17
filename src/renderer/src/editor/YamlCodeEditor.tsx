import { useEffect, useMemo, useRef, useState } from 'react';
import type { ParseError } from '@shared/yaml/parse';
import { highlightYaml } from '@shared/yaml/highlight';

const DEBOUNCE_MS = 300;

/**
 * Editable YAML view of the diagram.
 *
 * The editor holds a local draft. External (canvas-originated) changes to
 * `yamlText` are synced into the draft; the user's own keystrokes are debounced
 * and pushed out via `onYamlEdit`. On a parse error the engine freezes and
 * `yamlError` is shown inline while the user's (invalid) draft is left intact
 * so they can fix it in place.
 *
 * A line-number gutter and a syntax-coloured highlight layer sit behind a
 * transparent textarea (the textarea stays the real, accessible input — tests
 * and screen readers see it). Highlighting is best-effort and never throws, so
 * typing partial YAML only ever changes colours, never crashes the editor.
 */
export function YamlCodeEditor({
  yamlText,
  yamlError,
  canvasEditSeq,
  onYamlEdit,
  full = false,
}: {
  yamlText: string;
  yamlError: ParseError | null;
  canvasEditSeq: number;
  onYamlEdit: (text: string) => void;
  /** True when the editor is the main pane (Code view) rather than the side panel. */
  full?: boolean;
}) {
  const [draft, setDraft] = useState(yamlText);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  // The latest not-yet-committed draft (null when nothing is pending), so we can
  // flush it on unmount instead of dropping it.
  const pendingRef = useRef<string | null>(null);
  // Latest onYamlEdit, for the unmount flush (which has an empty dep array).
  const onYamlEditRef = useRef(onYamlEdit);
  onYamlEditRef.current = onYamlEdit;
  const scrollRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  // Pull in canvas-originated changes only (keyed on canvasEditSeq, not yamlText).
  // Keying on yamlText would echo the user's own accepted edits back and could
  // clobber a keystroke that raced the re-render, or overwrite a frozen invalid
  // draft with the last-valid text.
  useEffect(() => {
    // A canvas edit supersedes any not-yet-committed keystroke draft: drop the
    // pending debounced push so a stale draft can't clobber the canvas change
    // (e.g. typing YAML then immediately connecting nodes on the canvas).
    clearTimeout(debounceRef.current);
    pendingRef.current = null;
    setDraft(yamlText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasEditSeq]);

  // On unmount, flush a still-pending edit rather than dropping it — otherwise
  // switching to Visual view (which unmounts this editor) within the debounce
  // window silently discards the user's typed YAML.
  useEffect(
    () => () => {
      clearTimeout(debounceRef.current);
      if (pendingRef.current !== null) {
        onYamlEditRef.current(pendingRef.current);
        pendingRef.current = null;
      }
    },
    [],
  );

  const html = useMemo(() => highlightYaml(draft), [draft]);
  const lineCount = useMemo(() => draft.split('\n').length, [draft]);

  function handleChange(text: string) {
    setDraft(text);
    pendingRef.current = text;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pendingRef.current = null;
      onYamlEditRef.current(text);
    }, DEBOUNCE_MS);
  }

  // Keep the gutter aligned with vertical scroll (it doesn't scroll horizontally).
  function handleScroll() {
    const s = scrollRef.current;
    const g = gutterRef.current;
    if (s && g) g.style.transform = `translateY(${-s.scrollTop}px)`;
  }

  return (
    <div className={`code${full ? ' code--full' : ''}`}>
      <div className="code__head">
        <span className="eyebrow">Source · YAML</span>
        <span className="eyebrow" style={{ color: yamlError ? 'var(--danger-ink)' : 'var(--faint)' }}>
          {yamlError ? 'frozen — fix to resume' : 'live ⇄ canvas'}
        </span>
      </div>
      <div className={`code__body${yamlError ? ' has-error' : ''}`}>
        <div className="code__gutter" aria-hidden="true">
          <div className="code__gutter-inner" ref={gutterRef}>
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i} className="code__lineno">
                {i + 1}
              </div>
            ))}
          </div>
        </div>
        <div className="code__scroll" ref={scrollRef} onScroll={handleScroll}>
          <div className="code__mirror">
            <pre className="code__hl" aria-hidden="true">
              <code dangerouslySetInnerHTML={{ __html: html }} />
            </pre>
            <textarea
              className="code__area"
              value={draft}
              onChange={(e) => handleChange(e.target.value)}
              onScroll={handleScroll}
              spellCheck={false}
              aria-label="Diagram YAML"
            />
          </div>
        </div>
      </div>
      {yamlError && (
        <div role="alert" className="code__error">
          {yamlError.path ? `${yamlError.path}: ` : ''}
          {yamlError.message}
        </div>
      )}
    </div>
  );
}
