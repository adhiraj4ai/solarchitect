import type { DiagramFileEntry } from '@shared/project/types';

// The API surface exposed by the preload bridge (src/preload/index.ts).
export interface SolarchitectApi {
  openFolder(): Promise<string | null>;
  listDiagrams(projectDir: string): Promise<DiagramFileEntry[]>;
  readDiagram(projectDir: string, fileName: string): Promise<string>;
  writeDiagram(projectDir: string, fileName: string, yamlText: string): Promise<void>;
  createDiagram(projectDir: string, displayName: string): Promise<string>;
}

declare global {
  interface Window {
    solarchitect: SolarchitectApi;
  }
}
