import { contextBridge, ipcRenderer } from 'electron';
import type { DiagramFileEntry } from '../main/projectManager';

// The renderer never touches the filesystem directly; everything goes through
// this bridge to the main process.
const api = {
  openFolder: (): Promise<string | null> => ipcRenderer.invoke('project:openFolder'),
  listDiagrams: (projectDir: string): Promise<DiagramFileEntry[]> =>
    ipcRenderer.invoke('project:listDiagrams', projectDir),
  readDiagram: (projectDir: string, fileName: string): Promise<string> =>
    ipcRenderer.invoke('project:readDiagram', projectDir, fileName),
  writeDiagram: (projectDir: string, fileName: string, yamlText: string): Promise<void> =>
    ipcRenderer.invoke('project:writeDiagram', projectDir, fileName, yamlText),
  createDiagram: (projectDir: string, displayName: string): Promise<string> =>
    ipcRenderer.invoke('project:createDiagram', projectDir, displayName),
};

contextBridge.exposeInMainWorld('solarchitect', api);

export type SolarchitectApi = typeof api;
