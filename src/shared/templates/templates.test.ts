import { describe, it, expect } from 'vitest';
import { extractTemplate, instantiateTemplate } from './templates';
import type { Diagram } from '../ir/types';

const diagram: Diagram = {
  nodes: [
    { id: 'n1', type: 'aws.compute.EC2', label: 'Web', x: 0, y: 0, clusterId: 'c1' },
    { id: 'n2', type: 'aws.database.RDS', label: 'DB', x: 100, y: 0, clusterId: 'c1' },
    { id: 'n3', type: 'aws.compute.EC2', label: 'Other', x: 500, y: 500 },
  ],
  edges: [
    { id: 'e1', from: 'n1', to: 'n2', direction: 'forward', label: 'reads' },
    { id: 'e2', from: 'n1', to: 'n3', direction: 'forward' },
  ],
  clusters: [{ id: 'c1', label: 'VPC', x: -10, y: -10, width: 300, height: 200 }],
  annotations: [],
};

describe('extractTemplate', () => {
  it('extracts only the selected nodes, their cluster, and edges between selected nodes', () => {
    const t = extractTemplate(diagram, new Set(['n1', 'n2']));
    expect(t.nodes.map((n) => n.id).sort()).toEqual(['n1', 'n2']);
    expect(t.edges).toEqual([{ id: 'e1', from: 'n1', to: 'n2', direction: 'forward', label: 'reads' }]);
    expect(t.clusters.map((c) => c.id)).toEqual(['c1']);
    expect(t.annotations).toEqual([]);
  });

  it('omits edges that reach an unselected node', () => {
    const t = extractTemplate(diagram, new Set(['n1', 'n3']));
    // e2 (n1->n3) is included since both selected; e1 (n1->n2) excluded (n2 not selected)
    expect(t.edges.map((e) => e.id)).toEqual(['e2']);
  });

  it('omits a cluster no selected node belongs to', () => {
    const t = extractTemplate(diagram, new Set(['n3']));
    expect(t.clusters).toEqual([]);
  });
});

describe('instantiateTemplate', () => {
  const template: Diagram = {
    nodes: [
      { id: 'n1', type: 'aws.compute.EC2', label: 'Web', x: 10, y: 20, clusterId: 'c1' },
      { id: 'n2', type: 'aws.database.RDS', label: 'DB', x: 110, y: 20, clusterId: 'c1' },
    ],
    edges: [{ id: 'e1', from: 'n1', to: 'n2', direction: 'forward' }],
    clusters: [{ id: 'c1', label: 'VPC', x: 0, y: 0, width: 260, height: 120 }],
    annotations: [],
  };

  it('reassigns all ids and remaps edge/cluster references consistently', () => {
    let i = 0;
    const inst = instantiateTemplate(template, { x: 0, y: 0 }, () => `g${i++}`);
    // No original id survives.
    const allIds = [...inst.nodes.map((n) => n.id), ...inst.edges.map((e) => e.id), ...inst.clusters.map((c) => c.id)];
    expect(allIds.every((id) => id.startsWith('g'))).toBe(true);
    // Edge endpoints point at the new node ids.
    expect(inst.edges[0].from).toBe(inst.nodes[0].id);
    expect(inst.edges[0].to).toBe(inst.nodes[1].id);
    // Node clusterId points at the new cluster id.
    expect(inst.nodes[0].clusterId).toBe(inst.clusters[0].id);
  });

  it('offsets positions so the template min-corner lands at the drop point', () => {
    let i = 0;
    const inst = instantiateTemplate(template, { x: 500, y: 300 }, () => `g${i++}`);
    // The cluster is the min corner (x:0,y:0) → lands exactly at the drop point.
    expect(inst.clusters[0].x).toBe(500);
    expect(inst.clusters[0].y).toBe(300);
    // Relative offsets preserved: node n1 was (10,20) from min-corner (0,0).
    expect(inst.nodes[0].x).toBe(510);
    expect(inst.nodes[0].y).toBe(320);
  });

  it('preserves edge label and direction', () => {
    const withLabel: Diagram = {
      ...template,
      edges: [{ id: 'e1', from: 'n1', to: 'n2', direction: 'bidirectional', label: 'sync' }],
    };
    let i = 0;
    const inst = instantiateTemplate(withLabel, { x: 0, y: 0 }, () => `g${i++}`);
    expect(inst.edges[0].direction).toBe('bidirectional');
    expect(inst.edges[0].label).toBe('sync');
  });
});
