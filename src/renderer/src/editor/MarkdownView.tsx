import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import { markdownHeadings } from '@shared/markdown/markdownOutline';

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

  const onChange = useCallback(
    (next: string) => {
      setText(next);
      onTextChange(next);
      if (!projectDir || !fileName || !loaded) return;
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void window.solarchitect
          .writeDocument(projectDir, fileName, next)
          .then(() => onGitRefresh())
          .catch((e) => onError(`Could not save ${fileName}: ${e instanceof Error ? e.message : String(e)}`));
      }, SAVE_DEBOUNCE_MS);
    },
    [projectDir, fileName, loaded, onTextChange, onGitRefresh, onError],
  );

  // Rendered HTML. `marked.parse` is synchronous with the default options.
  const html = useMemo(() => marked.parse(text, { breaks: true }) as string, [text]);

  // Assign stable anchor ids to the rendered headings, in document order, from
  // the same slugger the outline uses — so reveal-to-heading lines up. Done by
  // walking the DOM (not a custom renderer) to stay independent of marked's API.
  useEffect(() => {
    const root = previewRef.current;
    if (!root) return;
    const ids = markdownHeadings(text).map((h) => h.id);
    const els = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
    els.forEach((el, i) => {
      if (ids[i]) el.id = `md-${ids[i]}`;
    });
  }, [html, text]);

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
