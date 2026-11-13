import { repairVoucherExpiryOnce, VOUCHER_EXPIRY_REPAIR_MIGRATION } from '../database';

describe('voucher expiry repair migration (BUG-04)', () => {
  it('bozuk veya fiş tarihinden önceki son kullanma tarihlerini transaction içinde bir kez NULL yapar', async () => {
    const getFirstAsync = jest.fn().mockResolvedValue(null);
    const runAsync = jest.fn().mockResolvedValue({ changes: 1 });
    const withTransactionAsync = jest.fn(async (operation: () => Promise<void>) => operation());
    const database = { getFirstAsync, runAsync, withTransactionAsync } as any;

    await repairVoucherExpiryOnce(database);

    expect(withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(runAsync).toHaveBeenCalledTimes(2);
    const repairSql = String(runAsync.mock.calls[0][0]);
    expect(repairSql).toContain('UPDATE container_deposit_vouchers');
    expect(repairSql).toContain('expires_on = NULL');
    expect(repairSql).toContain('date(expires_on) <> expires_on');
    expect(repairSql).toContain('expires_on < issued_date');
    expect(repairSql).toContain("WHEN status = 'expired' THEN 'available'");
    expect(runAsync.mock.calls[1]).toEqual([
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [VOUCHER_EXPIRY_REPAIR_MIGRATION, '1'],
    ]);
  });

  it('migration işaretliyse tekrar yazma yapmaz', async () => {
    const getFirstAsync = jest.fn().mockResolvedValue({ value: '1' });
    const runAsync = jest.fn();
    const withTransactionAsync = jest.fn();
    const database = { getFirstAsync, runAsync, withTransactionAsync } as any;

    await repairVoucherExpiryOnce(database);

    expect(runAsync).not.toHaveBeenCalled();
    expect(withTransactionAsync).not.toHaveBeenCalled();
  });
});
