/**
 * Position and grouping rules for the guided workout flow. Kept free of React
 * so the ordering behaviour can be tested without a browser.
 */

export interface LoggedRow {
  id: number;
  setNumber: number;
  completedAt: string | null;
}

export interface RowGroup<T> {
  setNumber: number;
  completed: boolean;
  rows: T[];
}

export interface FlowSet {
  key: string;
  completed: boolean;
}

export interface FlowBlock {
  sets: FlowSet[];
}

export interface FlowPosition {
  exIdx: number;
  setKey: string;
}

/**
 * Rows sharing a set number are one set: the working effort followed by its
 * drops, in insertion order. The set counts as done when its working effort
 * was completed.
 */
export function groupLoggedRows<T extends LoggedRow>(rows: T[]): RowGroup<T>[] {
  const ordered = [...rows].sort(
    (a, b) => a.setNumber - b.setNumber || a.id - b.id
  );
  const grouped = new Map<number, T[]>();
  for (const row of ordered) {
    grouped.set(row.setNumber, [...(grouped.get(row.setNumber) ?? []), row]);
  }
  return [...grouped.entries()].map(([setNumber, group]) => ({
    setNumber,
    completed: !!group[0].completedAt,
    rows: group,
  }));
}

/** Set numbers must stay unique per exercise even after a set is removed. */
export function nextSetNumber(sets: { setNumber: number }[]): number {
  return Math.max(0, ...sets.map((s) => s.setNumber)) + 1;
}

export function firstIncompletePosition(
  blocks: FlowBlock[]
): FlowPosition | null {
  for (let exIdx = 0; exIdx < blocks.length; exIdx++) {
    const set = blocks[exIdx].sets.find((s) => !s.completed);
    if (set) return { exIdx, setKey: set.key };
  }
  return null;
}

/**
 * The next unlogged set after the current one, wrapping past the end to pick up
 * sets skipped earlier. Never returns the set it started from.
 */
export function nextIncompletePosition(
  blocks: FlowBlock[],
  exIdx: number,
  setKey: string
): FlowPosition | null {
  const order: FlowPosition[] = [];
  blocks.forEach((block, i) =>
    block.sets.forEach((set) => order.push({ exIdx: i, setKey: set.key }))
  );
  const at = order.findIndex((p) => p.exIdx === exIdx && p.setKey === setKey);
  const rotated =
    at === -1 ? order : [...order.slice(at + 1), ...order.slice(0, at)];
  return (
    rotated.find((p) => {
      const set = blocks[p.exIdx].sets.find((s) => s.key === p.setKey);
      return set && !set.completed;
    }) ?? null
  );
}
