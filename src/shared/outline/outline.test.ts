import { describe, it, expect } from 'vitest';
import { buildOutline } from './outline';
import { emptyDiagram, type Diagram } from '../ir/types';

const diagram: Diagram = {
  nodes: [
    { id: 'n1', type: 'aws.compute.EC2', label: 'Web', clusterId: 'c1' },
    { id: 'n2', type: 'aws.database.RDS', label: 'DB', clusterId: 'c1' },
    { id: 'n3', type: 'aws.storage.S3', label: 'Assets' },
    { id: 'n4', type: 'generic.blank', label: 'Orphan', clusterId: 'missing' },
  ],
  edges: [
    { id: 'e1', from: 'n1', to: 'n2', direction: 'forward', label: 'queries' },
    { id: 'e2', from: 'n1', to: 'n3', direction: 'forward' },
  ],
  clusters: [{ id: 'c1', label: 'VPC', x: 0, y: 0, width: 100, height: 100 }],
  annotations: [],
  frames: [{ id: 'f1', label: 'Page 1', x: 0, y: 0, width: 800, height: 600 }],
};

describe('buildOutline', () => {
  it('nests member nodes under their cluster (membership from node.clusterId)', () => {
    const o = buildOutline(diagram);
    expect(o.clusters).toHaveLength(1);
    expect(o.clusters[0].id).toBe('c1');
    expect(o.clusters[0].children.map((n) => n.id)).toEqual(['n1', 'n2']);
  });

  it('lists nodes with no cluster (or a dangling clusterId) as ungrouped', () => {
    const o = buildOutline(diagram);
    expect(o.ungrouped.map((n) => n.id)).toEqual(['n3', 'n4']);
  });

  it('labels edges by their own label, or by from → to node labels', () => {
    const o = buildOutline(diagram);
    expect(o.edges[0].label).toBe('queries');
    expect(o.edges[1].label).toBe('Web → Assets');
  });

  it('lists frames', () => {
    const o = buildOutline(diagram);
    expect(o.frames.map((f) => f.id)).toEqual(['f1']);
  });

  it('reports an empty diagram as empty', () => {
    const o = buildOutline(emptyDiagram());
    expect(o.isEmpty).toBe(true);
  });

  it('reports a non-empty diagram as not empty', () => {
    expect(buildOutline(diagram).isEmpty).toBe(false);
  });
});
