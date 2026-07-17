import { describe, it, expect } from 'vitest';
import { serializeDiagram } from './serialize';
import type { Diagram } from '../ir/types';

describe('serializeDiagram', () => {
  it('serializes an empty diagram', () => {
    const yamlText = serializeDiagram({ nodes: [], edges: [], clusters: [] });
    expect(yamlText).toContain('nodes: []');
    expect(yamlText).toContain('edges: []');
    expect(yamlText).toContain('clusters: []');
    expect(yamlText).not.toContain('annotations');
  });

  it('serializes a node with all required fields', () => {
    const diagram: Diagram = {
      nodes: [{ id: 'n1', type: 'aws.compute.EC2', label: 'Web Server', x: 10, y: 20 }],
      edges: [],
      clusters: [],
    };
    const yamlText = serializeDiagram(diagram);
    expect(yamlText).toContain('id: n1');
    expect(yamlText).toContain('type: aws.compute.EC2');
    expect(yamlText).not.toContain('clusterId');
  });

  it('omits optional fields when absent and includes them when present', () => {
    const diagram: Diagram = {
      nodes: [{ id: 'n1', type: 'aws.compute.EC2', label: 'Web', x: 0, y: 0, clusterId: 'c1' }],
      edges: [{ id: 'e1', from: 'n1', to: 'n1', direction: 'forward', label: 'loop' }],
      clusters: [],
    };
    const yamlText = serializeDiagram(diagram);
    expect(yamlText).toContain('clusterId: c1');
    expect(yamlText).toContain('label: loop');
    // 'forward' is the default direction, so it is omitted from the YAML.
    expect(yamlText).not.toContain('direction');
  });

  it('serializes non-default edge directions but omits forward', () => {
    const yamlText = serializeDiagram({
      nodes: [],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', direction: 'forward' },
        { id: 'e2', from: 'n1', to: 'n3', direction: 'reverse' },
        { id: 'e3', from: 'n1', to: 'n4', direction: 'bidirectional' },
      ],
      clusters: [],
    });
    expect(yamlText).toContain('direction: reverse');
    expect(yamlText).toContain('direction: bidirectional');
    expect(yamlText).not.toContain('direction: forward');
  });
});
