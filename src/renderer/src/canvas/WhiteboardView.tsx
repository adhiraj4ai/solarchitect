import { Tldraw, getSnapshot, loadSnapshot, type Editor } from 'tldraw';
import 'tldraw/tldraw.css';
import { getAssetUrlsByImport } from '@tldraw/assets/imports.vite';
import { useCallback, useRef } from 'react';
import { annotationToShape } from './annotationAdapters';
import type { DiagramAnnotation } from '@shared/ir/types';

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
  onError,
}: {
  projectDir: string | null;
  fileName: string | null;
  onError: (msg: string) => void;
}) {
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleMount = useCallback(
    (editor: Editor) => {
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

  return (
    <div className="whiteboard" data-testid="whiteboard">
      <Tldraw assetUrls={assetUrls} onMount={handleMount} />
    </div>
  );
}
