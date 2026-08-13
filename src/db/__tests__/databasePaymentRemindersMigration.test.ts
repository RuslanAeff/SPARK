import {
  migratePaymentRemindersOnce,
  PAYMENT_REMINDER_VENDOR_DETACH_MIGRATION,
  PAYMENT_REMINDERS_MIGRATION,
} from '../database';

function createDatabase(columnNames: string[] = []) {
  const getFirstAsync = jest.fn().mockResolvedValue(null);
  const getAllAsync = jest.fn().mockResolvedValue(columnNames.map((name) => ({ name })));
  const execAsync = jest.fn().mockResolvedValue(undefined);
  const runAsync = jest.fn().mockResolvedValue({ changes: 1 });
  const withTransactionAsync = jest.fn(async (operation: () => Promise<void>) => operation());
  return {
    database: { getFirstAsync, getAllAsync, execAsync, runAsync, withTransactionAsync } as any,
    getFirstAsync,
    getAllAsync,
    execAsync,
    runAsync,
    withTransactionAsync,
  };
}

describe('payment reminders migration', () => {
  it('legacy debts tablosunu tek transaction içinde tamamlar ve markerı en son yazar', async () => {
    const mocks = createDatabase(['id', 'status']);

    await migratePaymentRemindersOnce(mocks.database);

    expect(mocks.getAllAsync).toHaveBeenCalledWith('PRAGMA table_info(debts);');
    expect(mocks.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(mocks.execAsync).toHaveBeenCalledTimes(5);
    expect(mocks.execAsync.mock.calls[0][0]).toContain('ADD COLUMN due_date TEXT');
    expect(mocks.execAsync.mock.calls[1][0]).toContain('ADD COLUMN reminder_enabled');
    expect(mocks.execAsync.mock.calls[1][0]).toContain('due_date IS NOT NULL');
    expect(mocks.execAsync.mock.calls[2][0]).toContain('ADD COLUMN reminder_days_before');
    expect(mocks.execAsync.mock.calls[3][0]).toContain('ADD COLUMN reminder_time');
    expect(mocks.execAsync.mock.calls[3][0]).toContain('length(reminder_time) = 5');

    const schemaSql = mocks.execAsync.mock.calls[4][0] as string;
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS recurring_payment_reminders');
    expect(schemaSql).toContain('idx_recurring_payment_reminders_detected_vendor');
    expect(schemaSql).toContain('idx_debts_open_reminder_due');
    expect(schemaSql).toContain('next_due_date >= anchor_date');
    expect(schemaSql).toContain("source != 'detected' OR vendor_id IS NOT NULL");
    expect(schemaSql).toContain('trg_recurring_reminder_vendor_detach');
    expect(schemaSql).toContain("SET source = 'manual'");
    expect(mocks.runAsync).toHaveBeenNthCalledWith(
      1,
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [PAYMENT_REMINDERS_MIGRATION, '1'],
    );
    expect(mocks.runAsync).toHaveBeenLastCalledWith(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [PAYMENT_REMINDER_VENDOR_DETACH_MIGRATION, '1'],
    );
    expect(mocks.runAsync.mock.invocationCallOrder[1]).toBeGreaterThan(
      mocks.execAsync.mock.invocationCallOrder[4],
    );
  });

  it('yarım kalmış migrationda yalnız eksik borç kolonlarını ekler', async () => {
    const mocks = createDatabase(['id', 'due_date', 'reminder_enabled']);

    await migratePaymentRemindersOnce(mocks.database);

    const sql = mocks.execAsync.mock.calls.map(([statement]) => statement as string);
    expect(sql.some((statement) => statement.includes('ADD COLUMN due_date'))).toBe(false);
    expect(sql.some((statement) => statement.includes('ADD COLUMN reminder_enabled'))).toBe(false);
    expect(sql.some((statement) => statement.includes('ADD COLUMN reminder_days_before'))).toBe(true);
    expect(sql.some((statement) => statement.includes('ADD COLUMN reminder_time'))).toBe(true);
    expect(sql.at(-1)).toContain('recurring_payment_reminders');
  });

  it('iki marker da varsa PRAGMA veya yazma çalıştırmaz', async () => {
    const mocks = createDatabase();
    mocks.getFirstAsync
      .mockResolvedValueOnce({ value: '1' })
      .mockResolvedValueOnce({ value: '1' });

    await migratePaymentRemindersOnce(mocks.database);

    expect(mocks.getAllAsync).not.toHaveBeenCalled();
    expect(mocks.withTransactionAsync).not.toHaveBeenCalled();
    expect(mocks.execAsync).not.toHaveBeenCalled();
    expect(mocks.runAsync).not.toHaveBeenCalled();
  });

  it('v1 uygulanmış cihazda yalnız idempotent şema/trigger uzlaştırmasını çalıştırır', async () => {
    const mocks = createDatabase();
    mocks.getFirstAsync
      .mockResolvedValueOnce({ value: '1' })
      .mockResolvedValueOnce(null);

    await migratePaymentRemindersOnce(mocks.database);

    expect(mocks.getAllAsync).not.toHaveBeenCalled();
    expect(mocks.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(mocks.execAsync).toHaveBeenCalledTimes(1);
    expect(mocks.execAsync.mock.calls[0][0]).toContain(
      'trg_recurring_reminder_vendor_detach',
    );
    expect(mocks.runAsync).toHaveBeenCalledTimes(1);
    expect(mocks.runAsync).toHaveBeenCalledWith(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [PAYMENT_REMINDER_VENDOR_DETACH_MIGRATION, '1'],
    );
  });

  it('DDL hatasını yutmaz ve başarı markerı yazmaz', async () => {
    const mocks = createDatabase(['id', 'due_date', 'reminder_enabled', 'reminder_days_before']);
    mocks.execAsync.mockRejectedValueOnce(new Error('disk full'));

    await expect(migratePaymentRemindersOnce(mocks.database)).rejects.toThrow('disk full');
    expect(mocks.runAsync).not.toHaveBeenCalled();
  });
});
