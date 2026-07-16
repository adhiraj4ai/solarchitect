import { ipcMain, dialog } from 'electron';
import {
  listDiagrams,
  readDiagram,
  writeDiagram,
  createDiagram,
  readTemplates,
  writeTemplates,
} from './projectManager';
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
    return result.canceled ? null : result.filePaths[0];
  });

  // Create a new project: pick/create a folder, git-init it, and seed a first
  // diagram. Returns the folder and the starter file, or null if cancelled.
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
    const fileName = await createDiagram(dir, 'diagram');
    return { dir, fileName };
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

  ipcMain.handle('project:listDiagrams', (_e, projectDir: string) => listDiagrams(projectDir));
  ipcMain.handle('project:readDiagram', (_e, projectDir: string, fileName: string) =>
    readDiagram(projectDir, fileName),
  );
  ipcMain.handle('project:writeDiagram', (_e, projectDir: string, fileName: string, yamlText: string) =>
    writeDiagram(projectDir, fileName, yamlText),
  );
  ipcMain.handle('project:createDiagram', (_e, projectDir: string, displayName: string) =>
    createDiagram(projectDir, displayName),
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
}
