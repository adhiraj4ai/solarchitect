/**
 * The document-type vocabulary and the extension-based classifier that is the
 * single source of truth for a file's type. Pure and framework-free so both the
 * main process (listing) and the renderer (which editor to open) share it.
 *
 * A document's type is decided ENTIRELY by its file name. `templates.yaml` is a
 * project resource, not a document, so it classifies as null.
 */

export type DocumentType = 'diagram' | 'whiteboard' | 'markdown';

export const DOCUMENT_TYPES: DocumentType[] = ['diagram', 'whiteboard', 'markdown'];

/** Human-facing singular name for each document type (menu items, type badge). */
export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  diagram: 'Diagram',
  whiteboard: 'Whiteboard',
  markdown: 'Markdown',
};

export const TEMPLATES_FILE = 'templates.yaml';

/** The canonical extension written for each type when creating a document. */
const EXTENSION_BY_TYPE: Record<DocumentType, string> = {
  diagram: '.yaml',
  whiteboard: '.whiteboard.json',
  markdown: '.md',
};

export function documentExtension(type: DocumentType): string {
  return EXTENSION_BY_TYPE[type];
}

/** All created documents start life as `untitled.<ext>` (disambiguated on collision). */
export function defaultBaseName(_type: DocumentType): string {
  return 'untitled';
}

/**
 * Classify a file name into a document type, or null if it is not a document.
 * Order matters: the most specific suffix (`.whiteboard.json`) is checked before
 * the generic `.json`/`.yaml` so a whiteboard is never mistaken for a plain file.
 */
export function documentTypeForFile(fileName: string): DocumentType | null {
  const lower = fileName.toLowerCase();
  if (lower === TEMPLATES_FILE) return null;
  if (lower.endsWith('.whiteboard.json')) return 'whiteboard';
  if (lower.endsWith('.md')) return 'markdown';
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'diagram';
  return null;
}

export function isDocumentFile(fileName: string): boolean {
  return documentTypeForFile(fileName) !== null;
}
