import { Tldraw, react, getSnapshot, loadSnapshot, type Editor } from 'tldraw';
import 'tldraw/tldraw.css';
import { getAssetUrlsByImport } from '@tldraw/assets/imports.vite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { annotationToShape } from './annotationAdapters';
import { DiagramBackdrop } from './DiagramBackdrop';
import { parseWhiteboardFile, serializeWhiteboardFile } from '@shared/whiteboard/whiteboardFile';
import { parseDiagram } from '@shared/yaml/parse';
import { emptyDiagram, type Diagram } from '@shared/ir/types';
import type { DocumentEntry } from '@shared/project/types';

const assetUrls = getAssetUrlsByImport();
const SAVE_DEBOUNCE_MS = 500;

/**
 * The standalone freeform whiteboard document — a plain tldraw editor whose sketch
 * is persisted to its own `name.whiteboard.json` (wrapped format: snapshot +
 * optional backdrop reference). It may name a diagram in the same project to show
 * read-only beneath the sketch; that diagram is read once at open (one document is
 * open at a time, so no live sync is needed). A dangling reference degrades to no
 * backdrop, never an error.
 */
export function WhiteboardView({
  projectDir,
  fileName,
  entries,
  onError,
}: {
  projectDir: string | null;
  fileName: string | null;
  entries: DocumentEntry[];
  onError: (msg: string) => void;
}) {
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  // Whether an edit is waiting on the debounce, so it can be flushed on unmount.
  const dirtyRef = useRef(false);
  // The backdrop layer is transformed to match the whiteboard camera so it lines
  // up with what the user draws over it.
  const backdropRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const [showBackdrop, setShowBackdrop] = useState(true);
  const [backdropDiagram, setBackdropDiagram] = useState<string | null>(null);
  const [backdrop, setBackdrop] = useState<Diagram>(() => emptyDiagram());

  // Keep the current backdrop selection in a ref for the store-listener closure.
  const backdropDiagramRef = useRef<string | null>(null);
  useEffect(() => {
    backdropDiagramRef.current = backdropDiagram;
  }, [backdropDiagram]);

  const diagramOptions = entries.filter((e) => e.type === 'diagram' && e.status === 'ok');

  const loadBackdrop = useCallback(
    async (ref: string | null) => {
      if (!projectDir || !ref) {
        setBackdrop(emptyDiagram());
        return;
      }
      try {
        const text = await window.solarchitect.readDocument(projectDir, ref);
        const result = parseDiagram(text);
        setBackdrop(result.ok ? result.diagram : emptyDiagram());
      } catch {
        setBackdrop(emptyDiagram()); // dangling reference → no backdrop
      }
    },
    [projectDir],
  );

  const persist = useCallback(
    (editor: Editor, ref: string | null) => {
      if (!projectDir || !fileName) return;
      const empty = editor.getCurrentPageShapes().length === 0;
      const file = {
        version: 1 as const,
        snapshot: empty ? null : getSnapshot(editor.store),
        backdropDiagram: ref,
      };
      void window.solarchitect
        .writeDocument(projectDir, fileName, serializeWhiteboardFile(file))
        .catch((e) => onError(`Could not save the whiteboard: ${e instanceof Error ? e.message : String(e)}`));
    },
    [projectDir, fileName, onError],
  );

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      // Keep the read-only diagram backdrop aligned to the whiteboard camera.
      react('whiteboard-backdrop-camera', () => {
        const c = editor.getCamera();
        if (backdropRef.current) {
          backdropRef.current.style.transform = `translate(${c.x * c.z}px, ${c.y * c.z}px) scale(${c.z})`;
        }
      });

      // Load the persisted whiteboard for this document.
      if (projectDir && fileName) {
        void window.solarchitect
          .readDocument(projectDir, fileName)
          .then((raw) => {
            const file = parseWhiteboardFile(raw);
            setBackdropDiagram(file.backdropDiagram);
            void loadBackdrop(file.backdropDiagram);
            if (file.snapshot) {
              loadSnapshot(editor.store, file.snapshot as Parameters<typeof loadSnapshot>[1]);
            } else if (file.pendingAnnotations?.length) {
              // One-time materialization of legacy annotations, then persist a
              // proper snapshot in their place.
              editor.createShapes(file.pendingAnnotations.map(annotationToShape));
              persist(editor, file.backdropDiagram);
            }
          })
          .catch(() => {
            /* missing/corrupt → blank; parseWhiteboardFile already tolerates it */
          });
      }

      // Debounced autosave on user edits.
      editor.store.listen(
        () => {
          dirtyRef.current = true;
          clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => {
            dirtyRef.current = false;
            persist(editor, backdropDiagramRef.current);
          }, SAVE_DEBOUNCE_MS);
        },
        { source: 'user', scope: 'document' },
      );
    },
    [projectDir, fileName, loadBackdrop, persist],
  );

  // Flush a still-pending sketch save on unmount (switching documents right after
  // drawing) rather than dropping it. Guarded: if tldraw has already torn down the
  // editor, skip rather than throw a save error.
  const persistRef = useRef(persist);
  persistRef.current = persist;
  useEffect(
    () => () => {
      clearTimeout(saveTimer.current);
      if (dirtyRef.current && editorRef.current) {
        dirtyRef.current = false;
        try {
          persistRef.current(editorRef.current, backdropDiagramRef.current);
        } catch {
          /* editor already disposed — nothing to flush */
        }
      }
    },
    [],
  );

  const onPickBackdrop = useCallback(
    (ref: string | null) => {
      setBackdropDiagram(ref);
      void loadBackdrop(ref);
      if (editorRef.current) persist(editorRef.current, ref);
    },
    [loadBackdrop, persist],
  );

  const hasBackdrop = backdrop.nodes.length + backdrop.clusters.length + (backdrop.frames?.length ?? 0) > 0;

  return (
    <div className="whiteboard" data-testid="whiteboard">
      {showBackdrop && hasBackdrop && (
        <div className="wb-backdrop" aria-hidden="true">
          <div className="wb-backdrop__layer" ref={backdropRef}>
            <DiagramBackdrop diagram={backdrop} />
          </div>
        </div>
      )}
      <Tldraw assetUrls={assetUrls} onMount={handleMount} />
      <div className="wb-controls">
        <select
          data-testid="backdrop-select"
          className="btn btn--sm"
          value={backdropDiagram ?? ''}
          onChange={(e) => onPickBackdrop(e.target.value || null)}
          title="Show a diagram beneath your sketch"
        >
          <option value="">No backdrop</option>
          {diagramOptions.map((e) => (
            <option key={e.fileName} value={e.fileName}>
              {e.fileName}
            </option>
          ))}
        </select>
        {hasBackdrop && (
          <button
            type="button"
            data-testid="backdrop-toggle"
            className={`btn btn--sm${showBackdrop ? ' btn--on' : ''}`}
            aria-pressed={showBackdrop}
            onClick={() => setShowBackdrop((v) => !v)}
            title="Show/hide the diagram backdrop"
          >
            {showBackdrop ? '◉ Backdrop' : '◎ Backdrop'}
          </button>
        )}
      </div>
    </div>
  );
}
