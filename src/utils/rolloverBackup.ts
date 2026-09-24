import type { BudgetRollover } from '../db/schema';

/** Include the complete connected periods so a partial export cannot invent a source balance. */
export function expandRolloverRange(range: { start: string; end: string }, rows: BudgetRollover[]) {
  let { start, end } = range;
  let changed = true;
  while (changed) {
    changed = false;
    for (const r of rows) {
      if ((r.source_start <= end && r.source_end >= start) || (r.target_start <= end && r.target_end >= start)) {
        const nextStart = r.source_start < start ? r.source_start : start;
        const nextEnd = r.target_end > end ? r.target_end : end;
        if (nextStart !== start || nextEnd !== end) { start = nextStart; end = nextEnd; changed = true; }
      }
    }
  }
  return { start, end };
}
