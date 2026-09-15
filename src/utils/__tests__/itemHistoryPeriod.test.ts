import { filterItemHistory, summarizeItemHistory } from '../itemHistoryPeriod';

const row = (date: string, total_price = 1, quantity = 1) => ({ date, total_price, quantity });

describe('item history periods', () => {
  it('includes both local calendar boundaries and excludes tomorrow', () => {
    const rows = ['2026-02-28', '2026-03-01', '2026-03-30', '2026-03-31'].map(date => row(date));
    expect(filterItemHistory(rows, 30, new Date(2026, 2, 30, 23)).map(r => r.date))
      .toEqual(['2026-03-01', '2026-03-30']);
    expect(filterItemHistory(rows, 'all', new Date(2026, 2, 30))).toEqual(rows);
  });

  it.each([90, 365] as const)('handles year boundaries for %i days', period => {
    const end = new Date(2026, 0, 10);
    const start = new Date(2026, 0, 10 - period + 1);
    const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const first = row(key(start));
    start.setDate(start.getDate() - 1);
    expect(filterItemHistory([row(key(start)), first, row('2026-01-10')], period, end))
      .toEqual([first, row('2026-01-10')]);
  });

  it('uses exact money totals and quantity-weighted prices, including empty ranges', () => {
    expect(summarizeItemHistory([row('2026-01-01', 0.1, 0.5), row('2026-01-02', 0.2, 1.5)]))
      .toEqual({ total_spent: 0.3, total_quantity: 2, purchase_count: 2, avg_price: 0.15 });
    expect(summarizeItemHistory([])).toEqual({ total_spent: 0, total_quantity: 0, purchase_count: 0, avg_price: 0 });
  });
});
