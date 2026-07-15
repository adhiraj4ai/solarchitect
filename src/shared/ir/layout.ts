import type { Diagram, DiagramNode } from './types';

// Auto-layout grid for coordinate-free nodes.
const GRID_COLS = 4;
const GRID_DX = 200;
const GRID_DY = 140;
const ORIGIN_X = 80;
const ORIGIN_Y = 80;
const GAP_BELOW = 120;

function hasCoords(n: DiagramNode): boolean {
  return typeof n.x === 'number' && typeof n.y === 'number';
}

/**
 * Return the diagram's nodes with concrete x/y for every node. Nodes that
 * already have coordinates are returned unchanged; nodes without are placed on
 * a grid below any explicitly-placed nodes, in document order. Deterministic,
 * so repeated calls (e.g. on every reconcile) don't churn positions.
 */
export function resolveNodePositions(diagram: Diagram): DiagramNode[] {
  const placed = diagram.nodes.filter(hasCoords);
  const baseY = placed.length ? Math.max(...placed.map((n) => n.y as number)) + GAP_BELOW : ORIGIN_Y;
  let i = 0;
  return diagram.nodes.map((n) => {
    if (hasCoords(n)) return n;
    const col = i % GRID_COLS;
    const row = Math.floor(i / GRID_COLS);
    i += 1;
    return { ...n, x: ORIGIN_X + col * GRID_DX, y: baseY + row * GRID_DY };
  });
}
