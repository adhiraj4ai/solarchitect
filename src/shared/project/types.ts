/** A diagram file discovered in a project folder, with its validation status. */
export interface DiagramFileEntry {
  fileName: string;
  status: 'ok' | 'error';
  errorMessage?: string;
}

/**
 * The API the preload bridge exposes on window.solarchitect. Single source of
 * truth: the preload implementation is typed against this, and the renderer's
 * Window augmentation references it — so the two can't drift.
 */
export interface SolarchitectApi {
  openFolder(): Promise<string | null>;
  listDiagrams(projectDir: string): Promise<DiagramFileEntry[]>;
  readDiagram(projectDir: string, fileName: string): Promise<string>;
  writeDiagram(projectDir: string, fileName: string, yamlText: string): Promise<void>;
  createDiagram(projectDir: string, displayName: string): Promise<string>;
  readTemplates(projectDir: string): Promise<string>;
  writeTemplates(projectDir: string, yamlText: string): Promise<void>;
}
