jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn()
    .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
    .mockReturnValueOnce('22222222-2222-4222-8222-222222222222')
    .mockReturnValueOnce('33333333-3333-4333-8333-333333333333')
    .mockReturnValue('44444444-4444-4444-8444-444444444444'),
}));

import {
  migrateProductIdentityOnce,
  PRODUCT_IDENTITY_MIGRATION,
} from '../database';

function createDatabase(options?: {
  columns?: string[];
  products?: any[];
  aliases?: any[];
  items?: any[];
}) {
  const getFirstAsync = jest.fn().mockResolvedValue(null);
  const getAllAsync = jest.fn(async (sql: string) => {
    if (sql.includes('PRAGMA table_info')) {
      return (options?.columns ?? ['id', 'name', 'measurement_unit'])
        .map(name => ({ name }));
    }
    if (sql.includes('FROM canonical_products')) return options?.products ?? [];
    if (sql.includes('FROM product_aliases')) return options?.aliases ?? [];
    if (sql.includes('FROM expense_items')) return options?.items ?? [];
    throw new Error(`Unexpected query: ${sql}`);
  });
  let nextProductId = 100;
  let nextAliasId = 200;
  const runAsync = jest.fn(async (sql: string, _params?: unknown[]) => {
    if (sql.includes('INSERT INTO canonical_products')) {
      return { lastInsertRowId: nextProductId++, changes: 1 };
    }
    if (sql.includes('INSERT INTO product_aliases')) {
      return { lastInsertRowId: nextAliasId++, changes: 1 };
    }
    return { lastInsertRowId: 0, changes: 1 };
  });
  const execAsync = jest.fn().mockResolvedValue(undefined);
  const withTransactionAsync = jest.fn(async (operation: () => Promise<void>) => operation());
  return {
    database: { getFirstAsync, getAllAsync, runAsync, execAsync, withTransactionAsync } as any,
    getFirstAsync,
    getAllAsync,
    runAsync,
    execAsync,
    withTransactionAsync,
  };
}

describe('product identity migration', () => {
  beforeEach(() => jest.clearAllMocks());

  it('adds both legacy columns, creates guards, backfills only safe unit-aware groups, and writes marker last', async () => {
    const mocks = createDatabase({
      items: [
        { id: 1, name: 'Tavuk Baget', measurement_unit: 'kg', canonical_product_id: null },
        { id: 2, name: 'TAVUK BAGET KG', measurement_unit: 'kg', canonical_product_id: null },
        { id: 3, name: 'Tavuk Kanat', measurement_unit: 'kg', canonical_product_id: null },
        { id: 4, name: 'Tavuk Kanadı kg', measurement_unit: 'kg', canonical_product_id: null },
        { id: 5, name: 'Taze Tavuk Budu kg', measurement_unit: 'kg', canonical_product_id: null },
        { id: 6, name: 'Tavuk Baget', measurement_unit: 'piece', canonical_product_id: null },
      ],
    });

    await migrateProductIdentityOnce(mocks.database);

    const execSql = mocks.execAsync.mock.calls.map(([sql]) => String(sql));
    expect(execSql.some(sql => sql.includes('ADD COLUMN canonical_product_id'))).toBe(true);
    expect(execSql.some(sql => sql.includes('ADD COLUMN user_label'))).toBe(true);
    expect(execSql.some(sql => sql.includes('trg_expense_item_canonical_unit_insert'))).toBe(true);
    expect(execSql.some(sql => sql.includes('trg_product_alias_canonical_unit_insert'))).toBe(true);

    const productInserts = mocks.runAsync.mock.calls
      .filter(([sql]) => String(sql).includes('INSERT INTO canonical_products'));
    expect(productInserts).toHaveLength(4);
    expect(productInserts.map(([, params]) => params?.[1])).toEqual([
      'Tavuk Baget', 'Tavuk Kanat', 'Taze Tavuk Budu', 'Tavuk Baget',
    ]);

    const itemUpdates = mocks.runAsync.mock.calls
      .filter(([sql]) => String(sql).includes('UPDATE expense_items SET canonical_product_id'));
    expect(itemUpdates.map(([, params]) => params ?? [])).toEqual([
      [100, 1],
      [100, 2],
      [101, 3],
      [101, 4],
      [102, 5],
      [103, 6],
    ]);
    expect(mocks.runAsync.mock.calls.some(([sql]) => /UPDATE expense_items SET name/u.test(String(sql))))
      .toBe(false);
    expect(mocks.runAsync).toHaveBeenLastCalledWith(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [PRODUCT_IDENTITY_MIGRATION, '1'],
    );
  });

  it('reconciles a partial schema without adding existing columns twice', async () => {
    const mocks = createDatabase({
      columns: ['id', 'name', 'measurement_unit', 'canonical_product_id', 'user_label'],
    });

    await migrateProductIdentityOnce(mocks.database);

    const execSql = mocks.execAsync.mock.calls.map(([sql]) => String(sql));
    expect(execSql.some(sql => sql.includes('ADD COLUMN canonical_product_id'))).toBe(false);
    expect(execSql.some(sql => sql.includes('ADD COLUMN user_label'))).toBe(false);
    expect(execSql.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS canonical_products'))).toBe(true);
    expect(execSql.some(sql => sql.includes('idx_expense_items_canonical_product'))).toBe(true);
  });

  it('does not guess when a deterministic key has multiple existing candidates', async () => {
    const mocks = createDatabase({
      columns: ['id', 'name', 'measurement_unit', 'canonical_product_id', 'user_label'],
      products: [
        { id: 7, canonical_key: 'ayni urun', measurement_unit: 'piece' },
        { id: 8, canonical_key: 'ayni urun', measurement_unit: 'piece' },
      ],
      items: [
        { id: 1, name: 'Aynı Ürün', measurement_unit: 'piece', canonical_product_id: null },
      ],
    });

    await migrateProductIdentityOnce(mocks.database);

    expect(mocks.runAsync.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO product_aliases')))
      .toBe(false);
    expect(mocks.runAsync.mock.calls.some(([sql]) => String(sql).includes('UPDATE expense_items')))
      .toBe(false);
  });

  it('does nothing when the success marker already exists', async () => {
    const mocks = createDatabase();
    mocks.getFirstAsync.mockResolvedValueOnce({ value: '1' });

    await migrateProductIdentityOnce(mocks.database);

    expect(mocks.getAllAsync).not.toHaveBeenCalled();
    expect(mocks.withTransactionAsync).not.toHaveBeenCalled();
  });

  it('propagates DDL failure and never writes the marker', async () => {
    const mocks = createDatabase();
    mocks.execAsync.mockRejectedValueOnce(new Error('disk full'));

    await expect(migrateProductIdentityOnce(mocks.database)).rejects.toThrow('disk full');

    expect(mocks.runAsync).not.toHaveBeenCalledWith(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [PRODUCT_IDENTITY_MIGRATION, '1'],
    );
  });
});
