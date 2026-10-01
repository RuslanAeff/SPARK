import { migrateContainerDepositsOnce } from '../database';

function createDatabase(expenseColumns: string[], itemColumns: string[]) {
  const getFirstAsync = jest.fn().mockResolvedValue(null);
  const getAllAsync = jest.fn(async (sql: string) => (
    sql.includes('table_info(expenses)')
      ? expenseColumns.map(name => ({ name }))
      : itemColumns.map(name => ({ name }))
  ));
  const execAsync = jest.fn().mockResolvedValue(undefined);
  const runAsync = jest.fn().mockResolvedValue({ changes: 1 });
  const withTransactionAsync = jest.fn(async (operation: () => Promise<void>) => operation());
  return {
    database: { getFirstAsync, getAllAsync, execAsync, runAsync, withTransactionAsync } as any,
    getFirstAsync, getAllAsync, execAsync, runAsync, withTransactionAsync,
  };
}

describe('container deposit migration', () => {
  it('adds legacy columns, creates both ledgers, and writes its marker last', async () => {
    const mocks = createDatabase(['id', 'total_amount'], ['id', 'name']);

    await migrateContainerDepositsOnce(mocks.database);

    expect(mocks.withTransactionAsync).toHaveBeenCalledTimes(1);
    const statements = mocks.execAsync.mock.calls.map(([sql]) => String(sql));
    expect(statements.some(sql => sql.includes('ADD COLUMN container_deposit_paid'))).toBe(true);
    expect(statements.some(sql => sql.includes('ADD COLUMN container_voucher_used'))).toBe(true);
    expect(statements.some(sql => sql.includes('ADD COLUMN financial_kind'))).toBe(true);
    expect(statements.at(-1)).toContain('CREATE TABLE IF NOT EXISTS container_deposit_vouchers');
    expect(statements.at(-1)).toContain('CREATE TABLE IF NOT EXISTS container_deposit_recoveries');
    expect(mocks.runAsync).toHaveBeenLastCalledWith(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      ['migration_container_deposit_v1', '1'],
    );
    expect(mocks.runAsync.mock.invocationCallOrder[0])
      .toBeGreaterThan(mocks.execAsync.mock.invocationCallOrder.at(-1)!);
  });

  it('is a no-op after the migration marker is present', async () => {
    const mocks = createDatabase([], []);
    mocks.getFirstAsync.mockResolvedValue({ value: '1' });

    await migrateContainerDepositsOnce(mocks.database);

    expect(mocks.getAllAsync).not.toHaveBeenCalled();
    expect(mocks.withTransactionAsync).not.toHaveBeenCalled();
  });
});
