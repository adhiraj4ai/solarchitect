import { describe, it, expect } from 'vitest';
import { serializeDiagram } from './serialize';
import { parseDiagram } from './parse';
import type { Diagram } from '../ir/types';

describe('IR -> YAML -> IR round-trip', () => {
  it('produces an identical empty diagram after a full round-trip', () => {
    const original: Diagram = { nodes: [], edges: [], clusters: [], frames: [] };
    const result = parseDiagram(serializeDiagram(original));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.diagram).toEqual(original);
  });

  it('produces an identical populated diagram after a full round-trip', () => {
    const original: Diagram = {
      nodes: [
        { id: 'n1', type: 'aws.compute.EC2', label: 'Web', x: 10, y: 20, clusterId: 'c1' },
        { id: 'n2', type: 'aws.database.RDS', label: 'DB', x: 100, y: 20 },
      ],
      edges: [{ id: 'e1', from: 'n1', to: 'n2', direction: 'forward', label: 'reads/writes' }],
      clusters: [{ id: 'c1', label: 'VPC', x: 0, y: 0, width: 300, height: 200 }],
      frames: [],
    };
    const yamlText = serializeDiagram(original);
    const result = parseDiagram(yamlText);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.diagram).toEqual(original);
  });

  it('round-trips explicit node and edge steps', () => {
    const original: Diagram = {
      nodes: [
        { id: 'n1', type: 'aws.compute.EC2', label: 'A', step: 0 },
        { id: 'n2', type: 'aws.database.RDS', label: 'B', step: 2 },
      ],
      edges: [{ id: 'e1', from: 'n1', to: 'n2', direction: 'forward', step: 1 }],
      clusters: [],
      frames: [],
    };
    const result = parseDiagram(serializeDiagram(original));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.diagram).toEqual(original);
  });

  it('round-trips reverse and bidirectional edge directions', () => {
    const original: Diagram = {
      nodes: [
        { id: 'n1', type: 'aws.compute.EC2', label: 'A' },
        { id: 'n2', type: 'aws.database.RDS', label: 'B' },
      ],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', direction: 'reverse' },
        { id: 'e2', from: 'n2', to: 'n1', direction: 'bidirectional' },
      ],
      clusters: [],
      frames: [],
    };
    const result = parseDiagram(serializeDiagram(original));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.diagram).toEqual(original);
  });
});
