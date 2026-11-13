jest.mock('../database', () => ({ getDatabase: jest.fn() }));

import { getDatabase } from '../database';
import { ExpenseDao } from '../expenseDao';
import { CREATE_TABLES_SQL, PRODUCT_IDENTITY_TABLES_SCHEMA_SQL } from '../schema';
import { sqliteTestDatabase } from './helpers/sqliteTestDatabase';

let db: ReturnType<typeof sqliteTestDatabase>;

beforeEach(async () => {
  db = sqliteTestDatabase();
  (getDatabase as jest.Mock).mockResolvedValue(db);
  await db.execAsync(PRODUCT_IDENTITY_TABLES_SCHEMA_SQL + CREATE_TABLES_SQL);
  await db.execAsync(`
    INSERT INTO canonical_products (id, uid, canonical_name, canonical_key, measurement_unit, created_at, updated_at) VALUES
      (8, '11111111-1111-4111-8111-111111111111', 'Tavuk Kanat', 'tavuk kanat', 'kg', 'x', 'x'),
      (9, '22222222-2222-4222-8222-222222222222', 'Süt', 'sut', 'l', 'x', 'x');
    INSERT INTO vendors (id, name) VALUES (1, 'Biedronka');
    INSERT INTO expenses (id, vendor_id, total_amount, currency, date, created_at) VALUES
      (1, 1, 30, 'PLN', '2026-09-01', 'x'),
      (2, 1, 30, 'PLN', '2026-09-08', 'x');
    INSERT INTO expense_items (id, expense_id, name, quantity, measurement_unit, unit_price, total_price, canonical_product_id, financial_kind) VALUES
      (1, 1, 'Tavuk Kanadı', 0.5, 'kg', 20, 10, 8, 'product'),
      (2, 1, 'Mleko', 1, 'l', 4, 4, 9, 'product'),
      (3, 2, 'Tavuk Kanat Kg', 1, 'kg', 18, 18, 8, 'product'),
      (4, 2, 'Kaucja', 1, 'piece', 0.5, 0.5, NULL, 'container_deposit'),
      (5, 2, 'Cilek', 1, 'kg', 12, 12, NULL, 'product'),
      (6, 1, 'cilek', 0.5, 'kg', 5, 5, NULL, 'product');
  `);
});
afterEach(async () => db.close());

describe('ExpenseDao.getItemAnalytics query scope (PERF-01)', () => {
  it('filters by canonical product in SQL instead of loading every item', async () => {
    const getAll = jest.spyOn(db, 'getAllAsync');

    const result = await ExpenseDao.getItemAnalytics('Tavuk Kanat', 'kg', 8);

    const [sql, params] = getAll.mock.calls[0];
    expect(String(sql)).toContain('i.canonical_product_id = ?');
    expect(params).toEqual([8]);
    expect(result.stats.purchase_count).toBe(2);
    expect(result.stats.total_quantity).toBe(1.5);
    expect(result.stats.total_spent).toBe(28);
    expect(result.history.map(row => row.name)).toEqual(['Tavuk Kanadı', 'Tavuk Kanat Kg']);
  });

  it('keeps the name-based path unchanged when no canonical id is known', async () => {
    const result = await ExpenseDao.getItemAnalytics('CILEK');

    expect(result.stats.purchase_count).toBe(2);
    expect(result.stats.total_spent).toBe(17);
    expect(result.stats.measurement_unit).toBe('kg');
    expect(result.history.map(row => row.date)).toEqual(['2026-09-01', '2026-09-08']);
  });
});
