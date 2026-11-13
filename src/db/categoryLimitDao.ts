// S.P.A.R.K. — Kategori başına aylık limit (YYYY-MM)
import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from './database';
import { roundMoney } from '../utils/moneyMath';

export interface CategoryLimitRow {
  id: number;
  category_id: number;
  month: string;
  limit_amount: number;
}

export interface CategoryLimitInput {
  category_id: number;
  limit_amount: number;
}

function isMonthKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

/**
 * Limit girdisini yazmadan önce doğrular. Eskiden `NaN > 0` yanlış olduğu için
 * okunamayan tutar mevcut limiti sessizce siliyordu (BUG-09). 0 bilinçli olarak
 * "limiti kaldır" demektir; negatif, sonsuz veya NaN hatadır.
 */
export function validateCategoryLimit(
  categoryId: number,
  month: string,
  limitAmount: number,
): { categoryId: number; month: string; amount: number } {
  if (!Number.isSafeInteger(categoryId) || categoryId <= 0
    || !isMonthKey(month)
    || typeof limitAmount !== 'number' || !Number.isFinite(limitAmount)
    || limitAmount < 0 || limitAmount > 999_999_999) {
    throw new Error('INVALID_CATEGORY_LIMIT');
  }
  return { categoryId, month, amount: roundMoney(limitAmount) };
}

/** Doğrulanmış tek limit yazısı; çağıranın transaction'ına katılabilir. */
export async function writeCategoryLimit(
  db: Pick<SQLiteDatabase, 'runAsync'>,
  limit: { categoryId: number; month: string; amount: number },
): Promise<void> {
  if (limit.amount === 0) {
    await db.runAsync(
      'DELETE FROM category_limits WHERE category_id = ? AND month = ?',
      [limit.categoryId, limit.month],
    );
    return;
  }
  // Tek ifade: DELETE+INSERT arasında kesilip limiti kaybetme riski yok.
  await db.runAsync(
    `INSERT INTO category_limits (category_id, month, limit_amount) VALUES (?, ?, ?)
     ON CONFLICT(category_id, month) DO UPDATE SET limit_amount = excluded.limit_amount`,
    [limit.categoryId, limit.month, limit.amount],
  );
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
    const limit = validateCategoryLimit(categoryId, month, limitAmount);
    const db = await getDatabase();
    await writeCategoryLimit(db, limit);
  },

  async remove(id: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM category_limits WHERE id = ?', [id]);
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
      id: number;
      category_id: number;
      limit_amount: number;
      category_name: string;
      category_icon: string;
      category_color: string;
      spent: number;
    }>(
      `SELECT cl.id,
              cl.category_id,
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
        GROUP BY cl.id, cl.category_id, cl.limit_amount, c.name, c.icon, c.color
        ORDER BY cl.id`,
      [startDate, endDate, month]
    );
  },
};
