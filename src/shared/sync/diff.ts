export interface Delta<T> {
  add: T[];
  update: T[];
  removeIds: string[];
}

/**
 * Compute the minimal add/update/remove delta between two id-keyed lists.
 * `eq` decides whether an item with the same id changed. Pure — used by the
 * canvas layer to apply only what changed (no full re-render).
 */
export function diffById<T extends { id: string }>(prev: T[], next: T[], eq: (a: T, b: T) => boolean): Delta<T> {
  const prevById = new Map(prev.map((i) => [i.id, i]));
  const nextIds = new Set(next.map((i) => i.id));

  const add: T[] = [];
  const update: T[] = [];
  for (const item of next) {
    const before = prevById.get(item.id);
    if (!before) add.push(item);
    else if (!eq(before, item)) update.push(item);
  }
  const removeIds = prev.filter((i) => !nextIds.has(i.id)).map((i) => i.id);

  return { add, update, removeIds };
}
