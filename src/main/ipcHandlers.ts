import { ipcMain, dialog, app } from 'electron';
import { join } from 'node:path';
import {
  listDocuments,
  readDocument,
  writeDocument,
  readDocumentAtRef,
  createDocument,
  readTemplates,
  writeTemplates,
} from './projectManager';
import type { DocumentType } from '../shared/project/documentType';
import { readSettings, writeSettings } from './settingsManager';
import type { AppSettings } from '../shared/settings/settings';
import { writeExportedImage } from './exportService';
import {
  gitStatus,
  gitInit,
  gitSync,
  gitDetail,
  gitCommit,
  gitPush,
  gitPull,
  gitCreateBranch,
  gitCheckoutBranch,
} from './gitService';

export function registerIpcHandlers(): void {
  ipcMain.handle('project:openFolder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled || !result.filePaths[0]) return null;
    const dir = result.filePaths[0];
    // Version control should just work: initialize a repo if the folder isn't
    // already under git (gitStatus is true for any ancestor repo, so this never
    // nests a repo inside an existing one).
    const status = await gitStatus(dir);
    if (!status.isRepo) await gitInit(dir);
    return dir;
  });

  // Create a new project: pick/create a folder and git-init it. The project
  // starts empty; the user creates the first document via the New menu.
  ipcMain.handle('project:newProject', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Create or choose a folder for the new project',
      buttonLabel: 'Create project',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const dir = result.filePaths[0];
    const status = await gitStatus(dir);
    if (!status.isRepo) await gitInit(dir);
    return { dir };
  });

  ipcMain.handle('project:gitInit', async (_e, projectDir: string) => {
    await gitInit(projectDir);
    return { ok: true, message: 'Initialized an empty git repository.' };
  });
  ipcMain.handle('project:gitStatus', (_e, projectDir: string) => gitStatus(projectDir));
  ipcMain.handle('project:gitSync', (_e, projectDir: string, message: string) => gitSync(projectDir, message));
  ipcMain.handle('project:gitDetail', (_e, projectDir: string) => gitDetail(projectDir));
  ipcMain.handle('project:gitCommit', (_e, projectDir: string, message: string) => gitCommit(projectDir, message));
  ipcMain.handle('project:gitPush', (_e, projectDir: string) => gitPush(projectDir));
  ipcMain.handle('project:gitPull', (_e, projectDir: string) => gitPull(projectDir));
  ipcMain.handle('project:gitCreateBranch', (_e, projectDir: string, name: string) =>
    gitCreateBranch(projectDir, name),
  );
  ipcMain.handle('project:gitCheckoutBranch', (_e, projectDir: string, name: string) =>
    gitCheckoutBranch(projectDir, name),
  );

  ipcMain.handle('project:listDocuments', (_e, projectDir: string) => listDocuments(projectDir));
  ipcMain.handle('project:readDocument', (_e, projectDir: string, fileName: string) =>
    readDocument(projectDir, fileName),
  );
  ipcMain.handle('project:writeDocument', (_e, projectDir: string, fileName: string, text: string) =>
    writeDocument(projectDir, fileName, text),
  );
  ipcMain.handle('project:readDocumentAtRef', (_e, projectDir: string, fileName: string, ref: string) =>
    readDocumentAtRef(projectDir, fileName, ref),
  );
  ipcMain.handle('project:createDocument', (_e, projectDir: string, type: DocumentType) =>
    createDocument(projectDir, type),
  );
  ipcMain.handle('project:readTemplates', (_e, projectDir: string) => readTemplates(projectDir));
  ipcMain.handle('project:writeTemplates', (_e, projectDir: string, yamlText: string) =>
    writeTemplates(projectDir, yamlText),
  );
  ipcMain.handle('project:exportImage', async (_e, base64Data: string, suggestedName: string) => {
    const result = await dialog.showSaveDialog({ defaultPath: suggestedName });
    if (result.canceled || !result.filePath) return null;
    await writeExportedImage(result.filePath, Buffer.from(base64Data, 'base64'));
    return result.filePath;
  });

  // App settings live in a single JSON file in the user-data dir (per-machine,
  // not per-project). The renderer never touches disk — it goes through here.
  const settingsPath = () => join(app.getPath('userData'), 'settings.json');
  ipcMain.handle('app:readSettings', () => readSettings(settingsPath()));
  ipcMain.handle('app:writeSettings', (_e, settings: AppSettings) => writeSettings(settingsPath(), settings));
}
