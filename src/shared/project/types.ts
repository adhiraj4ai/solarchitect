/** A diagram file discovered in a project folder, with its validation status. */
export interface DiagramFileEntry {
  fileName: string;
  status: 'ok' | 'error';
  errorMessage?: string;
}
