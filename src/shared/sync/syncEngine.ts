import { serializeDiagram } from '../yaml/serialize';
import type { Diagram } from '../ir/types';

/**
 * Coordinates the single in-memory Diagram that both the canvas and the YAML
 * code view project from. Neither view talks to the other directly — they go
 * through this engine.
 *
 * v1 slice: canvas -> YAML only (applyCanvasPatch). The reverse direction
 * (applyYamlEdit + shape diffing) is added in ticket #4.
 */
export class SyncEngine {
  private diagram: Diagram;
  private yamlText: string;

  constructor(initial: Diagram) {
    this.diagram = initial;
    this.yamlText = serializeDiagram(initial);
  }

  getYamlText(): string {
    return this.yamlText;
  }

  getDiagram(): Diagram {
    return this.diagram;
  }

  /** Apply a canvas-originated change: replace the diagram and regenerate YAML. */
  applyCanvasPatch(next: Diagram): { yamlText: string } {
    this.diagram = next;
    this.yamlText = serializeDiagram(next);
    return { yamlText: this.yamlText };
  }
}
