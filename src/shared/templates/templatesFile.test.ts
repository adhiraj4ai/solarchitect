import { describe, it, expect } from 'vitest';
import { serializeTemplates, parseTemplates } from './templatesFile';
import type { NamedTemplate } from './templatesFile';

const templates: NamedTemplate[] = [
  {
    name: 'Standard VPC',
    diagram: {
      nodes: [{ id: 'n1', type: 'aws.compute.EC2', label: 'Web', x: 0, y: 0, clusterId: 'c1' }],
      edges: [],
      clusters: [{ id: 'c1', label: 'VPC', x: -10, y: -10, width: 200, height: 120 }],
      frames: [],
      annotations: [],
    },
  },
];

describe('templates file', () => {
  it('round-trips named templates', () => {
    const result = parseTemplates(serializeTemplates(templates));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.templates).toEqual(templates);
  });

  it('parses an empty templates file', () => {
    const result = parseTemplates('templates: []\n');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.templates).toEqual([]);
  });

  it('treats missing/blank content as no templates', () => {
    const result = parseTemplates('');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.templates).toEqual([]);
  });

  it('rejects a template whose diagram has an unknown node type', () => {
    const bad = `templates:
  - name: Bad
    diagram:
      nodes:
        - id: n1
          type: not.a.type
          label: X
          x: 0
          y: 0
      edges: []
      clusters: []
      annotations: []
`;
    const result = parseTemplates(bad);
    expect(result.ok).toBe(false);
  });
});
