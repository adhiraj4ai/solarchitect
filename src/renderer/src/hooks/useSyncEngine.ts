import { useCallback, useRef, useState } from 'react';
import { SyncEngine } from '@shared/sync/syncEngine';
import { emptyDiagram, type Diagram } from '@shared/ir/types';

/**
 * Owns the single SyncEngine instance and exposes the current YAML + diagram
 * plus a canvas-edit callback. Canvas and code view both read/write through here.
 */
export function useSyncEngine() {
  const engineRef = useRef<SyncEngine>();
  if (!engineRef.current) engineRef.current = new SyncEngine(emptyDiagram());

  const [yamlText, setYamlText] = useState(() => engineRef.current!.getYamlText());
  const [diagram, setDiagram] = useState<Diagram>(() => engineRef.current!.getDiagram());

  const onCanvasEdit = useCallback((next: Diagram) => {
    const result = engineRef.current!.applyCanvasPatch(next);
    setDiagram(next);
    setYamlText(result.yamlText);
  }, []);

  return { yamlText, diagram, onCanvasEdit };
}
