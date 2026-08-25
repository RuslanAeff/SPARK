jest.mock('../database', () => ({ getDatabase: jest.fn() }));

import { getDatabase } from '../database';
import { VendorDao } from '../vendorDao';

const getDatabaseMock = getDatabase as jest.MockedFunction<typeof getDatabase>;

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

describe('VendorDao bulk deletion', () => {
  const runAsync = jest.fn();
  const getFirstAsync = jest.fn();
  const withTransactionAsync = jest.fn(async (work: () => Promise<void>) => work());

  beforeEach(() => {
    jest.clearAllMocks();
    runAsync.mockResolvedValue({ changes: 0, lastInsertRowId: 0 });
    getFirstAsync.mockResolvedValue(null);
    getDatabaseMock.mockResolvedValue({
      runAsync,
      getFirstAsync,
      withTransactionAsync,
    } as any);
  });

  it('counts linked expenses with one parameterized query after normalizing ids', async () => {
    getFirstAsync.mockResolvedValue({ c: 7 });

    await expect(
      VendorDao.countExpensesForVendors([4, 4, -1, Number.NaN, 9]),
    ).resolves.toBe(7);

    expect(getFirstAsync).toHaveBeenCalledTimes(1);
    const [sql, params] = getFirstAsync.mock.calls[0];
    expect(normalizeSql(sql)).toBe(
      'SELECT COUNT(*) as c FROM expenses WHERE vendor_id IN (?, ?)',
    );
    expect(params).toEqual([4, 9]);
  });

  it('deletes all linked expenses and vendors inside one transaction', async () => {
    runAsync
      .mockResolvedValueOnce({ changes: 5, lastInsertRowId: 0 })
      .mockResolvedValueOnce({ changes: 2, lastInsertRowId: 0 });

    await expect(VendorDao.deleteMany([3, 8, 3])).resolves.toBe(2);

    expect(withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(runAsync).toHaveBeenCalledTimes(2);
    expect(normalizeSql(runAsync.mock.calls[0][0])).toBe(
      'DELETE FROM expenses WHERE vendor_id IN (?, ?)',
    );
    expect(runAsync.mock.calls[0][1]).toEqual([3, 8]);
    expect(normalizeSql(runAsync.mock.calls[1][0])).toBe(
      'DELETE FROM vendors WHERE id IN (?, ?)',
    );
    expect(runAsync.mock.calls[1][1]).toEqual([3, 8]);
  });

  it('does not open the database for an empty or invalid selection', async () => {
    await expect(VendorDao.countExpensesForVendors([])).resolves.toBe(0);
    await expect(VendorDao.deleteMany([0, -2, Number.NaN])).resolves.toBe(0);

    expect(getDatabaseMock).not.toHaveBeenCalled();
  });

  it('keeps single deletion on the same atomic bulk path', async () => {
    const deleteMany = jest.spyOn(VendorDao, 'deleteMany').mockResolvedValueOnce(1);

    await VendorDao.delete(12);

    expect(deleteMany).toHaveBeenCalledWith([12]);
  });
});
