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
  readWhiteboard: (projectDir, diagramFileName) =>
    ipcRenderer.invoke('project:readWhiteboard', projectDir, diagramFileName),
  writeWhiteboard: (projectDir, diagramFileName, snapshot) =>
    ipcRenderer.invoke('project:writeWhiteboard', projectDir, diagramFileName, snapshot),
  readTemplates: (projectDir) => ipcRenderer.invoke('project:readTemplates', projectDir),
  writeTemplates: (projectDir, yamlText) => ipcRenderer.invoke('project:writeTemplates', projectDir, yamlText),
  exportImage: (base64Data, suggestedName) => ipcRenderer.invoke('project:exportImage', base64Data, suggestedName),
  newProject: () => ipcRenderer.invoke('project:newProject'),
  gitStatus: (projectDir) => ipcRenderer.invoke('project:gitStatus', projectDir),
  gitSync: (projectDir, message) => ipcRenderer.invoke('project:gitSync', projectDir, message),
  gitInit: (projectDir) => ipcRenderer.invoke('project:gitInit', projectDir),
  gitDetail: (projectDir) => ipcRenderer.invoke('project:gitDetail', projectDir),
  gitCommit: (projectDir, message) => ipcRenderer.invoke('project:gitCommit', projectDir, message),
  gitPush: (projectDir) => ipcRenderer.invoke('project:gitPush', projectDir),
  gitPull: (projectDir) => ipcRenderer.invoke('project:gitPull', projectDir),
  gitCreateBranch: (projectDir, name) => ipcRenderer.invoke('project:gitCreateBranch', projectDir, name),
  gitCheckoutBranch: (projectDir, name) => ipcRenderer.invoke('project:gitCheckoutBranch', projectDir, name),
  readSettings: () => ipcRenderer.invoke('app:readSettings'),
  writeSettings: (settings) => ipcRenderer.invoke('app:writeSettings', settings),
};

contextBridge.exposeInMainWorld('solarchitect', api);
