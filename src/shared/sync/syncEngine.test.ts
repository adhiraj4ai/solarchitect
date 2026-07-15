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
