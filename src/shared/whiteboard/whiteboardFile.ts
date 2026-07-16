import type { DiagramAnnotation } from '../ir/types';

/**
 * On-disk format for a standalone whiteboard document (`name.whiteboard.json`).
 * Wraps the tldraw snapshot and an optional reference to a diagram in the same
 * project to render beneath the sketch as a backdrop. The reference is stored;
 * the rendered backdrop is derived and never stored.
 *
 * This module also absorbs the two legacy shapes the app wrote before whiteboards
 * were standalone: a bare tldraw snapshot object, and a `{ pendingAnnotations }`
 * seed from the old annotation migration. Both are read into the wrapped shape so
 * no other code branches on them.
 */
export interface WhiteboardFile {
  version: 1;
  /** tldraw snapshot object, or null when the sketch is blank. */
  snapshot: unknown | null;
  /** File name of a diagram in the same project to show as backdrop, or null. */
  backdropDiagram: string | null;
  /** Legacy annotation seed; present only until the renderer materializes it. */
  pendingAnnotations?: DiagramAnnotation[];
}

export function emptyWhiteboardFile(): WhiteboardFile {
  return { version: 1, snapshot: null, backdropDiagram: null };
}

export function serializeWhiteboardFile(file: WhiteboardFile): string {
  return JSON.stringify(file);
}

export function isWhiteboardEmpty(file: WhiteboardFile): boolean {
  return file.snapshot == null && !file.backdropDiagram && !file.pendingAnnotations?.length;
}

export function parseWhiteboardFile(text: string | null): WhiteboardFile {
  if (text == null || text.trim() === '') return emptyWhiteboardFile();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return emptyWhiteboardFile();
  }
  if (typeof raw !== 'object' || raw === null) return emptyWhiteboardFile();
  const obj = raw as Record<string, unknown>;

  // Already the wrapped format.
  if (obj.version === 1) {
    return {
      version: 1,
      snapshot: 'snapshot' in obj ? (obj.snapshot ?? null) : null,
      backdropDiagram: typeof obj.backdropDiagram === 'string' ? obj.backdropDiagram : null,
      ...(Array.isArray(obj.pendingAnnotations)
        ? { pendingAnnotations: obj.pendingAnnotations as DiagramAnnotation[] }
        : {}),
    };
  }

  // Legacy annotation seed.
  if (Array.isArray(obj.pendingAnnotations)) {
    return {
      version: 1,
      snapshot: null,
      backdropDiagram: null,
      pendingAnnotations: obj.pendingAnnotations as DiagramAnnotation[],
    };
  }

  // Legacy bare tldraw snapshot, identified by its `store`: migrate to wrapped,
  // no backdrop. Any other unrecognized object is treated as empty (never throw),
  // honoring the corrupt-input contract.
  if ('store' in obj) return { version: 1, snapshot: obj, backdropDiagram: null };
  return emptyWhiteboardFile();
}
