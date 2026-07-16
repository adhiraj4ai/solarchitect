import { describe, it, expect } from 'vitest';
import { searchProject, hasResults } from './search';
import type { Diagram } from '../ir/types';

const diagram: Diagram = {
  nodes: [
    { id: 'n1', type: 'aws.compute.EC2', label: 'Web server' },
    { id: 'n2', type: 'aws.database.RDS', label: 'Primary DB' },
  ],
  edges: [],
  clusters: [{ id: 'c1', label: 'Web tier', x: 0, y: 0, width: 10, height: 10 }],
  annotations: [],
  frames: [],
};

const fileNames = ['payments.yaml', 'web-overview.yaml', 'billing.yaml'];

describe('searchProject', () => {
  it('returns nothing for an empty query', () => {
    const r = searchProject({ query: '  ', fileNames, diagram });
    expect(hasResults(r)).toBe(false);
  });

  it('matches diagram file names across the project, case-insensitively', () => {
    const r = searchProject({ query: 'WEB', fileNames, diagram });
    expect(r.diagrams.map((d) => d.fileName)).toEqual(['web-overview.yaml']);
  });

  it('matches node and cluster labels within the open diagram', () => {
    const r = searchProject({ query: 'web', fileNames, diagram });
    // node "Web server" and cluster "Web tier"
    expect(r.elements.map((e) => e.id).sort()).toEqual(['c1', 'n1']);
    expect(r.elements.find((e) => e.id === 'c1')?.elementKind).toBe('cluster');
    expect(r.elements.find((e) => e.id === 'n1')?.elementKind).toBe('node');
  });

  it('searches names only when no diagram is open', () => {
    const r = searchProject({ query: 'payments', fileNames, diagram: null });
    expect(r.diagrams.map((d) => d.fileName)).toEqual(['payments.yaml']);
    expect(r.elements).toEqual([]);
  });

  it('reports no results when nothing matches', () => {
    expect(hasResults(searchProject({ query: 'zzz', fileNames, diagram }))).toBe(false);
  });
});
