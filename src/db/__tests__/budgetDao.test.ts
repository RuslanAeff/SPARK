import { BudgetDao } from '../budgetDao';
import { getDatabase } from '../database';

jest.mock('../database', () => ({ getDatabase: jest.fn() }));

describe('BudgetDao immutable period transition', () => {
  it('closes only the open period and starts the new rule today', async () => {
    const runAsync = jest.fn()
      .mockResolvedValueOnce({ changes: 1 })
      .mockResolvedValueOnce({ changes: 0 })
      .mockResolvedValueOnce({ lastInsertRowId: 42 })
      .mockResolvedValueOnce({ changes: 1 });
    const database = {
      getFirstAsync: jest.fn().mockResolvedValue({
        id: 7,
        period_start: '2026-07-23',
        period_end: '2026-08-22',
      }),
      runAsync,
      withTransactionAsync: jest.fn(async (operation: () => Promise<void>) => operation()),
    };
    (getDatabase as jest.Mock).mockResolvedValue(database);

    await BudgetDao.transitionAndSetBudget({
      amount: 3600,
      currency: 'PLN',
      previousStartDay: 23,
      nextStartDay: 21,
      effectiveDate: '2026-08-21',
    });

    expect(runAsync).toHaveBeenNthCalledWith(
      1,
      'UPDATE budgets SET period_end = ? WHERE id = ?',
      ['2026-08-20', 7],
    );
    expect(runAsync.mock.calls[2][1]).toEqual([
      3600,
      'PLN',
      '2026-08',
      '2026-08-21',
      '2026-09-20',
      21,
    ]);
    expect(runAsync).toHaveBeenLastCalledWith(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      ['budget_cycle_start_day', '21'],
    );
  });
});
