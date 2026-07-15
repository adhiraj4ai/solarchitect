import { describe, it, expect } from 'vitest';
import { SyncEngine } from './syncEngine';
import { emptyDiagram, type Diagram } from '../ir/types';

describe('SyncEngine', () => {
  it('serializes the initial diagram to YAML on construction', () => {
    const engine = new SyncEngine(emptyDiagram());
    expect(engine.getYamlText()).toContain('nodes: []');
    expect(engine.getDiagram()).toEqual(emptyDiagram());
  });

  it('regenerates YAML after a canvas patch that adds a node', () => {
    const engine = new SyncEngine(emptyDiagram());
    const next: Diagram = {
      ...emptyDiagram(),
      nodes: [{ id: 'n1', type: 'aws.compute.EC2', label: 'Web', x: 42, y: 99 }],
    };
    const { yamlText } = engine.applyCanvasPatch(next);

    expect(yamlText).toContain('id: n1');
    expect(yamlText).toContain('type: aws.compute.EC2');
    expect(yamlText).toContain('x: 42');
    expect(yamlText).toContain('y: 99');
    expect(engine.getYamlText()).toBe(yamlText);
    expect(engine.getDiagram()).toEqual(next);
  });

  it('preserves an exact dropped position through the patch (no auto-layout)', () => {
    const engine = new SyncEngine(emptyDiagram());
    const next: Diagram = {
      ...emptyDiagram(),
      nodes: [{ id: 'n1', type: 'gcp.compute.ComputeEngine', label: 'CE', x: 317, y: 204 }],
    };
    engine.applyCanvasPatch(next);
    expect(engine.getDiagram().nodes[0].x).toBe(317);
    expect(engine.getDiagram().nodes[0].y).toBe(204);
  });
});

const VALID_YAML = `nodes:
  - id: n1
    type: aws.compute.EC2
    label: Web
    x: 0
    y: 0
edges: []
clusters: []
annotations: []
`;

describe('SyncEngine.applyYamlEdit', () => {
  it('applies a valid YAML edit: updates the diagram and stores the text verbatim', () => {
    const engine = new SyncEngine(emptyDiagram());
    const result = engine.applyYamlEdit(VALID_YAML);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.diagram.nodes).toHaveLength(1);
    expect(engine.getDiagram().nodes[0]).toEqual({ id: 'n1', type: 'aws.compute.EC2', label: 'Web', x: 0, y: 0 });
    // Verbatim: the user's exact text is retained (not re-serialized), so typing
    // doesn't fight the editor's cursor.
    expect(engine.getYamlText()).toBe(VALID_YAML);
  });

  it('freezes at the last-valid state on a YAML syntax error', () => {
    const engine = new SyncEngine(emptyDiagram());
    engine.applyYamlEdit(VALID_YAML);
    const diagramBefore = engine.getDiagram();
    const yamlBefore = engine.getYamlText();

    const result = engine.applyYamlEdit('nodes: [this is not: valid');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/YAML syntax error/);
    expect(engine.getDiagram()).toEqual(diagramBefore);
    expect(engine.getYamlText()).toBe(yamlBefore);
  });

  it('freezes at the last-valid state on an unknown node type, naming type and path', () => {
    const engine = new SyncEngine(emptyDiagram());
    engine.applyYamlEdit(VALID_YAML);
    const diagramBefore = engine.getDiagram();

    const result = engine.applyYamlEdit(VALID_YAML.replace('aws.compute.EC2', 'aws.compute.NotReal'));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/Unknown node type/);
      expect(result.error.path).toBe('nodes[0].type');
    }
    expect(engine.getDiagram()).toEqual(diagramBefore);
  });

  it('resumes live sync automatically once the YAML is valid again', () => {
    const engine = new SyncEngine(emptyDiagram());
    engine.applyYamlEdit('nodes: [broken');
    expect(engine.getDiagram()).toEqual(emptyDiagram());

    const result = engine.applyYamlEdit(VALID_YAML);
    expect(result.ok).toBe(true);
    expect(engine.getDiagram().nodes).toHaveLength(1);
  });
});
