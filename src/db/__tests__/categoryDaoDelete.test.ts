jest.mock('../database', () => ({ getDatabase: jest.fn() }));

import { getDatabase } from '../database';
import { CategoryDao } from '../categoryDao';
import { CREATE_TABLES_SQL } from '../schema';
import { sqliteTestDatabase } from './helpers/sqliteTestDatabase';

let db: ReturnType<typeof sqliteTestDatabase>;

beforeEach(async () => {
  db = sqliteTestDatabase();
  (getDatabase as jest.Mock).mockResolvedValue(db);
  await db.execAsync(CREATE_TABLES_SQL);
  await db.execAsync(`
    ALTER TABLE categories ADD COLUMN is_system INTEGER DEFAULT 0;
    INSERT INTO categories (id, name, icon, color, parent_id, is_system) VALUES
      (1, 'Hobi', 'tag-outline', '#7C6BFF', NULL, 0),
      (2, 'Kitap', 'tag-outline', '#7C6BFF', 1, 0),
      (3, 'Boş', 'tag-outline', '#7C6BFF', NULL, 0),
      (4, 'Kalem', 'tag-outline', '#7C6BFF', NULL, 0),
      (9, 'Market', 'cart-outline', '#FFA654', NULL, 1),
      (10, 'Diğer', 'dots-horizontal-circle-outline', '#8B8B9E', NULL, 1);
    INSERT INTO vendors (id, name, default_category_id) VALUES (1, 'Empik', 2);
    INSERT INTO expenses (id, total_amount, currency, date, category_id, created_at) VALUES
      (1, 20, 'PLN', '2026-11-01', 2, 'x'),
      (2, 5, 'PLN', '2026-11-02', NULL, 'x');
    INSERT INTO expense_items (id, expense_id, name, quantity, unit_price, total_price, category_id) VALUES
      (1, 2, 'Pen', 1, 5, 5, 4);
  `);
});
afterEach(async () => db.close());

describe('CategoryDao.delete (BUG-13)', () => {
  it('refuses with CATEGORY_IN_USE when a subcategory has expenses, and keeps both rows', async () => {
    await expect(CategoryDao.delete(1)).rejects.toThrow('CATEGORY_IN_USE');
    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM categories WHERE id IN (1, 2)')).toEqual({ n: 2 });
  });

  it('refuses when only a receipt item uses the category', async () => {
    await expect(CategoryDao.delete(4)).rejects.toThrow('CATEGORY_IN_USE');
  });

  it('deletes an unused category', async () => {
    await CategoryDao.delete(3);
    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM categories WHERE id = 3')).toEqual({ n: 0 });
  });

  it('still protects system categories first', async () => {
    await expect(CategoryDao.delete(9)).rejects.toThrow('SYSTEM_CATEGORY_LOCKED');
  });
});

describe('CategoryDao usage and move-to-Diğer delete (BUG-13 eki)', () => {
  it('counts expenses and receipt items of the category and its subcategories', async () => {
    expect(await CategoryDao.getUsageCount(1)).toBe(1);
    expect(await CategoryDao.getUsageCount(4)).toBe(1);
    expect(await CategoryDao.getUsageCount(3)).toBe(0);
  });

  it('moves expenses and items to Diğer, clears vendor defaults and deletes the tree atomically', async () => {
    await CategoryDao.deleteMovingUsageToOther(1);

    expect(await db.getFirstAsync('SELECT category_id FROM expenses WHERE id = 1')).toEqual({ category_id: 10 });
    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM categories WHERE id IN (1, 2)')).toEqual({ n: 0 });
    expect(await db.getFirstAsync('SELECT default_category_id FROM vendors WHERE id = 1')).toEqual({ default_category_id: null });
  });

  it('moves receipt item categories too', async () => {
    await CategoryDao.deleteMovingUsageToOther(4);
    expect(await db.getFirstAsync('SELECT category_id FROM expense_items WHERE id = 1')).toEqual({ category_id: 10 });
  });

  it('never deletes a system category this way', async () => {
    await expect(CategoryDao.deleteMovingUsageToOther(9)).rejects.toThrow('SYSTEM_CATEGORY_LOCKED');
    await expect(CategoryDao.deleteMovingUsageToOther(10)).rejects.toThrow('SYSTEM_CATEGORY_LOCKED');
  });

  it('fails without changing anything when Diğer is missing', async () => {
    await db.runAsync('DELETE FROM categories WHERE id = 10');
    await expect(CategoryDao.deleteMovingUsageToOther(1)).rejects.toThrow('OTHER_CATEGORY_MISSING');
    expect(await db.getFirstAsync('SELECT category_id FROM expenses WHERE id = 1')).toEqual({ category_id: 2 });
  });
});
