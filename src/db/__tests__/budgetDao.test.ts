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

  it('geçişte yalnız aynı başlangıcı değil bütün kesişen aktif dönemleri kapatır', async () => {
    const runAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 11 });
    const database = {
      getFirstAsync: jest.fn().mockResolvedValue(null),
      runAsync,
      withTransactionAsync: jest.fn(async (operation: () => Promise<void>) => operation()),
    };
    (getDatabase as jest.Mock).mockResolvedValue(database);

    await BudgetDao.transitionAndSetBudget({
      amount: 3000,
      currency: 'PLN',
      previousStartDay: 1,
      nextStartDay: 23,
      effectiveDate: '2026-09-05',
    });

    const overlapClear = runAsync.mock.calls.find(([sql]) =>
      String(sql).includes('period_start <= ? AND period_end >= ?'),
    );
    expect(overlapClear).toBeDefined();
    // Geçiş dönemi bugünden bir sonraki çıpaya kadar sürer: 5 Eyl → 22 Eyl.
    expect(overlapClear?.[1]).toEqual(['2026-09-22', '2026-09-05']);
  });
});

describe('BudgetDao tek aktif dönem değişmezi', () => {
  it('yeni bütçe yazmadan önce kesişen bütün aktif dönemleri pasife çeker', async () => {
    const runAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 21 });
    const database = {
      getFirstAsync: jest.fn().mockResolvedValue(null),
      runAsync,
      withTransactionAsync: jest.fn(async (operation: () => Promise<void>) => operation()),
    };
    (getDatabase as jest.Mock).mockResolvedValue(database);

    await BudgetDao.setBudgetForPeriod({
      amount: 3450,
      currency: 'PLN',
      periodStart: '2026-08-23',
      periodEnd: '2026-09-22',
      cycleStartDay: 23,
    });

    // Kesişim koşulu: mevcut.start <= yeni.end VE mevcut.end >= yeni.start
    expect(runAsync.mock.calls[0][0]).toContain('period_start <= ? AND period_end >= ?');
    expect(runAsync.mock.calls[0][1]).toEqual(['2026-09-22', '2026-08-23']);
    // `start_date` seçilen navigatör ayı değil, dönemin BAŞLADIĞI aydır.
    expect(runAsync.mock.calls[1][1]).toEqual([
      3450,
      'PLN',
      '2026-08',
      '2026-08-23',
      '2026-09-22',
      23,
    ]);
  });

  it('bütçe hedefini siler ve harcamalara dokunmaz', async () => {
    const runAsync = jest.fn().mockResolvedValue({ changes: 1 });
    const database = {
      getFirstAsync: jest.fn(),
      runAsync,
      withTransactionAsync: jest.fn(async (operation: () => Promise<void>) => operation()),
    };
    (getDatabase as jest.Mock).mockResolvedValue(database);

    const removed = await BudgetDao.deleteBudget(42);

    expect(removed).toBe(1);
    expect(runAsync).toHaveBeenCalledWith('DELETE FROM budgets WHERE id = ?', [42]);
    expect(
      runAsync.mock.calls.some(([sql]) => String(sql).toLowerCase().includes('expenses')),
    ).toBe(false);
  });

  it('çakışan kayıt varken bugünü kapsayan dönemde son yazılanı yetkili sayar', async () => {
    const getFirstAsync = jest.fn().mockResolvedValue(null);
    const database = {
      getFirstAsync,
      runAsync: jest.fn(),
      withTransactionAsync: jest.fn(),
    };
    (getDatabase as jest.Mock).mockResolvedValue(database);

    await BudgetDao.getContainingDate('2026-09-05');

    expect(getFirstAsync.mock.calls[0][0]).toContain('ORDER BY id DESC');
  });
});
