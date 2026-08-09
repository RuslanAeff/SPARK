import { normalizeReceiptMoneyPrecisionOnce } from '../database';

describe('receipt money precision migration', () => {
  it('mevcut REAL para alanlarını transaction içinde bir kez normalize eder', async () => {
    const getFirstAsync = jest.fn().mockResolvedValue(null);
    const runAsync = jest.fn().mockResolvedValue({});
    const withTransactionAsync = jest.fn(async (operation: () => Promise<void>) => operation());
    const database = { getFirstAsync, runAsync, withTransactionAsync } as any;

    await normalizeReceiptMoneyPrecisionOnce(database);

    expect(withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(runAsync).toHaveBeenCalledTimes(3);
    expect(runAsync.mock.calls[0][0]).toContain('ROUND(total_amount, 2)');
    expect(runAsync.mock.calls[1][0]).toContain('ROUND(total_price, 2)');
    expect(runAsync.mock.calls[2]).toEqual([
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      ['migration_receipt_money_precision_v1', '1'],
    ]);
  });

  it('migration işaretliyse tekrar yazma yapmaz', async () => {
    const getFirstAsync = jest.fn().mockResolvedValue({ value: '1' });
    const runAsync = jest.fn();
    const withTransactionAsync = jest.fn();
    const database = { getFirstAsync, runAsync, withTransactionAsync } as any;

    await normalizeReceiptMoneyPrecisionOnce(database);

    expect(runAsync).not.toHaveBeenCalled();
    expect(withTransactionAsync).not.toHaveBeenCalled();
  });
});
