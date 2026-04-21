// S.P.A.R.K. — Kategori başına aylık limit (YYYY-MM)
import { getDatabase } from './database';

export interface CategoryLimitRow {
  id: number;
  category_id: number;
  month: string;
  limit_amount: number;
}

export const CategoryLimitDao = {
  async getForMonth(month: string): Promise<CategoryLimitRow[]> {
    const db = await getDatabase();
    return db.getAllAsync<CategoryLimitRow>(
      'SELECT * FROM category_limits WHERE month = ? ORDER BY id',
      [month]
    );
  },

  async upsert(categoryId: number, month: string, limitAmount: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM category_limits WHERE category_id = ? AND month = ?', [categoryId, month]);
    if (limitAmount > 0) {
      await db.runAsync(
        'INSERT INTO category_limits (category_id, month, limit_amount) VALUES (?, ?, ?)',
        [categoryId, month, limitAmount]
      );
    }
  },

  async remove(id: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM category_limits WHERE id = ?', [id]);
  },

  async removeByCategoryMonth(categoryId: number, month: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM category_limits WHERE category_id = ? AND month = ?', [categoryId, month]);
  },

  /** Hedef silindiğinde veya sıfırlamada tüm kategori limitleri */
  async deleteAll(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM category_limits');
  },
};
