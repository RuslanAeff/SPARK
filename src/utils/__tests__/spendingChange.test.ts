import { buildSpendingChange, resolveSpendingChangeRanges } from '../spendingChange';
import { sumMoney } from '../moneyMath';
const row = (id: number | null, total: number) => ({ category_id: id, category_name: id === null ? null : `Category ${id}`, total });
describe('spending change', () => {
  it('unions old/new categories, includes uncategorized and adds money exactly', () => {
    const result = buildSpendingChange([row(1, 0.1), row(1, 0.2), row(null, 5)], [row(2, 2)]);
    expect(result.delta).toBe(3.3);
    expect(result.all.find(r => r.id === '1')?.delta).toBe(0.3);
    expect(result.all.find(r => r.id === '2')?.delta).toBe(-2);
    expect(result.all.find(r => r.id === 'uncategorized')?.delta).toBe(5);
  });
  it('keeps the visible breakdown equal to the net total when grouping the remainder', () => {
    const result = buildSpendingChange([1,2,3,4,5,6].map(id => row(id, id)), [row(7, 10)]);
    expect(result.rows).toHaveLength(5);
    expect(result.rows[4].id).toBe('rest');
    expect(sumMoney(result.rows.map(r => r.delta))).toBe(result.delta);
  });
  it('preserves offsetting changes when the total is unchanged', () => {
    const result = buildSpendingChange([row(1, 5)], [row(2, 5)]);
    expect(result.delta).toBe(0);
    expect(result.rows).toHaveLength(2);
    expect(buildSpendingChange([], []).rows).toEqual([]);
  });
  it('uses completed comparable days across budget periods', () => {
    expect(resolveSpendingChangeRanges('month', { start: '2026-08-22', end: '2026-09-21' }, 22, new Date(2026, 8, 15))).toEqual({
      current: { start: '2026-08-22', end: '2026-09-14' }, previous: { start: '2026-07-22', end: '2026-08-14' }, completedDays: 24,
    });
  });
  it('handles yearly leap day progress and has no completed days on January 1', () => {
    const range = { start: '2000-01-01', end: '2099-12-31' };
    expect(resolveSpendingChangeRanges('year', range, 1, new Date(2024, 2, 1))).toEqual({
      current: { start: '2024-01-01', end: '2024-02-29' }, previous: { start: '2023-01-01', end: '2023-03-01' }, completedDays: 60,
    });
    expect(resolveSpendingChangeRanges('year', range, 1, new Date(2026, 0, 1))).toBeNull();
  });
});
