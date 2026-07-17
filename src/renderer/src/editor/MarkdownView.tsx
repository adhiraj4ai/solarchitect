import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import { headingSlugs } from '@shared/markdown/markdownOutline';

const SAVE_DEBOUNCE_MS = 600;

/**
 * The Markdown document editor: a raw source textarea and a rendered preview
 * (via `marked`), laid out per the shared Preview/Split/Source control. Content
 * is the user's own local file, rendered inside the app's strict CSP with no
 * network access. Like the whiteboard, it owns its persistence and autosaves on
 * change (the diagram-only autosave setting does not apply). Its text is reported
 * up so the Outline and Search panels can index headings.
 */
export function MarkdownView({
  projectDir,
  fileName,
  view,
  revealTarget,
  onError,
  onGitRefresh,
  onTextChange,
}: {
  projectDir: string | null;
  fileName: string | null;
  view: 'visual' | 'split' | 'code';
  revealTarget: { id: string; nonce: number } | null;
  onError: (m: string) => void;
  onGitRefresh: () => void;
  onTextChange: (t: string) => void;
}) {
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  // The latest unsaved text (null when nothing is pending), so a debounced save
  // can be flushed on unmount instead of dropped.
  const pendingSaveRef = useRef<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Load the file once on mount (the parent keys this component by fileName).
  useEffect(() => {
    let cancelled = false;
    if (projectDir && fileName) {
      void window.solarchitect
        .readDocument(projectDir, fileName)
        .then((t) => {
          if (cancelled) return;
          setText(t);
          onTextChange(t);
          setLoaded(true);
        })
        .catch((e) => onError(`Could not open ${fileName}: ${e instanceof Error ? e.message : String(e)}`));
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectDir, fileName]);

  // Write the latest pending text now (used by the debounce and the unmount flush).
  const flushSave = useCallback(() => {
    clearTimeout(saveTimer.current);
    const next = pendingSaveRef.current;
    if (next == null || !projectDir || !fileName) return;
    pendingSaveRef.current = null;
    void window.solarchitect
      .writeDocument(projectDir, fileName, next)
      .then(() => onGitRefresh())
      .catch((e) => onError(`Could not save ${fileName}: ${e instanceof Error ? e.message : String(e)}`));
  }, [projectDir, fileName, onGitRefresh, onError]);

  const onChange = useCallback(
    (next: string) => {
      setText(next);
      onTextChange(next);
      if (!projectDir || !fileName || !loaded) return;
      pendingSaveRef.current = next;
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
    },
    [projectDir, fileName, loaded, onTextChange, flushSave],
  );

  // Flush a still-pending save on unmount (switching documents right after an
  // edit) rather than dropping it. A ref keeps the cleanup's [] deps honest.
  const flushRef = useRef(flushSave);
  flushRef.current = flushSave;
  useEffect(() => () => flushRef.current(), []);

  // Rendered HTML. `marked.parse` is synchronous with the default options.
  const html = useMemo(() => marked.parse(text, { breaks: true }) as string, [text]);

  // Assign stable anchor ids to the rendered headings, in document order, from
  // the same slugger the outline uses — so reveal-to-heading lines up. Ids are
  // derived from each rendered heading's own text (not paired by index against
  // the source parser), so setext headings marked renders but the ATX-only
  // outline skips can't desynchronize the ids.
  useEffect(() => {
    const root = previewRef.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    const ids = headingSlugs(els.map((el) => el.textContent ?? ''));
    els.forEach((el, i) => {
      el.id = `md-${ids[i]}`;
    });
  }, [html]);

  // Reveal-to-heading: scroll the preview to the requested anchor.
  useEffect(() => {
    if (!revealTarget || !previewRef.current) return;
    const el = previewRef.current.querySelector(`#md-${CSS.escape(revealTarget.id)}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [revealTarget]);

  const showSource = view !== 'visual';
  const showPreview = view !== 'code';

  return (
    <div className={`markdown markdown--${view}`} data-testid="markdown">
      {showSource && (
        <textarea
          data-testid="markdown-source"
          className="markdown__source"
          aria-label="Markdown source"
          value={text}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          placeholder="# Start writing…"
        />
      )}
      {showPreview && (
        <div
          ref={previewRef}
          data-testid="markdown-preview"
          className="markdown__preview"
          // Local, user-authored content rendered under the app's strict CSP.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}
