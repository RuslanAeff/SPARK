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

  /**
   * Analiz limit-sağlığı kartı için tek seferlik birleşik sorgu.
   * Her limit + kategori meta + alt kategoriler dahil aralık harcaması
   * tek SQL'de döner — eski yaklaşım her limit için 2 sorgu (children + spent)
   * + ayrıca CategoryDao.getAll() = 5 limit için 11 sorgu yapıyordu.
   */
  async getForMonthWithSpending(month: string, startDate: string, endDate: string) {
    const db = await getDatabase();
    return db.getAllAsync<{
      category_id: number;
      limit_amount: number;
      category_name: string;
      category_icon: string;
      category_color: string;
      spent: number;
    }>(
      `SELECT cl.category_id,
              cl.limit_amount,
              c.name  AS category_name,
              c.icon  AS category_icon,
              c.color AS category_color,
              COALESCE(SUM(e.total_amount), 0) AS spent
         FROM category_limits cl
         JOIN categories c ON c.id = cl.category_id
         LEFT JOIN expenses e
           ON e.date BETWEEN ? AND ?
          AND (e.category_id = cl.category_id
               OR e.category_id IN (SELECT id FROM categories WHERE parent_id = cl.category_id))
        WHERE cl.month = ?
        GROUP BY cl.category_id, cl.limit_amount, c.name, c.icon, c.color`,
      [startDate, endDate, month]
    );
  },
};
