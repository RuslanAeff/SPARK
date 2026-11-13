jest.mock('../database', () => ({ getDatabase: jest.fn() }));

import { getDatabase } from '../database';
import { CategoryLimitDao } from '../categoryLimitDao';

const getDatabaseMock = getDatabase as jest.MockedFunction<typeof getDatabase>;
const normalizeSql = (sql: string) => sql.replace(/\s+/g, ' ').trim();

describe('CategoryLimitDao.upsert (BUG-09)', () => {
  const runAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    runAsync.mockResolvedValue({ changes: 1, lastInsertRowId: 0 });
    getDatabaseMock.mockResolvedValue({ runAsync } as any);
  });

  it.each([
    ['NaN amount', 7, '2026-11', Number.NaN],
    ['negative amount', 7, '2026-11', -5],
    ['invalid month', 7, '2026-13', 10],
    ['invalid category', 0, '2026-11', 10],
  ])('rejects %s and keeps the existing limit', async (_label, categoryId, month, amount) => {
    await expect(CategoryLimitDao.upsert(categoryId, month, amount)).rejects.toThrow('INVALID_CATEGORY_LIMIT');
    expect(runAsync).not.toHaveBeenCalled();
  });

  it('writes a positive limit with one atomic upsert statement', async () => {
    await CategoryLimitDao.upsert(7, '2026-11', 12.345);

    expect(runAsync).toHaveBeenCalledTimes(1);
    const [sql, params] = runAsync.mock.calls[0];
    expect(normalizeSql(sql)).toBe(
      'INSERT INTO category_limits (category_id, month, limit_amount) VALUES (?, ?, ?) '
      + 'ON CONFLICT(category_id, month) DO UPDATE SET limit_amount = excluded.limit_amount',
    );
    expect(params).toEqual([7, '2026-11', 12.35]);
  });

  it('removes the limit when the amount is exactly 0', async () => {
    await CategoryLimitDao.upsert(7, '2026-11', 0);

    expect(normalizeSql(runAsync.mock.calls[0][0])).toBe(
      'DELETE FROM category_limits WHERE category_id = ? AND month = ?',
    );
  });
});

describe('CategoryLimitDao.getForMonthWithSpending on real SQLite (PERF-03)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { sqliteTestDatabase } = require('./helpers/sqliteTestDatabase');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { CREATE_TABLES_SQL } = require('../schema');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ExpenseDao } = require('../expenseDao');
  let db: any;

  beforeEach(async () => {
    db = sqliteTestDatabase();
    getDatabaseMock.mockResolvedValue(db);
    await db.execAsync(CREATE_TABLES_SQL);
    await db.execAsync(`
      INSERT INTO categories (id, name, icon, color, parent_id) VALUES
        (1, 'Market', 'cart', '#00FF66', NULL),
        (2, 'Meyve', 'apple', '#00FF66', 1),
        (3, 'Organik', 'leaf', '#00FF66', 2),
        (4, 'Kafe', 'coffee', '#111111', NULL);
      INSERT INTO expenses (total_amount, currency, date, category_id, created_at) VALUES
        (10.10, 'PLN', '2026-11-02', 1, '2026-11-02T10:00:00Z'),
        (5.25,  'PLN', '2026-11-03', 2, '2026-11-03T10:00:00Z'),
        (7.00,  'PLN', '2026-11-04', 3, '2026-11-04T10:00:00Z'),
        (99.00, 'PLN', '2026-10-30', 1, '2026-10-30T10:00:00Z');
      INSERT INTO category_limits (id, category_id, month, limit_amount) VALUES
        (20, 4, '2026-11', 50),
        (10, 1, '2026-11', 100),
        (30, 1, '2026-10', 999);
    `);
  });
  afterEach(async () => db.close());

  it('returns limit id, stable id order and the same spent as the per-limit query', async () => {
    const rows = await CategoryLimitDao.getForMonthWithSpending('2026-11', '2026-11-01', '2026-11-30');

    expect(rows.map((r: any) => [r.id, r.category_id])).toEqual([[10, 1], [20, 4]]);
    for (const row of rows) {
      const perLimit = await ExpenseDao.getSpentForCategoryInRange(row.category_id, '2026-11-01', '2026-11-30');
      expect(row.spent).toBeCloseTo(perLimit, 10);
    }
    // Kategori + doğrudan alt kategori; torun ve aralık dışı hariç (mevcut sözleşme).
    expect(rows[0].spent).toBeCloseTo(15.35, 10);
    expect(rows[1].spent).toBe(0);
  });
});
