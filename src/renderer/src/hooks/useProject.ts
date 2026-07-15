import { useCallback, useState } from 'react';
import { parseDiagram } from '@shared/yaml/parse';
import type { Diagram } from '@shared/ir/types';
import type { DiagramFileEntry, GitStatus } from '@shared/project/types';

/**
 * Project = a folder of diagram YAML files. Owns the open folder, its diagram
 * list, the current file, and git state, and drives load/save/sync through the
 * preload bridge.
 */
export function useProject(loadDiagram: (d: Diagram) => void) {
  const [projectDir, setProjectDir] = useState<string | null>(null);
  const [entries, setEntries] = useState<DiagramFileEntry[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [ioError, setIoError] = useState<string | null>(null);
  const [git, setGit] = useState<GitStatus | null>(null);
  const [syncing, setSyncing] = useState(false);

  const refreshGit = useCallback(async (dir: string) => {
    try {
      setGit(await window.solarchitect.gitStatus(dir));
    } catch {
      setGit(null);
    }
  }, []);

  const refresh = useCallback(
    async (dir: string) => {
      setEntries(await window.solarchitect.listDiagrams(dir));
      await refreshGit(dir);
    },
    [refreshGit],
  );

  const openAt = useCallback(
    async (dir: string, file?: string) => {
      setProjectDir(dir);
      setCurrentFile(null);
      await refresh(dir);
      if (file) {
        // openDiagram needs projectDir set; read directly here to avoid a stale closure.
        try {
          const text = await window.solarchitect.readDiagram(dir, file);
          const result = parseDiagram(text);
          if (result.ok) {
            loadDiagram(result.diagram);
            setCurrentFile(file);
          }
        } catch {
          /* listed with an error badge; ignore here */
        }
      }
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
      if (result) await openAt(result.dir, result.fileName);
    } catch (e) {
      setIoError(`Could not create project: ${(e as Error).message}`);
    }
  }, [openAt]);

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

  const sync = useCallback(async () => {
    if (!projectDir || syncing) return;
    setSyncing(true);
    try {
      const result = await window.solarchitect.gitSync(projectDir, 'Update diagrams (Solarchitect)');
      setIoError(result.message); // surfaced in the toast (success or failure)
      await refreshGit(projectDir);
    } catch (e) {
      setIoError(`Git sync failed: ${(e as Error).message}`);
    } finally {
      setSyncing(false);
    }
  }, [projectDir, syncing, refreshGit]);

  return {
    projectDir,
    entries,
    currentFile,
    ioError,
    git,
    syncing,
    setIoError,
    dismissError: () => setIoError(null),
    openProject,
    newProject,
    openDiagram,
    newDiagram,
    saveDiagram,
    sync,
  };
}
