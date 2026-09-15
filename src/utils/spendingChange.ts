import { fromMinorUnits, toMinorUnits } from './moneyMath';
import { resolveComparableAnalyticsRanges, type AnalyticsDateRange, type AnalyticsTimeframe } from './analyticsPeriod';

export interface CategoryChangeTotal {
  category_id: number | null;
  category_name: string | null;
  total: number;
}
export interface SpendingChangeRow {
  id: string;
  name: string | null;
  current: number;
  previous: number;
  delta: number;
}

export function buildSpendingChange(current: CategoryChangeTotal[], previous: CategoryChangeTotal[]) {
  const rows = new Map<string, { name: string | null; current: number; previous: number }>();
  for (const [side, values] of [['current', current], ['previous', previous]] as const) {
    for (const item of values) {
      const id = item.category_id === null ? 'uncategorized' : String(item.category_id);
      const row = rows.get(id) ?? { name: item.category_name, current: 0, previous: 0 };
      row[side] += toMinorUnits(item.total);
      rows.set(id, row);
    }
  }
  const all: SpendingChangeRow[] = Array.from(rows, ([id, row]) => ({
    id, name: row.name, current: fromMinorUnits(row.current), previous: fromMinorUnits(row.previous),
    delta: fromMinorUnits(row.current - row.previous),
  })).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.id.localeCompare(b.id));
  const delta = fromMinorUnits(all.reduce((sum, row) => sum + toMinorUnits(row.delta), 0));
  const changed = all.filter(row => row.delta !== 0);
  const visible = changed.slice(0, 4);
  if (changed.length > 4) {
    const rest = changed.slice(4);
    visible.push({ id: 'rest', name: null,
      current: fromMinorUnits(rest.reduce((n, r) => n + toMinorUnits(r.current), 0)),
      previous: fromMinorUnits(rest.reduce((n, r) => n + toMinorUnits(r.previous), 0)),
      delta: fromMinorUnits(rest.reduce((n, r) => n + toMinorUnits(r.delta), 0)),
    });
  }
  return { delta, rows: visible, all };
}

export function resolveSpendingChangeRanges(timeframe: AnalyticsTimeframe, range: AnalyticsDateRange, cycleDay: number, now = new Date()) {
  if (timeframe !== 'year') return resolveComparableAnalyticsRanges(timeframe, range, cycleDay, now);
  const year = now.getFullYear();
  const elapsed = Math.round((Date.UTC(year, now.getMonth(), now.getDate()) - Date.UTC(year, 0, 1)) / 86400000);
  const previousDays = Math.round((Date.UTC(year, 0, 1) - Date.UTC(year - 1, 0, 1)) / 86400000);
  const days = Math.min(elapsed, previousDays);
  if (days === 0) return null;
  const end = (y: number) => new Date(Date.UTC(y, 0, days)).toISOString().slice(0, 10);
  return { current: { start: `${year}-01-01`, end: end(year) }, previous: { start: `${year - 1}-01-01`, end: end(year - 1) }, completedDays: days };
}
