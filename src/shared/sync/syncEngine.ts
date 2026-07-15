import { serializeDiagram } from '../yaml/serialize';
import { parseDiagram, type ParseResult } from '../yaml/parse';
import type { Diagram } from '../ir/types';

/** A YAML edit either produces a new diagram or a parse/validation error. */
export type YamlEditResult = ParseResult;

/**
 * Coordinates the single in-memory Diagram that both the canvas and the YAML
 * code view project from. Neither view talks to the other directly — they go
 * through this engine.
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

  /**
   * Apply a code-view YAML edit. On success the diagram is replaced and the
   * caller's exact text is retained verbatim (so live typing doesn't fight the
   * editor's cursor). On any parse/validation error the engine freezes: the
   * last-valid diagram and YAML are left untouched and the error is returned.
   */
  applyYamlEdit(yamlText: string): YamlEditResult {
    const result = parseDiagram(yamlText);
    if (!result.ok) return { ok: false, error: result.error };
    this.diagram = result.diagram;
    this.yamlText = yamlText;
    return { ok: true, diagram: result.diagram };
  }
}
