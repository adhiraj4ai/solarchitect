import { describe, it, expect } from 'vitest';
import { resolveNodePositions } from './layout';
import { emptyDiagram, type Diagram } from './types';

function diag(nodes: Diagram['nodes']): Diagram {
  return { ...emptyDiagram(), nodes };
}

describe('resolveNodePositions', () => {
  it('leaves explicitly-placed nodes untouched', () => {
    const nodes = resolveNodePositions(diag([{ id: 'a', type: 't', label: 'A', x: 10, y: 20 }]));
    expect(nodes[0]).toMatchObject({ x: 10, y: 20 });
  });

  it('assigns coordinates to coordinate-free nodes', () => {
    const nodes = resolveNodePositions(
      diag([
        { id: 'a', type: 't', label: 'A' },
        { id: 'b', type: 't', label: 'B' },
      ]),
    );
    expect(typeof nodes[0].x).toBe('number');
    expect(typeof nodes[0].y).toBe('number');
    // distinct positions
    expect(`${nodes[0].x},${nodes[0].y}`).not.toBe(`${nodes[1].x},${nodes[1].y}`);
  });

  it('places coordinate-free nodes below explicitly-placed ones', () => {
    const nodes = resolveNodePositions(
      diag([
        { id: 'a', type: 't', label: 'A', x: 0, y: 500 },
        { id: 'b', type: 't', label: 'B' }, // free
      ]),
    );
    expect(nodes[1].y as number).toBeGreaterThan(500);
  });

  it('is deterministic (no churn across calls)', () => {
    const d = diag([
      { id: 'a', type: 't', label: 'A' },
      { id: 'b', type: 't', label: 'B' },
    ]);
    expect(resolveNodePositions(d)).toEqual(resolveNodePositions(d));
  });
});
