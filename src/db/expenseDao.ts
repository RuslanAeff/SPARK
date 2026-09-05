// S.P.A.R.K. — Expense Data Access Object
import { getDatabase } from './database';
import { Expense, ExpenseItem, ExpenseWithDetails } from './schema';
import { CategoryDao } from './categoryDao';
import {
  sanitizeAmount,
  sanitizeQuantity,
  sanitizeUnitPrice,
  sanitizeText,
  sanitizeIdArray,
} from '../utils/inputValidation';
import { normalizeItemKey } from '../utils/itemNameNormalizer';
import { fromMinorUnits, roundMoney } from '../utils/moneyMath';
import {
  sanitizeMeasurementUnit,
  type MeasurementUnit,
} from '../utils/measurementUnit';
import {
  resolveCanonicalProductForItem,
  type ProductIdentityHint,
} from './productIdentityDao';
import { productIdentityGroupKey } from '../utils/productIdentity';
import { itemDisplayName } from '../utils/itemDisplayName';
import { effectiveListLineTotal } from '../utils/receiptLineDiscountUi';

type ExpenseItemWrite = Omit<ExpenseItem, 'id'> & {
  turkish_name?: string | null;
  user_label?: string | null;
  product_identity_hint?: ProductIdentityHint | null;
};

type ExpenseItemUpdate = Partial<ExpenseItem> & {
  turkish_name?: string | null;
  user_label?: string | null;
  product_identity_hint?: ProductIdentityHint | null;
};

/**
 * `overall` gerçek işlemleri tutara göre doğrudan sıralar.
 * `per-vendor` ise uzun dönem özetlerinde aynı satıcının listeyi kaplamaması
 * için her satıcının en yüksek tek gerçek işlemini döndürür.
 */
export type TopTransactionSelection = 'overall' | 'per-vendor';

async function assertItemBelongsToExpense(
  db: Awaited<ReturnType<typeof getDatabase>>,
  expenseId: number,
  itemId: number,
): Promise<void> {
  const row = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM expense_items WHERE id = ? AND expense_id = ?',
    [itemId, expenseId],
  );
  if (!row) throw new Error('Receipt item does not belong to expense');
}

