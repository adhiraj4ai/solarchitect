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

const TWO_NODES: Diagram = {
  ...emptyDiagram(),
  nodes: [
    { id: 'n1', type: 'aws.compute.EC2', label: 'A', x: 0, y: 0 },
    { id: 'n2', type: 'aws.database.RDS', label: 'B', x: 200, y: 0 },
  ],
};

describe('SyncEngine edges', () => {
  it('adds, updates the label of, and removes an edge through canvas patches', () => {
    const engine = new SyncEngine(TWO_NODES);

    engine.applyCanvasPatch({ ...TWO_NODES, edges: [{ id: 'e1', from: 'n1', to: 'n2', direction: 'forward' }] });
    expect(engine.getYamlText()).toContain('from: n1');
    expect(engine.getYamlText()).toContain('to: n2');

    engine.applyCanvasPatch({
      ...TWO_NODES,
      edges: [{ id: 'e1', from: 'n1', to: 'n2', direction: 'forward', label: 'reads' }],
    });
    expect(engine.getYamlText()).toContain('label: reads');

    engine.applyCanvasPatch({ ...TWO_NODES, edges: [] });
    expect(engine.getDiagram().edges).toHaveLength(0);
  });

  it('accepts a valid edge from a YAML edit', () => {
    const engine = new SyncEngine(TWO_NODES);
    const yaml = serializeWithEdge('n1', 'n2');
    const result = engine.applyYamlEdit(yaml);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.diagram.edges[0]).toMatchObject({ from: 'n1', to: 'n2' });
  });

  it('freezes on a dangling edge reference in a YAML edit', () => {
    const engine = new SyncEngine(TWO_NODES);
    const before = engine.getDiagram();
    const result = engine.applyYamlEdit(serializeWithEdge('n1', 'ghost'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/unknown node id/);
    expect(engine.getDiagram()).toEqual(before);
  });
});

describe('SyncEngine clusters', () => {
  it('adds, updates the label of, and removes a cluster through canvas patches', () => {
    const engine = new SyncEngine(TWO_NODES);

    engine.applyCanvasPatch({
      ...TWO_NODES,
      clusters: [{ id: 'c1', label: 'VPC', x: -10, y: -10, width: 400, height: 200 }],
      nodes: TWO_NODES.nodes.map((n) => ({ ...n, clusterId: 'c1' })),
    });
    expect(engine.getYamlText()).toContain('label: VPC');
    expect(engine.getYamlText()).toContain('clusterId: c1');

    engine.applyCanvasPatch({
      ...TWO_NODES,
      clusters: [{ id: 'c1', label: 'Prod VPC', x: -10, y: -10, width: 400, height: 200 }],
    });
    expect(engine.getYamlText()).toContain('label: Prod VPC');

    engine.applyCanvasPatch({ ...TWO_NODES, clusters: [] });
    expect(engine.getDiagram().clusters).toHaveLength(0);
  });
});

function serializeWithEdge(from: string, to: string): string {
  return `nodes:
  - id: n1
    type: aws.compute.EC2
    label: A
    x: 0
    y: 0
  - id: n2
    type: aws.database.RDS
    label: B
    x: 200
    y: 0
edges:
  - id: e1
    from: ${from}
    to: ${to}
    direction: forward
clusters: []
annotations: []
`;
}
