// BUG-16: İhtiyaç/istek ayrımı dil bağımsız anahtar döndürür; yalnız sistem kökü eşlenir.
jest.mock('../database', () => ({ getDatabase: jest.fn() }));

import { getDatabase } from '../database';
import { ExpenseDao } from '../expenseDao';
import { CREATE_TABLES_SQL, DEFAULT_CATEGORIES } from '../schema';
import { SYSTEM_ROOT_SEGMENTS } from '../../utils/spendSegment';
import { sqliteTestDatabase } from './helpers/sqliteTestDatabase';

let db: ReturnType<typeof sqliteTestDatabase>;

beforeEach(async () => {
  db = sqliteTestDatabase();
  (getDatabase as jest.Mock).mockResolvedValue(db);
  await db.execAsync(CREATE_TABLES_SQL);
  await db.execAsync(`
    ALTER TABLE categories ADD COLUMN is_system INTEGER DEFAULT 0;
    INSERT INTO categories (id, name, parent_id, is_system) VALUES
      (1, 'Sağlık', NULL, 1), (2, 'İlaç', 1, 1), (3, 'Vitamin', 1, 0),
      (4, 'Eğlence', NULL, 1), (5, 'Sinema', 4, 1),
      (6, 'Evcil Hayvan', NULL, 0), (7, 'Mama', 6, 0),
      (8, 'Finans', NULL, 1), (9, 'Health', NULL, 0);
    INSERT INTO vendors (id, name) VALUES (1, 'X');
  `);
  const add = (category: number, amount: number) => db.runAsync(
    "INSERT INTO expenses (vendor_id, category_id, total_amount, currency, date) VALUES (1, ?, ?, 'PLN', '2026-11-05')",
    [category, amount],
  );
  await add(2, 40);   // sistem alt kategori → needs
  await add(3, 10);   // kullanıcının alt kategorisi, sistem kök altında → needs
  await add(5, 25);   // wants
  await add(7, 15);   // kullanıcının kökü altında → other
  await add(8, 5);    // Finans → other
  await add(9, 100);  // kullanıcının "Health" kökü: adı ne olursa olsun other
});
afterEach(async () => db.close());

it('returns language-independent segment keys and lets subcategories inherit their system root', async () => {
  const rows = await ExpenseDao.getNeedsVsWants('2026-11-01', '2026-11-30');
  expect(rows).toEqual([
    { segment: 'other', total: 120 },
    { segment: 'needs', total: 50 },
    { segment: 'wants', total: 25 },
  ]);
});

it('does not classify a user-created root by a Turkish-looking name', async () => {
  await db.runAsync("INSERT INTO categories (id, name, parent_id, is_system) VALUES (10, 'Alışveriş', NULL, 0)");
  await db.runAsync("INSERT INTO expenses (vendor_id, category_id, total_amount, currency, date) VALUES (1, 10, 1000, 'PLN', '2026-11-06')");
  const rows = await ExpenseDao.getNeedsVsWants('2026-11-01', '2026-11-30');
  expect(rows.find(r => r.segment === 'wants')?.total).toBe(25);
});

it('maps every default root category exactly once', () => {
  expect(Object.keys(SYSTEM_ROOT_SEGMENTS).sort()).toEqual(DEFAULT_CATEGORIES.map(c => c.name).sort());
});