export const ExpenseDao = {
  async getAll(limit: number = 50, offset: number = 0): Promise<ExpenseWithDetails[]> {
    const db = await getDatabase();
    return db.getAllAsync<ExpenseWithDetails>(
      `SELECT e.*, 
              v.name as vendor_name, v.logo_uri as vendor_logo,
              c.name as category_name, c.icon as category_icon, c.color as category_color
       FROM expenses e
       LEFT JOIN vendors v ON e.vendor_id = v.id
       LEFT JOIN categories c ON e.category_id = c.id
       ORDER BY e.date DESC, e.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
  },

  async getByDateRange(startDate: string, endDate: string): Promise<ExpenseWithDetails[]> {
    const db = await getDatabase();
    return db.getAllAsync<ExpenseWithDetails>(
      `SELECT e.*, 
              v.name as vendor_name, v.logo_uri as vendor_logo,
              c.name as category_name, c.icon as category_icon, c.color as category_color
       FROM expenses e
       LEFT JOIN vendors v ON e.vendor_id = v.id
       LEFT JOIN categories c ON e.category_id = c.id
       WHERE e.date BETWEEN ? AND ?
       ORDER BY e.date DESC, e.created_at DESC`,
      [startDate, endDate]
    );
  },

  async getById(id: number): Promise<ExpenseWithDetails | null> {
    const db = await getDatabase();
    const expense = await db.getFirstAsync<ExpenseWithDetails>(
      `SELECT e.*, 
              v.name as vendor_name, v.logo_uri as vendor_logo,
              c.name as category_name, c.icon as category_icon, c.color as category_color
       FROM expenses e
       LEFT JOIN vendors v ON e.vendor_id = v.id
       LEFT JOIN categories c ON e.category_id = c.id
       WHERE e.id = ?`,
      [id]
    );
    if (expense) {
      expense.items = await ExpenseDao.getItems(id);
    }
    return expense;
  },

  /**
   * Kalıcı fiş bildirimlerini mevcut harcama/satıcı gerçeğiyle tek sorguda
   * uzlaştırmak için kullanılan küçük projection. Aynı SQLite bağlantısında
   * bildirim başına ayrı sorgu çalıştırılmaz.
   */
  async getNotificationSubjectsByIds(
    ids: readonly number[],
  ): Promise<Array<{ expense_id: number; vendor_name: string | null }>> {
    const safeIds = Array.from(new Set(sanitizeIdArray([...ids], 40)));
    if (safeIds.length === 0) return [];

    const db = await getDatabase();
    const placeholders = safeIds.map(() => '?').join(',');
    return db.getAllAsync<{ expense_id: number; vendor_name: string | null }>(
      `SELECT e.id AS expense_id, v.name AS vendor_name
       FROM expenses e
       LEFT JOIN vendors v ON e.vendor_id = v.id
       WHERE e.id IN (${placeholders})`,
      safeIds,
    );
  },

  async create(expense: Omit<Expense, 'id' | 'created_at'>): Promise<number> {
    const db = await getDatabase();
    const safeTotalAmount = sanitizeAmount(expense.total_amount);
    const safeCurrency = sanitizeText(expense.currency || 'PLN', 10);
    const safeNote = expense.note ? sanitizeText(expense.note, 1000) : null;
    const result = await db.runAsync(
      `INSERT INTO expenses (vendor_id, category_id, total_amount, currency, note, receipt_uri, date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        expense.vendor_id, expense.category_id, safeTotalAmount,
        safeCurrency, safeNote, expense.receipt_uri, expense.date,
      ]
    );
    return result.lastInsertRowId;
  },

  async update(id: number, expense: Partial<Expense>): Promise<void> {
    const db = await getDatabase();
    const fields: string[] = [];
    const values: any[] = [];
    
    if (expense.vendor_id !== undefined) { fields.push('vendor_id = ?'); values.push(expense.vendor_id); }
    if (expense.category_id !== undefined) { fields.push('category_id = ?'); values.push(expense.category_id); }
    if (expense.total_amount !== undefined) {
      fields.push('total_amount = ?');
      values.push(sanitizeAmount(expense.total_amount));
    }
    if (expense.currency !== undefined) { fields.push('currency = ?'); values.push(expense.currency); }
    if (expense.note !== undefined) { fields.push('note = ?'); values.push(expense.note); }
    if (expense.receipt_uri !== undefined) { fields.push('receipt_uri = ?'); values.push(expense.receipt_uri); }
    if (expense.date !== undefined) { fields.push('date = ?'); values.push(expense.date); }

    if (fields.length > 0) {
      values.push(id);
      await db.runAsync(`UPDATE expenses SET ${fields.join(', ')} WHERE id = ?`, values);
    }
  },

  async delete(id: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
  },

  /** Toplu silme; expense_items FK ile birlikte temizlenir (CASCADE). */
  async deleteMany(ids: number[]): Promise<void> {
    const safeIds = sanitizeIdArray(ids, 500);
    if (safeIds.length === 0) return;
    const db = await getDatabase();
    // SQLite placeholder limiti (~999): chunk'lara böl
    const CHUNK = 400;
    for (let i = 0; i < safeIds.length; i += CHUNK) {
      const chunk = safeIds.slice(i, i + CHUNK);
      const placeholders = chunk.map(() => '?').join(',');
      await db.runAsync(`DELETE FROM expenses WHERE id IN (${placeholders})`, chunk);
    }
  },

  async addItem(item: ExpenseItemWrite): Promise<number> {
    const db = await getDatabase();
    const ld = (item as any).line_discount;
    const lb = (item as any).list_line_total_before_discount;
    const safeName = sanitizeText(item.name, 500) || 'Ürün';
    const safeTurkishName = (item as any).turkish_name
      ? sanitizeText((item as any).turkish_name, 500)
      : null;
    const safeUserLabel = item.user_label == null
      ? null
      : sanitizeText(item.user_label, 500) || null;
    const safeQuantity = sanitizeQuantity(item.quantity);
    const safeUnitPrice = sanitizeUnitPrice(item.unit_price);
    const safeTotalPrice = roundMoney(sanitizeUnitPrice(item.total_price));
    const safeLineDiscount = ld != null && ld !== undefined ? sanitizeAmount(ld) : 0;
    const safeListBefore = lb != null && lb !== undefined ? sanitizeAmount(lb) : null;
    const safeMeasurementUnit = sanitizeMeasurementUnit(item.measurement_unit);
    const identity = await resolveCanonicalProductForItem({
      name: safeName,
      measurementUnit: safeMeasurementUnit,
      hint: item.product_identity_hint,
    }, db);
    const result = await db.runAsync(
      `INSERT INTO expense_items
         (expense_id, name, turkish_name, user_label, quantity, measurement_unit,
          canonical_product_id, unit_price, total_price, category_id, line_discount,
          list_line_total_before_discount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.expense_id,
        safeName,
        safeTurkishName,
        safeUserLabel,
        safeQuantity,
        safeMeasurementUnit,
        identity?.canonicalProductId ?? null,
        safeUnitPrice,
        safeTotalPrice,
        item.category_id,
        safeLineDiscount,
        safeListBefore,
      ]
    );
    return result.lastInsertRowId;
  },

  async getItems(expenseId: number): Promise<ExpenseItem[]> {
    const db = await getDatabase();
    return db.getAllAsync<ExpenseItem>(
      'SELECT * FROM expense_items WHERE expense_id = ? ORDER BY id',
      [expenseId]
    );
  },

  async updateItem(id: number, item: ExpenseItemUpdate): Promise<void> {
    const db = await getDatabase();
    const fields: string[] = [];
    const values: any[] = [];
    
    if (item.name !== undefined) {
      fields.push('name = ?');
      values.push(sanitizeText(item.name, 500) || 'Ürün');
    }
    if (item.turkish_name !== undefined) {
      fields.push('turkish_name = ?');
      values.push(item.turkish_name == null ? null : sanitizeText(item.turkish_name, 500));
    }
    if (item.user_label !== undefined) {
      fields.push('user_label = ?');
      values.push(item.user_label == null ? null : sanitizeText(item.user_label, 500) || null);
    }
    if (item.quantity !== undefined) {
      fields.push('quantity = ?');
      values.push(sanitizeQuantity(item.quantity));
    }
    if (item.measurement_unit !== undefined) {
      fields.push('measurement_unit = ?');
      values.push(sanitizeMeasurementUnit(item.measurement_unit));
    }
    if (item.name !== undefined || item.measurement_unit !== undefined) {
      const current = await db.getFirstAsync<{
        name: string;
        measurement_unit: MeasurementUnit;
      }>(
        'SELECT name, measurement_unit FROM expense_items WHERE id = ?',
        [id],
      );
      if (!current) throw new Error('RECEIPT_ITEM_NOT_FOUND');
      const nextName = item.name === undefined
        ? current.name
        : sanitizeText(item.name, 500) || 'Ürün';
      const nextUnit = sanitizeMeasurementUnit(
        item.measurement_unit === undefined ? current.measurement_unit : item.measurement_unit,
      );
      const identity = await resolveCanonicalProductForItem({
        name: nextName,
        measurementUnit: nextUnit,
        hint: item.product_identity_hint,
      }, db);
      fields.push('canonical_product_id = ?');
      values.push(identity?.canonicalProductId ?? null);
    } else if (item.canonical_product_id !== undefined) {
      fields.push('canonical_product_id = ?');
      const productId = Number(item.canonical_product_id);
      values.push(Number.isSafeInteger(productId) && productId > 0 ? productId : null);
    }
    if (item.unit_price !== undefined) {
      fields.push('unit_price = ?');
      values.push(sanitizeUnitPrice(item.unit_price));
    }
    if (item.total_price !== undefined) {
      fields.push('total_price = ?');
      values.push(roundMoney(sanitizeUnitPrice(item.total_price)));
    }
    if (item.category_id !== undefined) { fields.push('category_id = ?'); values.push(item.category_id); }
    if (item.line_discount !== undefined) {
      fields.push('line_discount = ?');
      values.push(item.line_discount == null ? null : sanitizeAmount(item.line_discount));
    }
    if (item.list_line_total_before_discount !== undefined) {
      fields.push('list_line_total_before_discount = ?');
      values.push(
        item.list_line_total_before_discount == null
          ? null
          : sanitizeAmount(item.list_line_total_before_discount),
      );
    }

    if (fields.length > 0) {
      values.push(id);
      await db.runAsync(`UPDATE expense_items SET ${fields.join(', ')} WHERE id = ?`, values);
    }
  },

  async deleteItem(id: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM expense_items WHERE id = ?', [id]);
  },

  async syncExpenseTotal(expenseId: number): Promise<void> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ total_minor: number }>(
      `SELECT COALESCE(
         SUM(CAST(ROUND(total_price * 100, 0) AS INTEGER)),
         0
       ) as total_minor
       FROM expense_items
       WHERE expense_id = ?`,
      [expenseId]
    );
    if (result) {
      const total = fromMinorUnits(Number(result.total_minor) || 0);
      await db.runAsync('UPDATE expenses SET total_amount = ? WHERE id = ?', [total, expenseId]);
    }
  },

  async addItemAndSyncTotal(
    item: ExpenseItemWrite,
  ): Promise<number> {
    const db = await getDatabase();
    let itemId = 0;
    await db.withTransactionAsync(async () => {
      itemId = await ExpenseDao.addItem(item);
      await ExpenseDao.syncExpenseTotal(item.expense_id);
    });
    return itemId;
  },

  async updateItemAndSyncTotal(
    expenseId: number,
    itemId: number,
    item: ExpenseItemUpdate,
  ): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      await assertItemBelongsToExpense(db, expenseId, itemId);
      await ExpenseDao.updateItem(itemId, item);
      await ExpenseDao.syncExpenseTotal(expenseId);
    });
  },

  async deleteItemAndSyncTotal(expenseId: number, itemId: number): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      await assertItemBelongsToExpense(db, expenseId, itemId);
      await ExpenseDao.deleteItem(itemId);
      await ExpenseDao.syncExpenseTotal(expenseId);
    });
  },

  async getTotalByDateRange(startDate: string, endDate: string): Promise<number> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(total_amount), 0) as total FROM expenses WHERE date BETWEEN ? AND ?',
      [startDate, endDate]
    );
    return result?.total || 0;
  },

  async getFirstExpenseDate(): Promise<string | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ first_date: string | null }>(
      'SELECT MIN(date) as first_date FROM expenses',
    );
    return result?.first_date ?? null;
  },

  async getSpendingByMonth(month: string): Promise<number> {
    // month format: 'YYYY-MM'
    const startDate = `${month}-01`;
    // Get last day of month
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;
    return ExpenseDao.getTotalByDateRange(startDate, endDate);
  },

  // Get all distinct months (YYYY-MM) that have any spending data
  async getMonthsWithSpending(): Promise<string[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ month: string }>(
      `SELECT DISTINCT strftime('%Y-%m', date) as month FROM expenses ORDER BY month DESC`
    );
    return rows.map(r => r.month);
  },

  /** Limit satırı için: yaprakta sadece o kategori; üst kategoride alt kategorilerin harcaması toplanır */
  async getSpentForCategoryInRange(categoryId: number, startDate: string, endDate: string): Promise<number> {
    const children = await CategoryDao.getChildren(categoryId);
    const db = await getDatabase();
    const ids = children.length === 0 ? [categoryId] : [categoryId, ...children.map(c => c.id)];
    const ph = ids.map(() => '?').join(',');
    const row = await db.getFirstAsync<{ s: number }>(
      `SELECT COALESCE(SUM(total_amount), 0) as s FROM expenses WHERE date BETWEEN ? AND ? AND category_id IN (${ph})`,
      [startDate, endDate, ...ids]
    );
    return row?.s ?? 0;
  },

  async getCategorySpending(startDate: string, endDate: string) {
    const db = await getDatabase();
    return db.getAllAsync(
      `SELECT COALESCE(p.id, c.id) as category_id, 
              COALESCE(p.name, c.name) as category_name, 
              COALESCE(p.icon, c.icon) as category_icon, 
              COALESCE(p.color, c.color) as category_color, 
              COALESCE(SUM(e.total_amount), 0) as total
       FROM expenses e
       JOIN categories c ON e.category_id = c.id
       LEFT JOIN categories p ON c.parent_id = p.id
       WHERE e.date BETWEEN ? AND ?
       GROUP BY COALESCE(p.id, c.id)
       ORDER BY total DESC`,
      [startDate, endDate]
    );
  },

  async getSubcategorySpending(parentId: number, startDate: string, endDate: string) {
    const db = await getDatabase();
    return db.getAllAsync(
      `SELECT c.id as category_id, c.name as category_name, c.icon as category_icon, 
              c.color as category_color, COALESCE(SUM(e.total_amount), 0) as total
       FROM expenses e
       JOIN categories c ON e.category_id = c.id
       WHERE c.parent_id = ? AND e.date BETWEEN ? AND ?
       GROUP BY c.id
       ORDER BY total DESC`,
      [parentId, startDate, endDate]
    );
  },

  async getVendorSpending(startDate: string, endDate: string) {
    const db = await getDatabase();
    return db.getAllAsync(
      `SELECT v.id as vendor_id, v.name as vendor_name, v.logo_uri as vendor_logo,
              COALESCE(SUM(e.total_amount), 0) as total
       FROM expenses e
       JOIN vendors v ON e.vendor_id = v.id
       WHERE e.date BETWEEN ? AND ?
       GROUP BY v.id
       ORDER BY total DESC`,
      [startDate, endDate]
    );
  },

  async getNeedsVsWants(startDate: string, endDate: string) {
    const db = await getDatabase();
    return db.getAllAsync<{ segment: string; total: number }>(
      `SELECT
         CASE 
           WHEN COALESCE(p.name, c.name) IN ('Faturalar', 'Sağlık', 'Eğitim', 'Ulaşım', 'Yeme-İçme', 'Konut') THEN 'Zorunlu İhtiyaçlar'
           WHEN COALESCE(p.name, c.name) IN ('Eğlence', 'Alışveriş') THEN 'Keyfi Harcamalar'
           ELSE 'Diğer Harcamalar'
         END as segment,
         COALESCE(SUM(e.total_amount), 0) as total
       FROM expenses e
       JOIN categories c ON e.category_id = c.id
       LEFT JOIN categories p ON c.parent_id = p.id
       WHERE e.date BETWEEN ? AND ?
       GROUP BY segment
       ORDER BY total DESC`,
      [startDate, endDate]
    );
  },

  async getWeekdayVsWeekend(startDate: string, endDate: string) {
    const db = await getDatabase();
    return db.getAllAsync<{ segment: string; total: number }>(
      `SELECT
         CASE 
           WHEN strftime('%w', e.date) IN ('0', '6') THEN 'Hafta Sonu'
           ELSE 'Hafta İçi'
         END as segment,
         COALESCE(SUM(e.total_amount), 0) as total
       FROM expenses e
       WHERE e.date BETWEEN ? AND ?
       GROUP BY segment
       ORDER BY total DESC`,
      [startDate, endDate]
    );
  },

  async getMonthlyTotals(months: number = 6) {
    const db = await getDatabase();
    const safeMonths = Math.max(1, Math.floor(Math.abs(months)));
    return db.getAllAsync(
      `SELECT strftime('%Y-%m', date) as month, COALESCE(SUM(total_amount), 0) as total
       FROM expenses
       WHERE date >= date('now', '-' || ? || ' months')
       GROUP BY strftime('%Y-%m', date)
       ORDER BY month ASC`,
      [safeMonths]
    );
  },

  async getYearlyTotals() {
    const db = await getDatabase();
    return db.getAllAsync(
      `SELECT strftime('%Y', date) as year, COALESCE(SUM(total_amount), 0) as total
       FROM expenses
       GROUP BY strftime('%Y', date)
       ORDER BY year ASC`
    );
  },

  async getVendorItems(vendorId: number, startDate: string, endDate: string) {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      name: string;
      turkish_name: string | null;
      user_label: string | null;
      canonical_product_id: number | null;
      canonical_name: string | null;
      measurement_unit: MeasurementUnit;
      unit_price: number;
      total_price: number;
      quantity: number;
      expense_date: string;
    }>(
      `SELECT i.name, i.turkish_name, i.user_label, i.canonical_product_id,
              p.canonical_name, i.measurement_unit,
              i.unit_price, i.total_price, i.quantity, e.date as expense_date
       FROM expense_items i
       JOIN expenses e ON i.expense_id = e.id
       LEFT JOIN canonical_products p ON p.id = i.canonical_product_id
       WHERE e.vendor_id = ? AND e.date BETWEEN ? AND ?
         AND i.unit_price > 0`,
      [vendorId, startDate, endDate]
    );

    interface Group {
      key: string;
      nameCounts: Map<string, number>;
      turkishNameCounts: Map<string, number>;
      userLabelCounts: Map<string, number>;
      canonical_product_id: number | null;
      canonical_name: string | null;
      measurement_unit: MeasurementUnit;
      latestDate: string;
      latestName: string;
      latestTurkishName: string | null;
      latestUserLabel: string | null;
      purchase_count: number;
      total_spent: number;
      total_quantity: number;
    }

    const groups = new Map<string, Group>();
    for (const r of rows) {
      const unit = sanitizeMeasurementUnit(r.measurement_unit);
      const key = productIdentityGroupKey({
        canonicalProductId: r.canonical_product_id,
        name: r.name,
        measurementUnit: unit,
      });
      if (!key) continue;
      let g = groups.get(key);
      if (!g) {
        g = {
          key,
          nameCounts: new Map(),
          turkishNameCounts: new Map(),
          userLabelCounts: new Map(),
          canonical_product_id: r.canonical_product_id,
          canonical_name: r.canonical_name,
          measurement_unit: unit,
          latestDate: r.expense_date,
          latestName: r.name,
          latestTurkishName: r.turkish_name,
          latestUserLabel: r.user_label,
          purchase_count: 0,
          total_spent: 0,
          total_quantity: 0,
        };
        groups.set(key, g);
      }
      g.nameCounts.set(r.name, (g.nameCounts.get(r.name) || 0) + 1);
      if (r.turkish_name) {
        g.turkishNameCounts.set(
          r.turkish_name,
          (g.turkishNameCounts.get(r.turkish_name) || 0) + 1
        );
      }
      if (r.user_label) {
        g.userLabelCounts.set(r.user_label, (g.userLabelCounts.get(r.user_label) || 0) + 1);
      }
      if (r.expense_date > g.latestDate) {
        g.latestDate = r.expense_date;
        g.latestName = r.name;
        g.latestTurkishName = r.turkish_name;
        g.latestUserLabel = r.user_label;
      }
      g.purchase_count += 1;
      g.total_spent += Number(r.total_price) || 0;
      g.total_quantity += Number(r.quantity) || 0;
    }

    function pickMostCommon(map: Map<string, number>, fallback: string | null): string | null {
      let best: string | null = fallback;
      let bestCount = -1;
      map.forEach((count, name) => {
        if (count > bestCount) {
          bestCount = count;
          best = name;
        }
      });
      return best;
    }

    const aggregated = Array.from(groups.values()).map((g) => ({
      name: pickMostCommon(g.nameCounts, g.latestName) ?? g.latestName,
      turkish_name: pickMostCommon(g.turkishNameCounts, g.latestTurkishName),
      user_label: pickMostCommon(g.userLabelCounts, g.latestUserLabel),
      canonical_product_id: g.canonical_product_id,
      canonical_name: g.canonical_name,
      measurement_unit: g.measurement_unit,
      purchase_count: g.purchase_count,
      total_spent: g.total_spent,
      total_quantity: g.total_quantity,
      normalized_key: g.key,
    }));

    aggregated.sort((a, b) => {
      if (b.purchase_count !== a.purchase_count) return b.purchase_count - a.purchase_count;
      return b.total_spent - a.total_spent;
    });

    // Sayfalama arayüz katmanında yapılır. Burada ilk 10'a kesmek, satıcının
    // geri kalan ürünlerini kullanıcıdan kalıcı olarak saklıyordu.
    return aggregated;
  },

  async getSpendingByDays(startDate: string, endDate: string) {
    const db = await getDatabase();
    return db.getAllAsync<{ date: string; total: number }>(
      `SELECT date, COALESCE(SUM(total_amount), 0) as total
       FROM expenses
       WHERE date BETWEEN ? AND ?
       GROUP BY date
       ORDER BY date ASC`,
      [startDate, endDate]
    );
  },

  /**
   * Kişisel enflasyon sepeti için bir dönemin fiş SATIRLARI.
   *
   * Hem ÖDENEN hem ETİKET birim fiyatı taşır: kampanyayla düşen fiyat ile
   * raftaki fiyatın düşmesi aynı şey değildir ve kart bunları ayırır.
   *
   * Toplam ya da ortalama döndürmez: fiyat endeksi, aynı ürünün iki dönemdeki
   * birim fiyatını gerektirir; gruplama ve medyan hesabı saf katmanda
   * (`computePersonalInflation`) yapılır. Anahtar, ürün analizleriyle AYNI
   * kanonik kimlikten üretilir — ölçü birimi anahtarın parçasıdır, böylece
   * "1 adet peynir" ile "1 kg peynir" aynı sepete girmez.
   */
  async getInflationBasketRows(startDate: string, endDate: string) {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      name: string;
      turkish_name: string | null;
      user_label: string | null;
      canonical_product_id: number | null;
      canonical_name: string | null;
      measurement_unit: MeasurementUnit;
      unit_price: number;
      quantity: number;
      total_price: number;
      line_discount: number | null;
      list_line_total_before_discount: number | null;
    }>(
      `SELECT i.name, i.turkish_name, i.user_label, i.canonical_product_id,
              p.canonical_name, i.measurement_unit, i.unit_price, i.quantity,
              i.total_price, i.line_discount, i.list_line_total_before_discount
       FROM expense_items i
       JOIN expenses e ON i.expense_id = e.id
       LEFT JOIN canonical_products p ON p.id = i.canonical_product_id
       WHERE e.date BETWEEN ? AND ?`,
      [startDate, endDate],
    );

    const basket: {
      key: string;
      name: string;
      unitPrice: number;
      listUnitPrice: number;
      quantity: number;
      totalPrice: number;
    }[] = [];
    for (const row of rows) {
      const unit = sanitizeMeasurementUnit(row.measurement_unit);
      const key = productIdentityGroupKey({
        canonicalProductId: row.canonical_product_id,
        name: row.name,
        measurementUnit: unit,
      });
      if (!key) continue;
      const quantity = Number(row.quantity) || 0;
      const unitPrice = Number(row.unit_price) || 0;
      // Etiket (indirim öncesi) birim fiyat: açık kolon yoksa net + indirimden
      // yeniden kurulur; ikisi de yoksa etiket = ödenen kabul edilir.
      const listLineTotal = effectiveListLineTotal({
        total_price: Number(row.total_price) || 0,
        line_discount: row.line_discount,
        list_line_total_before_discount: row.list_line_total_before_discount,
      });
      basket.push({
        key,
        name: row.canonical_name
          || itemDisplayName({
            name: row.name,
            turkish_name: row.turkish_name,
            user_label: row.user_label,
          }).primary,
        unitPrice,
        listUnitPrice: quantity > 0 ? listLineTotal / quantity : unitPrice,
        quantity,
        totalPrice: Number(row.total_price) || 0,
      });
    }
    return basket;
  },

  async getItemAnalytics(
    itemName: string,
    requestedUnit?: MeasurementUnit,
    canonicalProductId?: number | null,
  ) {
    const db = await getDatabase();
    const safeCanonicalProductId = Number.isSafeInteger(canonicalProductId)
      && Number(canonicalProductId) > 0
      ? Number(canonicalProductId)
      : null;
    if (!safeCanonicalProductId && !normalizeItemKey(itemName)) {
      return {
        stats: { total_spent: 0, avg_price: 0, purchase_count: 0, total_quantity: 0 },
        history: [],
      };
    }

    const rows = await db.getAllAsync<{
      name: string;
      turkish_name: string | null;
      user_label: string | null;
      canonical_product_id: number | null;
      canonical_name: string | null;
      date: string;
      unit_price: number;
      total_price: number;
      quantity: number;
      vendor_name: string | null;
      measurement_unit: MeasurementUnit;
    }>(
      `SELECT i.name, i.turkish_name, i.user_label, i.canonical_product_id,
              p.canonical_name, e.date, i.unit_price, i.total_price, i.quantity,
              i.measurement_unit, v.name as vendor_name
       FROM expense_items i
       JOIN expenses e ON i.expense_id = e.id
       LEFT JOIN vendors v ON e.vendor_id = v.id
       LEFT JOIN canonical_products p ON p.id = i.canonical_product_id
       ORDER BY e.date ASC, i.id ASC`
    );

    const nameMatched = rows.filter((row) => {
      const unit = sanitizeMeasurementUnit(row.measurement_unit);
      if (safeCanonicalProductId) return row.canonical_product_id === safeCanonicalProductId;
      const rowKey = productIdentityGroupKey({ name: row.name, measurementUnit: unit });
      const targetKey = productIdentityGroupKey({ name: itemName, measurementUnit: unit });
      return rowKey !== '' && rowKey === targetKey;
    });
    const unitCounts = new Map<MeasurementUnit, number>();
    nameMatched.forEach(row => {
      const unit = sanitizeMeasurementUnit(row.measurement_unit);
      unitCounts.set(unit, (unitCounts.get(unit) ?? 0) + 1);
    });
    const dominantUnit = requestedUnit ?? Array.from(unitCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'piece';
    const matched = nameMatched.filter(
      row => sanitizeMeasurementUnit(row.measurement_unit) === dominantUnit,
    );

    let total_spent = 0;
    let total_quantity = 0;
    for (const r of matched) {
      total_spent += Number(r.total_price) || 0;
      total_quantity += Number(r.quantity) || 0;
    }
    const purchase_count = matched.length;
    const avg_price = total_quantity > 0 ? total_spent / total_quantity : 0;

    const history = matched.map((r) => ({
      date: r.date,
      unit_price: Number(r.unit_price) || 0,
      total_price: Number(r.total_price) || 0,
      quantity: Number(r.quantity) || 0,
      vendor_name: r.vendor_name || '',
      name: r.name,
      turkish_name: r.turkish_name,
      user_label: r.user_label,
      measurement_unit: dominantUnit,
    }));

    return {
      stats: {
        total_spent,
        avg_price,
        purchase_count,
        total_quantity,
        measurement_unit: dominantUnit,
        canonical_product_id: safeCanonicalProductId,
        canonical_name: matched[0]?.canonical_name ?? null,
      },
      history,
    };
  },

  async getPriceHistory(lookbackMonths: number = 6) {
    const db = await getDatabase();
    const safeMonths = Math.max(1, Math.floor(Math.abs(lookbackMonths)));
    return db.getAllAsync<{
      name: string;
      turkish_name: string | null;
      user_label: string | null;
      canonical_product_id: number | null;
      canonical_name: string | null;
      unit_price: number;
      total_price: number;
      quantity: number;
      date: string;
      measurement_unit: MeasurementUnit;
    }>(
      `SELECT TRIM(i.name) as name, i.turkish_name, i.user_label,
              i.canonical_product_id, p.canonical_name,
              i.unit_price, i.total_price, i.quantity, e.date, i.measurement_unit
       FROM expense_items i
       JOIN expenses e ON i.expense_id = e.id
       LEFT JOIN canonical_products p ON p.id = i.canonical_product_id
       WHERE e.date >= date('now', '-' || ? || ' months')
         AND i.unit_price > 0
       ORDER BY TRIM(i.name), e.date ASC`,
      [safeMonths]
    );
  },

  async getTopTransactions(
    startDate: string,
    endDate: string,
    limit: number = 3,
    selection: TopTransactionSelection = 'overall',
  ) {
    const db = await getDatabase();

    if (selection === 'per-vendor') {
      return db.getAllAsync<ExpenseWithDetails>(
        `WITH ranked_expense_ids AS (
           SELECT e.id,
                  ROW_NUMBER() OVER (
                    PARTITION BY e.vendor_id,
                                 CASE WHEN e.vendor_id IS NULL THEN e.id ELSE 0 END
                    ORDER BY e.total_amount DESC, e.date DESC, e.id DESC
                  ) AS vendor_rank
           FROM expenses e
           WHERE e.date BETWEEN ? AND ?
         )
         SELECT e.*,
                v.name as vendor_name, v.logo_uri as vendor_logo,
                c.name as category_name, c.icon as category_icon, c.color as category_color
         FROM expenses e
         JOIN ranked_expense_ids ranked ON ranked.id = e.id AND ranked.vendor_rank = 1
         LEFT JOIN vendors v ON e.vendor_id = v.id
         LEFT JOIN categories c ON e.category_id = c.id
         ORDER BY e.total_amount DESC, e.date DESC, e.id DESC
         LIMIT ?`,
        [startDate, endDate, limit]
      );
    }

    return db.getAllAsync<ExpenseWithDetails>(
      `SELECT e.*,
              v.name as vendor_name, v.logo_uri as vendor_logo,
              c.name as category_name, c.icon as category_icon, c.color as category_color
       FROM expenses e
       LEFT JOIN vendors v ON e.vendor_id = v.id
       LEFT JOIN categories c ON e.category_id = c.id
       WHERE e.date BETWEEN ? AND ?
       ORDER BY e.total_amount DESC, e.date DESC, e.id DESC
       LIMIT ?`,
      [startDate, endDate, limit]
    );
  },

  /**
   * Saat dilimi × hafta günü matrisi.
   *
   * `expenses.date` sadece YYYY-MM-DD tutar (saat bilgisi yok). Bu yüzden
   * harcamanın **kayda alındığı** anı (`created_at`) kullanırız. Kullanıcının
   * uygulamayı en çok hangi gün/saatte kullandığını ve hangi saatlerde işlem
   * eklediğini gösterir — gerçek "alışveriş saati" yaklaşığı olarak da
   * okunabilir, ama kart UI'ı bunu açıkça belirtir.
   *
   * `created_at` UTC datetime('now') ile dolar; kullanıcının yerel timezone'una
   * çevirmek için strftime'ı 'localtime' modifier'ı ile çağırırız.
   *
   * Dönüş: 7 (gün, 0=Pazar) × 4 (zaman dilimi) flat array — her hücre toplam
   * harcama tutarı. Zaman dilimleri: 0=sabah(06-12), 1=öğle(12-17),
   * 2=akşam(17-22), 3=gece(22-06).
   */
  async getTimeOfDayMatrix(startDate: string, endDate: string) {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ dow: string; hour: string; total: number }>(
      `SELECT
         strftime('%w', e.created_at, 'localtime') as dow,
         strftime('%H', e.created_at, 'localtime') as hour,
         COALESCE(SUM(e.total_amount), 0) as total
       FROM expenses e
       WHERE date(e.created_at, 'localtime') BETWEEN ? AND ?
       GROUP BY dow, hour`,
      [startDate, endDate]
    );

    // 7 × 4 matris (gün × dilim). Aynı zamanda toplam, peak ve count tutarız.
    const matrix: number[][] = Array.from({ length: 7 }, () => [0, 0, 0, 0]);
    let total = 0;
    let peakValue = 0;
    let peakDow = 0;
    let peakSlot = 0;

    for (const r of rows) {
      const dow = parseInt(r.dow, 10);
      const hour = parseInt(r.hour, 10);
      const value = Number(r.total) || 0;
      let slot: number;
      if (hour >= 6 && hour < 12) slot = 0;
      else if (hour >= 12 && hour < 17) slot = 1;
      else if (hour >= 17 && hour < 22) slot = 2;
      else slot = 3;
      if (Number.isFinite(dow) && dow >= 0 && dow < 7) {
        matrix[dow][slot] += value;
        total += value;
        if (matrix[dow][slot] > peakValue) {
          peakValue = matrix[dow][slot];
          peakDow = dow;
          peakSlot = slot;
        }
      }
    }
    return { matrix, total, peakValue, peakDow, peakSlot };
  },

  /**
   * Sessiz harcamalar — küçük birim fiyatlı ama sık tekrarlayan kalemler.
   *
   * Yaklaşım: Verilen aralıkta tüm `expense_items`'ı çek; kalıcı ürün kimliği
   * varsa onunla, eski/null kayıtta birim-duyarlı güvenli anahtarla grupla.
   * Şu kriterleri sağlayan kalemleri dön:
   *   - `purchase_count >= minOccurrences`
   *   - `avg_price <= maxAvgPrice`
   *
   * "Latte effect" — tek tek bakınca masum, toplam çarpıcı.
   */
  async getSilentSpendItems(
    startDate: string,
    endDate: string,
    opts?: { minOccurrences?: number; maxAvgPrice?: number; limit?: number }
  ) {
    const minOccurrences = opts?.minOccurrences ?? 3;
    const maxAvgPrice = opts?.maxAvgPrice ?? 30;
    const limit = opts?.limit ?? 5;

    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      name: string;
      turkish_name: string | null;
      user_label: string | null;
      canonical_product_id: number | null;
      canonical_name: string | null;
      measurement_unit: MeasurementUnit;
      unit_price: number;
      total_price: number;
      quantity: number;
      category_id: number | null;
      category_name: string | null;
      category_icon: string | null;
      category_color: string | null;
    }>(
      `SELECT i.name, i.turkish_name, i.user_label, i.canonical_product_id,
              p.canonical_name, i.measurement_unit,
              i.unit_price, i.total_price, i.quantity,
              c.id as category_id, c.name as category_name,
              c.icon as category_icon, c.color as category_color
       FROM expense_items i
       JOIN expenses e ON i.expense_id = e.id
       LEFT JOIN categories c ON i.category_id = c.id
       LEFT JOIN canonical_products p ON p.id = i.canonical_product_id
       WHERE e.date BETWEEN ? AND ?
         AND i.unit_price > 0`,
      [startDate, endDate]
    );

    interface Group {
      key: string;
      nameCounts: Map<string, number>;
      userLabelCounts: Map<string, number>;
      latestName: string;
      turkish_name: string | null;
      user_label: string | null;
      canonical_product_id: number | null;
      canonical_name: string | null;
      measurement_unit: MeasurementUnit;
      purchase_count: number;
      total_spent: number;
      total_quantity: number;
      category_name: string | null;
      category_icon: string | null;
      category_color: string | null;
    }

    const groups = new Map<string, Group>();
    for (const r of rows) {
      const unit = sanitizeMeasurementUnit(r.measurement_unit);
      const key = productIdentityGroupKey({
        canonicalProductId: r.canonical_product_id,
        name: r.name,
        measurementUnit: unit,
      });
      if (!key) continue;
      let g = groups.get(key);
      if (!g) {
        g = {
          key,
          nameCounts: new Map(),
          userLabelCounts: new Map(),
          latestName: r.name,
          turkish_name: r.turkish_name,
          user_label: r.user_label,
          canonical_product_id: r.canonical_product_id,
          canonical_name: r.canonical_name,
          measurement_unit: unit,
          purchase_count: 0,
          total_spent: 0,
          total_quantity: 0,
          category_name: r.category_name,
          category_icon: r.category_icon,
          category_color: r.category_color,
        };
        groups.set(key, g);
      }
      g.nameCounts.set(r.name, (g.nameCounts.get(r.name) || 0) + 1);
      if (r.user_label) {
        g.userLabelCounts.set(r.user_label, (g.userLabelCounts.get(r.user_label) || 0) + 1);
      }
      g.purchase_count += 1;
      g.total_spent += Number(r.total_price) || 0;
      g.total_quantity += Number(r.quantity) || 0;
      // En son görülen kategori bilgisini koru — gruptaki tüm satırlarda
      // tutarlı olduğu varsayılır (aynı normalize anahtara sahip kalemler
      // tipik olarak aynı kategoride yer alır).
      if (!g.category_icon && r.category_icon) {
        g.category_name = r.category_name;
        g.category_icon = r.category_icon;
        g.category_color = r.category_color;
      }
    }

    function pickMostCommon(map: Map<string, number>, fallback: string): string {
      let best = fallback;
      let bestCount = -1;
      map.forEach((count, name) => {
        if (count > bestCount) {
          bestCount = count;
          best = name;
        }
      });
      return best;
    }

    const aggregated = Array.from(groups.values())
      .map((g) => ({
        name: pickMostCommon(g.nameCounts, g.latestName),
        turkish_name: g.turkish_name,
        user_label: pickMostCommon(g.userLabelCounts, g.user_label ?? '') || null,
        canonical_product_id: g.canonical_product_id,
        canonical_name: g.canonical_name,
        measurement_unit: g.measurement_unit,
        purchase_count: g.purchase_count,
        total_spent: g.total_spent,
        avg_price: g.total_quantity > 0 ? g.total_spent / g.total_quantity : 0,
        category_name: g.category_name,
        category_icon: g.category_icon,
        category_color: g.category_color,
        normalized_key: g.key,
      }))
      .filter((it) => it.purchase_count >= minOccurrences && it.avg_price <= maxAvgPrice);

    // En fazla "sızdıran" → toplam harcama × satın alma sayısı kombosu
    aggregated.sort((a, b) => b.total_spent - a.total_spent);

    const top = aggregated.slice(0, limit);
    const overallTotal = aggregated.reduce((s, it) => s + it.total_spent, 0);
    const overallCount = aggregated.reduce((s, it) => s + it.purchase_count, 0);
    return { items: top, totalAmount: overallTotal, totalCount: overallCount, distinctItems: aggregated.length };
  },
};
