jest.mock('../database', () => ({ getDatabase: jest.fn() }));

import { getDatabase } from '../database';
import { ExpenseDao } from '../expenseDao';
import { CREATE_TABLES_SQL } from '../schema';
import { sqliteTestDatabase } from './helpers/sqliteTestDatabase';

let db: ReturnType<typeof sqliteTestDatabase>;

beforeEach(async () => {
  db = sqliteTestDatabase();
  (getDatabase as jest.Mock).mockResolvedValue(db);
  await db.execAsync(CREATE_TABLES_SQL);
  // İçe aktarılmış kayıtlarda olduğu gibi aynı date + created_at çiftleri.
  for (let id = 1; id <= 7; id++) {
    await db.runAsync(
      "INSERT INTO expenses (id, total_amount, currency, date, created_at) VALUES (?, 1, 'PLN', '2026-11-01', '2026-11-01 10:00:00')",
      [id],
    );
  }
});
afterEach(async () => db.close());

describe('ExpenseDao.getAll paging (BUG-25)', () => {
  it('pages through identical date/created_at rows without duplicates or gaps', async () => {
    const seen: number[] = [];
    for (let offset = 0; offset < 7; offset += 2) {
      const page = await ExpenseDao.getAll(2, offset);
      seen.push(...page.map(row => row.id));
    }
    expect(seen).toEqual([7, 6, 5, 4, 3, 2, 1]);
  });
});
