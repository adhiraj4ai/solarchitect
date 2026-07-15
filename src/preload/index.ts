import { contextBridge, ipcRenderer } from 'electron';
import type { SolarchitectApi } from '../shared/project/types';

// The renderer never touches the filesystem directly; everything goes through
// this bridge to the main process. Typed against the shared SolarchitectApi so
// it can't drift from the renderer's window augmentation.
const api: SolarchitectApi = {
  openFolder: () => ipcRenderer.invoke('project:openFolder'),
  listDiagrams: (projectDir) => ipcRenderer.invoke('project:listDiagrams', projectDir),
  readDiagram: (projectDir, fileName) => ipcRenderer.invoke('project:readDiagram', projectDir, fileName),
  writeDiagram: (projectDir, fileName, yamlText) =>
    ipcRenderer.invoke('project:writeDiagram', projectDir, fileName, yamlText),
  createDiagram: (projectDir, displayName) => ipcRenderer.invoke('project:createDiagram', projectDir, displayName),
};

contextBridge.exposeInMainWorld('solarchitect', api);
