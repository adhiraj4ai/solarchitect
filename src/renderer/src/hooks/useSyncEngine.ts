import { useCallback, useRef, useState } from 'react';
import { SyncEngine } from '@shared/sync/syncEngine';
import { emptyDiagram, type Diagram } from '@shared/ir/types';
import type { ParseError } from '@shared/yaml/parse';

const COMMIT_DEBOUNCE_MS = 300;

/**
 * Owns the single SyncEngine plus a session undo/redo history over Diagram
 * snapshots. Canvas edits, YAML edits, and template drops all flow through here,
 * so undo/redo is unified across them. A burst of edits (a drag emits many) is
 * coalesced into one history entry by debouncing the commit.
 */
export function useSyncEngine() {
  const engineRef = useRef<SyncEngine>();
  if (!engineRef.current) engineRef.current = new SyncEngine(emptyDiagram());

  const [yamlText, setYamlText] = useState(() => engineRef.current!.getYamlText());
  const [diagram, setDiagram] = useState<Diagram>(() => engineRef.current!.getDiagram());
  const [yamlError, setYamlError] = useState<ParseError | null>(null);
  const [canvasEditSeq, setCanvasEditSeq] = useState(0);

  // Undo/redo history. baselineRef is the last committed snapshot; pending edits
  // debounce onto it. historyVersion forces re-render so canUndo/canRedo update.
  const pastRef = useRef<Diagram[]>([]);
  const futureRef = useRef<Diagram[]>([]);
  const baselineRef = useRef<Diagram>(engineRef.current.getDiagram());
  const commitTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [, bumpHistory] = useState(0);

  const commitNow = useCallback((next: Diagram) => {
    clearTimeout(commitTimerRef.current);
    if (JSON.stringify(next) !== JSON.stringify(baselineRef.current)) {
      pastRef.current = [...pastRef.current, baselineRef.current];
      baselineRef.current = next;
      futureRef.current = [];
      bumpHistory((v) => v + 1);
    }
  }, []);

  const scheduleCommit = useCallback(
    (next: Diagram) => {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = setTimeout(() => commitNow(next), COMMIT_DEBOUNCE_MS);
    },
    [commitNow],
  );

  const onCanvasEdit = useCallback(
    (next: Diagram) => {
      const result = engineRef.current!.applyCanvasPatch(next);
      setDiagram(next);
      setYamlText(result.yamlText);
      setYamlError(null);
      setCanvasEditSeq((n) => n + 1);
      scheduleCommit(next);
    },
    [scheduleCommit],
  );

  const onYamlEdit = useCallback(
    (text: string) => {
      const result = engineRef.current!.applyYamlEdit(text);
      if (!result.ok) {
        setYamlError(result.error);
        return;
      }
      setYamlError(null);
      setDiagram(result.diagram);
      setYamlText(text);
      scheduleCommit(result.diagram);
    },
    [scheduleCommit],
  );

  // Restore a snapshot onto both views without recording it as a new edit.
  const restore = useCallback((d: Diagram) => {
    engineRef.current!.load(d);
    setDiagram(d);
    setYamlText(engineRef.current!.getYamlText());
    setYamlError(null);
    setCanvasEditSeq((n) => n + 1);
  }, []);

  const loadDiagram = useCallback(
    (next: Diagram) => {
      // Opening a file starts a fresh history.
      clearTimeout(commitTimerRef.current);
      pastRef.current = [];
      futureRef.current = [];
      baselineRef.current = next;
      restore(next);
      bumpHistory((v) => v + 1);
    },
    [restore],
  );

  const undo = useCallback(() => {
    // Flush any pending edit so it becomes the state we undo away from.
    commitNow(engineRef.current!.getDiagram());
    if (pastRef.current.length === 0) return;
    futureRef.current = [...futureRef.current, baselineRef.current];
    const prev = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    baselineRef.current = prev;
    restore(prev);
    bumpHistory((v) => v + 1);
  }, [commitNow, restore]);

  const redo = useCallback(() => {
    commitNow(engineRef.current!.getDiagram());
    if (futureRef.current.length === 0) return;
    pastRef.current = [...pastRef.current, baselineRef.current];
    const next = futureRef.current[futureRef.current.length - 1];
    futureRef.current = futureRef.current.slice(0, -1);
    baselineRef.current = next;
    restore(next);
    bumpHistory((v) => v + 1);
  }, [commitNow, restore]);

  return {
    yamlText,
    diagram,
    yamlError,
    canvasEditSeq,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    onCanvasEdit,
    onYamlEdit,
    loadDiagram,
    undo,
    redo,
  };
}
