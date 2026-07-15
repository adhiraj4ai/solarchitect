import { useCallback, useState } from 'react';
import { parseDiagram } from '@shared/yaml/parse';
import type { Diagram } from '@shared/ir/types';
import type { DiagramFileEntry } from '@shared/project/types';

/**
 * Project = a folder of diagram YAML files. Owns the open folder, its diagram
 * list, and the current file, and drives load/save through the preload bridge.
 */
export function useProject(loadDiagram: (d: Diagram) => void) {
  const [projectDir, setProjectDir] = useState<string | null>(null);
  const [entries, setEntries] = useState<DiagramFileEntry[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [ioError, setIoError] = useState<string | null>(null);

  const refresh = useCallback(async (dir: string) => {
    setEntries(await window.solarchitect.listDiagrams(dir));
  }, []);

  const openProject = useCallback(async () => {
    try {
      const dir = await window.solarchitect.openFolder();
      if (!dir) return;
      setProjectDir(dir);
      setCurrentFile(null);
      await refresh(dir);
    } catch (e) {
      setIoError(`Could not open project: ${(e as Error).message}`);
    }
  }, [refresh]);

  const openDiagram = useCallback(
    async (fileName: string) => {
      if (!projectDir) return;
      try {
        const text = await window.solarchitect.readDiagram(projectDir, fileName);
        const result = parseDiagram(text);
        if (!result.ok) {
          setIoError(`${fileName}: ${result.error.message}`);
          return;
        }
        loadDiagram(result.diagram);
        setCurrentFile(fileName);
      } catch (e) {
        setIoError(`Could not open ${fileName}: ${(e as Error).message}`);
      }
    },
    [projectDir, loadDiagram],
  );

  const newDiagram = useCallback(async () => {
    if (!projectDir) return;
    try {
      const fileName = await window.solarchitect.createDiagram(projectDir, 'Untitled');
      await refresh(projectDir);
      await openDiagram(fileName);
    } catch (e) {
      setIoError(`Could not create diagram: ${(e as Error).message}`);
    }
  }, [projectDir, refresh, openDiagram]);

  const saveDiagram = useCallback(
    async (yamlText: string) => {
      if (!projectDir || !currentFile) return;
      try {
        await window.solarchitect.writeDiagram(projectDir, currentFile, yamlText);
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
    ioError,
    dismissError: () => setIoError(null),
    openProject,
    openDiagram,
    newDiagram,
    saveDiagram,
  };
}
