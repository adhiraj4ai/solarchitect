import { useCallback, useState } from 'react';
import { parseDiagram, extractAnnotations } from '@shared/yaml/parse';
import { serializeDiagram } from '@shared/yaml/serialize';
import type { Diagram } from '@shared/ir/types';
import type { DocumentEntry, GitStatus } from '@shared/project/types';

/**
 * One-time migration: if a diagram's YAML still carries legacy `annotations`,
 * stash them into the whiteboard sidecar (as pending shapes the WhiteboardView
 * materializes on first mount) and rewrite the diagram without them. Only seeds
 * when there's no existing sketch, so it never clobbers a real whiteboard.
 * Best-effort — a failure here must never block opening the diagram.
 */
async function migrateLegacyAnnotations(dir: string, file: string, text: string, diagram: Diagram): Promise<void> {
  try {
    const legacy = extractAnnotations(text);
    if (!legacy.length) return;
    const existing = await window.solarchitect.readWhiteboard(dir, file);
    if (!existing) {
      await window.solarchitect.writeWhiteboard(dir, file, JSON.stringify({ pendingAnnotations: legacy }));
    }
    await window.solarchitect.writeDocument(dir, file, serializeDiagram(diagram));
  } catch {
    /* migration is best-effort; the diagram still opens */
  }
}

/**
 * Project = a folder of diagram YAML files. Owns the open folder, its diagram
 * list, the current file, and git state, and drives load/save/sync through the
 * preload bridge.
 */
export function useProject(loadDiagram: (d: Diagram) => void) {
  const [projectDir, setProjectDir] = useState<string | null>(null);
  const [entries, setEntries] = useState<DocumentEntry[]>([]);
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
      // The store now lists all document types; this ticket keeps the current
      // diagram-only list (the type-grouped view arrives with the surface pivot).
      const docs = await window.solarchitect.listDocuments(dir);
      setEntries(docs.filter((e) => e.type === 'diagram'));
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
          const text = await window.solarchitect.readDocument(dir, file);
          const result = parseDiagram(text);
          if (result.ok) {
            loadDiagram(result.diagram);
            setCurrentFile(file);
            await migrateLegacyAnnotations(dir, file, text, result.diagram);
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
        const text = await window.solarchitect.readDocument(projectDir, fileName);
        const result = parseDiagram(text);
        if (!result.ok) {
          setIoError(`${fileName}: ${result.error.message}`);
          return;
        }
        loadDiagram(result.diagram);
        setCurrentFile(fileName);
        await migrateLegacyAnnotations(projectDir, fileName, text, result.diagram);
      } catch (e) {
        setIoError(`Could not open ${fileName}: ${(e as Error).message}`);
      }
    },
    [projectDir, loadDiagram],
  );

  const newDiagram = useCallback(async () => {
    if (!projectDir) return;
    try {
      const fileName = await window.solarchitect.createDocument(projectDir, 'diagram');
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
        await window.solarchitect.writeDocument(projectDir, currentFile, yamlText);
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
