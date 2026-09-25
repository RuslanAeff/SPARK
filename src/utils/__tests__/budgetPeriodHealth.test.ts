import { inspectBudgetPeriodHealth } from '../budgetPeriodHealth';
import type { Budget, BudgetRollover } from '../../db/schema';

const budget = (id: number, start: string | null, end: string | null): Budget => ({
  id, monthly_amount: 1000, currency: 'PLN', start_date: start?.slice(0, 7) ?? '2026-01',
  period_start: start, period_end: end, cycle_start_day: 1, active: 1,
});

it('reports overlaps, invalid ranges and orphan rollovers without treating missing months as corruption', () => {
  const rows = [
    budget(1, '2026-01-01', '2026-01-31'),
    budget(2, '2026-01-20', '2026-02-19'),
    budget(3, '2026-04-31', '2026-04-01'),
  ];
  const rollover = {
    uid: 'r1', source_start: '2025-12-01', source_end: '2025-12-31',
    target_start: '2026-01-01', target_end: '2026-01-31', currency: 'PLN', amount_minor: 100,
    created_at: 'x', updated_at: 'x',
  } as BudgetRollover;
  expect(inspectBudgetPeriodHealth(rows, [rollover]).map((issue) => issue.code)).toEqual([
    'invalid_bounds', 'overlap', 'orphan_rollover',
  ]);
});

it('accepts separated saved periods even when unsaved months exist between them', () => {
  expect(inspectBudgetPeriodHealth([
    budget(1, '2026-01-01', '2026-01-31'),
    budget(2, '2026-06-01', '2026-06-30'),
  ], [])).toEqual([]);
});
