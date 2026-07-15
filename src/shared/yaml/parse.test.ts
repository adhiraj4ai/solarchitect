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

  it('rejects a node referencing an unknown cluster', () => {
    const result = parseDiagram(`
nodes:
  - id: n1
    type: aws.compute.EC2
    label: Web
    x: 0
    y: 0
    clusterId: ghost
edges: []
clusters: []
annotations: []
`);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/unknown cluster/);
      expect(result.error.path).toBe('nodes[0].clusterId');
    }
  });

  it('accepts a node referencing a defined cluster', () => {
    const result = parseDiagram(`
nodes:
  - id: n1
    type: aws.compute.EC2
    label: Web
    x: 0
    y: 0
    clusterId: c1
edges: []
clusters:
  - id: c1
    label: VPC
    x: 0
    y: 0
    width: 200
    height: 120
annotations: []
`);
    expect(result.ok).toBe(true);
  });

  it('parses and round-trips an edge routing shape', () => {
    const result = parseDiagram(`nodes:
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
    from: n1
    to: n2
    direction: forward
    shape: bent
clusters: []
annotations: []
`);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.diagram.edges[0].shape).toBe('bent');
  });

  it('rejects an invalid edge shape', () => {
    const result = parseDiagram(`nodes:
  - id: n1
    type: aws.compute.EC2
    label: A
    x: 0
    y: 0
edges:
  - id: e1
    from: n1
    to: n1
    direction: forward
    shape: zigzag
clusters: []
annotations: []
`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/shape must be/i);
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
