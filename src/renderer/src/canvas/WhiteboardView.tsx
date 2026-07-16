import { Tldraw, react, getSnapshot, loadSnapshot, type Editor } from 'tldraw';
import 'tldraw/tldraw.css';
import { getAssetUrlsByImport } from '@tldraw/assets/imports.vite';
import { useCallback, useRef, useState } from 'react';
import { annotationToShape } from './annotationAdapters';
import { DiagramBackdrop } from './DiagramBackdrop';
import type { Diagram, DiagramAnnotation } from '@shared/ir/types';

const assetUrls = getAssetUrlsByImport();
const SAVE_DEBOUNCE_MS = 500;

/**
 * The freeform whiteboard surface — a plain tldraw editor, entirely separate
 * from the structured diagram canvas. Its sketch is loaded from and saved to
 * the diagram's `<base>.whiteboard.json` sidecar. Mount it keyed by the current
 * file so switching documents loads the right sketch.
 */
export function WhiteboardView({
  projectDir,
  fileName,
  diagram,
  onError,
}: {
  projectDir: string | null;
  fileName: string | null;
  diagram: Diagram;
  onError: (msg: string) => void;
}) {
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  // The backdrop layer is transformed to match the whiteboard camera so it
  // lines up with what the user draws over it.
  const backdropRef = useRef<HTMLDivElement>(null);
  const [showBackdrop, setShowBackdrop] = useState(true);

  const handleMount = useCallback(
    (editor: Editor) => {
      // Keep the read-only diagram backdrop aligned to the whiteboard camera.
      react('whiteboard-backdrop-camera', () => {
        const c = editor.getCamera();
        if (backdropRef.current) {
          backdropRef.current.style.transform = `translate(${c.x * c.z}px, ${c.y * c.z}px) scale(${c.z})`;
        }
      });

      // Load the persisted sketch (if any) for this document.
      if (projectDir && fileName) {
        void window.solarchitect.readWhiteboard(projectDir, fileName).then((snap) => {
          if (!snap) return;
          try {
            const parsed = JSON.parse(snap) as unknown;
            const pending = (parsed as { pendingAnnotations?: DiagramAnnotation[] }).pendingAnnotations;
            if (Array.isArray(pending)) {
              // One-time migration: materialize legacy annotations as real
              // tldraw shapes, then persist a proper snapshot in their place.
              const shapes = pending.map(annotationToShape);
              if (shapes.length) editor.createShapes(shapes);
              void window.solarchitect.writeWhiteboard(
                projectDir,
                fileName,
                shapes.length ? JSON.stringify(getSnapshot(editor.store)) : null,
              );
            } else {
              loadSnapshot(editor.store, parsed as Parameters<typeof loadSnapshot>[1]);
            }
          } catch {
            /* corrupt sidecar → start blank; the diagram is unaffected */
          }
        });
      }

      // Debounced autosave on user edits. Empty sketch → null, so the sidecar is
      // removed rather than left as an empty file (lazy persistence).
      editor.store.listen(
        () => {
          clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => {
            if (!projectDir || !fileName) return;
            const empty = editor.getCurrentPageShapes().length === 0;
            const snapshot = empty ? null : JSON.stringify(getSnapshot(editor.store));
            void window.solarchitect
              .writeWhiteboard(projectDir, fileName, snapshot)
              .catch((e) => onError(`Could not save the whiteboard: ${e instanceof Error ? e.message : String(e)}`));
          }, SAVE_DEBOUNCE_MS);
        },
        { source: 'user', scope: 'document' },
      );
    },
    [projectDir, fileName, onError],
  );

  const hasDiagram = diagram.nodes.length + diagram.clusters.length + (diagram.frames?.length ?? 0) > 0;

  return (
    <div className="whiteboard" data-testid="whiteboard">
      {showBackdrop && hasDiagram && (
        <div className="wb-backdrop" aria-hidden="true">
          <div className="wb-backdrop__layer" ref={backdropRef}>
            <DiagramBackdrop diagram={diagram} />
          </div>
        </div>
      )}
      <Tldraw assetUrls={assetUrls} onMount={handleMount} />
      {hasDiagram && (
        <button
          type="button"
          data-testid="backdrop-toggle"
          className={`btn btn--sm wb-backdrop-toggle${showBackdrop ? ' btn--on' : ''}`}
          aria-pressed={showBackdrop}
          onClick={() => setShowBackdrop((v) => !v)}
          title="Show the diagram beneath your sketch"
        >
          {showBackdrop ? '◉ Diagram backdrop' : '◎ Diagram backdrop'}
        </button>
      )}
    </div>
  );
}
