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

export function registerIpcHandlers(): void {
  ipcMain.handle('project:openFolder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    return result.canceled ? null : result.filePaths[0];
  });

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
