import { describe, it, expect } from 'vitest';
import { parseDiagram } from './parse';

describe('parseDiagram', () => {
  it('parses an empty diagram', () => {
    const result = parseDiagram('nodes: []\nedges: []\nclusters: []\nannotations: []\n');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.diagram).toEqual({ nodes: [], edges: [], clusters: [], annotations: [] });
    }
  });

  it('parses a minimal valid diagram', () => {
    const result = parseDiagram(`
nodes:
  - id: n1
    type: aws.compute.EC2
    label: Web
    x: 0
    y: 0
edges: []
clusters: []
annotations: []
`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.diagram.nodes).toHaveLength(1);
      expect(result.diagram.nodes[0].type).toBe('aws.compute.EC2');
    }
  });

  it('rejects malformed YAML syntax', () => {
    const result = parseDiagram('nodes: [this is not: valid: yaml');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/YAML syntax error/);
  });

  it('rejects an unknown node type', () => {
    const result = parseDiagram(`
nodes:
  - id: n1
    type: aws.compute.NotReal
    label: Web
    x: 0
    y: 0
edges: []
clusters: []
annotations: []
`);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/Unknown node type/);
      expect(result.error.path).toBe('nodes[0].type');
    }
  });

  it('rejects a null/scalar list item without throwing', () => {
    const result = parseDiagram('nodes:\n  - ~\nedges: []\nclusters: []\nannotations: []\n');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/expected a mapping|must be/i);
  });

  it('rejects a non-array nodes value without throwing', () => {
    const result = parseDiagram('nodes: 42\nedges: []\nclusters: []\nannotations: []\n');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/must be a list|expected a list/i);
  });

  it('rejects a top-level scalar document without throwing', () => {
    const result = parseDiagram('just a string');
    expect(result.ok).toBe(false);
  });

  it('rejects a dangling edge reference', () => {
    const result = parseDiagram(`
nodes:
  - id: n1
    type: aws.compute.EC2
    label: Web
    x: 0
    y: 0
edges:
  - id: e1
    from: n1
    to: does-not-exist
    direction: forward
clusters: []
annotations: []
`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/unknown node id/);
  });
});
