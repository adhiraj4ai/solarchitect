import { useCallback, useState } from 'react';
import { parseDiagram } from '@shared/yaml/parse';
import { emptyDiagram, type Diagram } from '@shared/ir/types';
import { documentTypeForFile, type DocumentType } from '@shared/project/documentType';
import type { DocumentEntry } from '@shared/project/types';

/**
 * Project = a folder of typed documents. Owns the open folder, its document list,
 * the current file + its type, and drives load/save/create through the preload
 * bridge. Only diagrams flow into the sync engine; opening a whiteboard or
 * markdown resets the engine to empty so no stale diagram bleeds into chrome.
 */
export function useProject(loadDiagram: (d: Diagram) => void) {
  const [projectDir, setProjectDir] = useState<string | null>(null);
  const [entries, setEntries] = useState<DocumentEntry[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [currentType, setCurrentType] = useState<DocumentType | null>(null);
  const [ioError, setIoError] = useState<string | null>(null);

  const refresh = useCallback(async (dir: string) => {
    setEntries(await window.solarchitect.listDocuments(dir));
  }, []);

  const openDocument = useCallback(
    async (fileName: string) => {
      const dir = projectDir;
      if (!dir) return;
      const type = documentTypeForFile(fileName);
      if (!type) return;
      try {
        if (type === 'diagram') {
          const text = await window.solarchitect.readDocument(dir, fileName);
          const result = parseDiagram(text);
          if (!result.ok) {
            setIoError(`${fileName}: ${result.error.message}`);
            return;
          }
          loadDiagram(result.diagram);
        } else {
          // Whiteboard/markdown own their editors; the sync engine holds nothing.
          loadDiagram(emptyDiagram());
        }
        setCurrentFile(fileName);
        setCurrentType(type);
      } catch (e) {
        setIoError(`Could not open ${fileName}: ${(e as Error).message}`);
      }
    },
    [projectDir, loadDiagram],
  );

  const openAt = useCallback(
    async (dir: string) => {
      setProjectDir(dir);
      setCurrentFile(null);
      setCurrentType(null);
      loadDiagram(emptyDiagram());
      await refresh(dir);
    },
    [refresh, loadDiagram],
  );

  const openProject = useCallback(async () => {
    try {
      const dir = await window.solarchitect.openFolder();
      if (dir) await openAt(dir);
    } catch (e) {
      setIoError(`Could not open project: ${(e as Error).message}`);
    }
  }, [openAt]);

  const newProject = useCallback(async () => {
    try {
      const result = await window.solarchitect.newProject();
      if (result) await openAt(result.dir);
    } catch (e) {
      setIoError(`Could not create project: ${(e as Error).message}`);
    }
  }, [openAt]);

  const newDocument = useCallback(
    async (type: DocumentType) => {
      if (!projectDir) return;
      try {
        const fileName = await window.solarchitect.createDocument(projectDir, type);
        await refresh(projectDir);
        await openDocument(fileName);
      } catch (e) {
        setIoError(`Could not create document: ${(e as Error).message}`);
      }
    },
    [projectDir, refresh, openDocument],
  );

  const saveDocument = useCallback(
    async (text: string) => {
      if (!projectDir || !currentFile) return;
      try {
        await window.solarchitect.writeDocument(projectDir, currentFile, text);
        await refresh(projectDir);
      } catch (e) {
        setIoError(`Could not save ${currentFile}: ${(e as Error).message}`);
      }
    },
    [projectDir, currentFile, refresh],
  );

  return {
    projectDir,
    entries,
    currentFile,
    currentType,
    ioError,
    setIoError,
    dismissError: () => setIoError(null),
    openProject,
    newProject,
    openDocument,
    newDocument,
    saveDocument,
  };
}
