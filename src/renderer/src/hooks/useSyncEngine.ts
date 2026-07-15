import { useCallback, useRef, useState } from 'react';
import { SyncEngine } from '@shared/sync/syncEngine';
import { emptyDiagram, type Diagram } from '@shared/ir/types';
import type { ParseError } from '@shared/yaml/parse';

/**
 * Owns the single SyncEngine instance and exposes the current YAML + diagram,
 * a canvas-edit callback, a YAML-edit callback, and the current parse error (if
 * any). Canvas and code view both read/write through here.
 */
export function useSyncEngine() {
  const engineRef = useRef<SyncEngine>();
  if (!engineRef.current) engineRef.current = new SyncEngine(emptyDiagram());

  const [yamlText, setYamlText] = useState(() => engineRef.current!.getYamlText());
  const [diagram, setDiagram] = useState<Diagram>(() => engineRef.current!.getDiagram());
  const [yamlError, setYamlError] = useState<ParseError | null>(null);

  const onCanvasEdit = useCallback((next: Diagram) => {
    const result = engineRef.current!.applyCanvasPatch(next);
    setDiagram(next);
    setYamlText(result.yamlText);
    setYamlError(null);
  }, []);

  const onYamlEdit = useCallback((text: string) => {
    const result = engineRef.current!.applyYamlEdit(text);
    if (!result.ok) {
      // Freeze: leave diagram/canvas at last-valid state, surface the error.
      setYamlError(result.error);
      return;
    }
    setYamlError(null);
    setDiagram(result.diagram);
    setYamlText(text);
  }, []);

  return { yamlText, diagram, yamlError, onCanvasEdit, onYamlEdit };
}
