import { describe, it, expect } from 'vitest';
import { diffById } from './diff';

interface Item {
  id: string;
  v: number;
}
const eq = (a: Item, b: Item) => a.v === b.v;

describe('diffById', () => {
  it('detects added items', () => {
    const d = diffById([], [{ id: 'a', v: 1 }], eq);
    expect(d).toEqual({ add: [{ id: 'a', v: 1 }], update: [], removeIds: [] });
  });

  it('detects updated items (by the eq predicate)', () => {
    const d = diffById([{ id: 'a', v: 1 }], [{ id: 'a', v: 2 }], eq);
    expect(d).toEqual({ add: [], update: [{ id: 'a', v: 2 }], removeIds: [] });
  });

  it('detects removed items', () => {
    const d = diffById([{ id: 'a', v: 1 }], [], eq);
    expect(d).toEqual({ add: [], update: [], removeIds: ['a'] });
  });

  it('reports no changes when items are equal', () => {
    const prev = [{ id: 'a', v: 1 }];
    expect(diffById(prev, [{ id: 'a', v: 1 }], eq)).toEqual({ add: [], update: [], removeIds: [] });
  });

  it('handles a mix of add, update, and remove in one pass', () => {
    const prev = [
      { id: 'a', v: 1 },
      { id: 'b', v: 1 },
    ];
    const next = [
      { id: 'b', v: 2 },
      { id: 'c', v: 1 },
    ];
    const d = diffById(prev, next, eq);
    expect(d.add).toEqual([{ id: 'c', v: 1 }]);
    expect(d.update).toEqual([{ id: 'b', v: 2 }]);
    expect(d.removeIds).toEqual(['a']);
  });
});
