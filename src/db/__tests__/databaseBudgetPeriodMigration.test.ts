import {
  BUDGET_PERIOD_SNAPSHOT_MIGRATION,
  migrateBudgetPeriodSnapshotsOnce,
} from '../database';

describe('budget period snapshot migration', () => {
  it('freezes legacy rows with the anchor that was active at migration time', async () => {
    const getFirstAsync = jest.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ value: '23' });
    const getAllAsync = jest.fn()
      .mockResolvedValueOnce([
        { name: 'id' },
        { name: 'start_date' },
        { name: 'active' },
      ])
      .mockResolvedValueOnce([{ id: 9, start_date: '2026-06' }]);
    const execAsync = jest.fn().mockResolvedValue(undefined);
    const runAsync = jest.fn().mockResolvedValue({ changes: 1 });
    const database = {
      getFirstAsync,
      getAllAsync,
      execAsync,
      runAsync,
      withTransactionAsync: jest.fn(async (operation: () => Promise<void>) => operation()),
    } as any;

    await migrateBudgetPeriodSnapshotsOnce(database);

    expect(execAsync).toHaveBeenCalledTimes(3);
    expect(runAsync).toHaveBeenCalledWith(
      'UPDATE budgets SET period_start = ?, period_end = ?, cycle_start_day = ? WHERE id = ?',
      ['2026-06-23', '2026-07-22', 23, 9],
    );
    expect(runAsync).toHaveBeenLastCalledWith(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [BUDGET_PERIOD_SNAPSHOT_MIGRATION, '1'],
    );
  });
});
