jest.mock('../database', () => ({ getDatabase: jest.fn() }));

import { getDatabase } from '../database';
import { IncomeDao } from '../incomeDao';

const getDatabaseMock = getDatabase as jest.MockedFunction<typeof getDatabase>;

describe('IncomeDao.create fallback date (BUG-08)', () => {
  afterEach(() => jest.useRealTimers());

  it('geçersiz tarihte UTC değil yerel bugünü yazar', async () => {
    // Varşova 12 Kasım 00:30 = UTC 11 Kasım 23:30
    jest.useFakeTimers().setSystemTime(new Date(2026, 10, 12, 0, 30));
    const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 3, changes: 1 });
    getDatabaseMock.mockResolvedValue({ runAsync } as any);

    await IncomeDao.create({ source: 'Bonus', amount: 50, date: 'not-a-date' });

    expect(runAsync.mock.calls[0][1][3]).toBe('2026-11-12');
  });
});
