// S.P.A.R.K. — Expense Data Access Object
import {
  isDayTypeSegment,
  isSpendSegment,
  systemRootsFor,
  type DayTypeSegment,
  type SpendSegment,
} from '../utils/spendSegment';
import { getDatabase } from './database';
import { Expense, ExpenseItem, ExpenseWithDetails } from './schema';
import { CategoryDao } from './categoryDao';
import { getLocalDateMonthsAgo } from '../utils/dateUtils';
import { releaseVouchersRedeemedBy } from './containerDepositDao';
import {
  sanitizeAmount,
  sanitizeQuantity,
  sanitizeUnitPrice,
  sanitizeText,
  sanitizeIdArray,
  sanitizeDate,
} from '../utils/inputValidation';

// Sınırlar yedek içe aktarım sözleşmesiyle aynıdır (backupService
// validateBaseCollections). Burada daha geniş değer yazmak, o harcamayı içeren
// her yedeği geri yüklenemez yapar (BUG-10, BUG-19).
const EXPENSE_NOTE_MAX = 1000;
const EXPENSE_RECEIPT_URI_MAX = 2000;
const EXPENSE_CURRENCY_MAX = 10;

function requireExpenseDate(value: unknown): string {
  const safe = sanitizeDate(value);
  if (!safe) throw new Error('INVALID_EXPENSE_DATE');
  return safe;
}

function safeExpenseCurrency(value: unknown): string {
  return sanitizeText(value || 'PLN', EXPENSE_CURRENCY_MAX) || 'PLN';
}

function safeNullableText(value: unknown, maxLen: number): string | null {
  if (value == null) return null;
  return sanitizeText(value, maxLen) || null;
}
import { normalizeItemKey } from '../utils/itemNameNormalizer';
import { fromMinorUnits, roundMoney, sumMoney, subtractMoney } from '../utils/moneyMath';
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

type ExpenseCreate = Omit<Expense, 'id' | 'created_at' | 'container_deposit_paid' | 'container_voucher_used'> & {
  container_deposit_paid?: number;
  container_voucher_used?: number;
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

/** Kalemin harcamaya ait olduğunu doğrular ve depozito kalemi olup olmadığını döndürür. */
async function assertItemBelongsToExpense(
  db: Awaited<ReturnType<typeof getDatabase>>,
  expenseId: number,
  itemId: number,
): Promise<{ isDeposit: boolean }> {
  const row = await db.getFirstAsync<{ id: number; financial_kind?: string | null }>(
    'SELECT id, financial_kind FROM expense_items WHERE id = ? AND expense_id = ?',
    [itemId, expenseId],
  );
  if (!row) throw new Error('Receipt item does not belong to expense');
  return { isDeposit: row.financial_kind === 'container_deposit' };
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
       ORDER BY e.date DESC, e.created_at DESC, e.id DESC
       LIMIT ? OFFSET ?`,
      // BUG-25: e.id benzersiz son anahtar; aynı date+created_at satırları
      // (içe aktarım) OFFSET sayfalamasında atlanmaz veya tekrarlanmaz.
      [limit, offset]
    );
  },

  /**
   * BUG-11: arama için tüm harcamaların yalnız aranabilir alanları, liste
   * sırasıyla. Eşleştirme JS'te dil bağımsız katlamayla yapılır (SQLite LIKE
   * ASCII dışı harflerde büyük/küçük farkını yok sayamaz); tam satırlar yalnız
   * eşleşenler için `getByIdsInOrder` ile sayfa sayfa okunur.
   */
  async getSearchIndex(): Promise<Array<{
    id: number; vendor_name: string | null; category_name: string | null; note: string | null;
  }>> {
    const db = await getDatabase();
    return db.getAllAsync(
      `SELECT e.id, v.name AS vendor_name, c.name AS category_name, e.note
         FROM expenses e
         LEFT JOIN vendors v ON e.vendor_id = v.id
         LEFT JOIN categories c ON e.category_id = c.id
        ORDER BY e.date DESC, e.created_at DESC, e.id DESC`,
    );
  },

  /** Verilen kimliklerin tam satırları, verilen sırada (silinmiş olanlar atlanır). */
  async getByIdsInOrder(ids: number[]): Promise<ExpenseWithDetails[]> {
    if (ids.length === 0) return [];
    const db = await getDatabase();
    const byId = new Map<number, ExpenseWithDetails>();
    for (let i = 0; i < ids.length; i += 400) {
      const chunk = ids.slice(i, i + 400);
      const rows = await db.getAllAsync<ExpenseWithDetails>(
        `SELECT e.*,
                v.name as vendor_name, v.logo_uri as vendor_logo,
                c.name as category_name, c.icon as category_icon, c.color as category_color
           FROM expenses e
           LEFT JOIN vendors v ON e.vendor_id = v.id
           LEFT JOIN categories c ON e.category_id = c.id
          WHERE e.id IN (${chunk.map(() => '?').join(', ')})`,
        chunk,
      );
      for (const row of rows) byId.set(row.id, row);
    }
    return ids.map(id => byId.get(id)).filter((row): row is ExpenseWithDetails => row != null);
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

  async create(expense: ExpenseCreate): Promise<number> {
    const safeDate = requireExpenseDate(expense.date);
    const safeTotalAmount = sanitizeAmount(expense.total_amount);
    const safeCurrency = safeExpenseCurrency(expense.currency);
    const safeNote = safeNullableText(expense.note, EXPENSE_NOTE_MAX);
    const safeReceiptUri = safeNullableText(expense.receipt_uri, EXPENSE_RECEIPT_URI_MAX);
    const db = await getDatabase();
    const result = await db.runAsync(
      `INSERT INTO expenses
        (vendor_id, category_id, total_amount, currency, note, receipt_uri,
         container_deposit_paid, container_voucher_used, date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        expense.vendor_id, expense.category_id, safeTotalAmount,
        safeCurrency, safeNote, safeReceiptUri,
        sanitizeAmount(expense.container_deposit_paid ?? 0),
        sanitizeAmount(expense.container_voucher_used ?? 0),
        safeDate,
      ]
    );
    return result.lastInsertRowId;
  },

  async update(id: number, expense: Partial<Expense>): Promise<void> {
    // Doğrulama yazmadan önce: geçersiz tarih hiçbir alanı değiştirmemeli.
    const safeDate = expense.date !== undefined ? requireExpenseDate(expense.date) : undefined;
    const db = await getDatabase();
    const fields: string[] = [];
    const values: any[] = [];
    
    if (expense.vendor_id !== undefined) { fields.push('vendor_id = ?'); values.push(expense.vendor_id); }
    if (expense.category_id !== undefined) { fields.push('category_id = ?'); values.push(expense.category_id); }
    if (expense.total_amount !== undefined) {
      fields.push('total_amount = ?');
      values.push(sanitizeAmount(expense.total_amount));
    }
    if (expense.currency !== undefined) {
      fields.push('currency = ?');
      values.push(safeExpenseCurrency(expense.currency));
    }
    if (expense.note !== undefined) {
      fields.push('note = ?');
      values.push(safeNullableText(expense.note, EXPENSE_NOTE_MAX));
    }
    if (expense.receipt_uri !== undefined) {
      fields.push('receipt_uri = ?');
      values.push(safeNullableText(expense.receipt_uri, EXPENSE_RECEIPT_URI_MAX));
    }
    if (expense.container_deposit_paid !== undefined) {
      fields.push('container_deposit_paid = ?');
      values.push(sanitizeAmount(expense.container_deposit_paid));
    }
    if (expense.container_voucher_used !== undefined) {
      fields.push('container_voucher_used = ?');
      values.push(sanitizeAmount(expense.container_voucher_used));
    }
    if (safeDate !== undefined) { fields.push('date = ?'); values.push(safeDate); }

    if (fields.length > 0) {
      values.push(id);
      await db.runAsync(`UPDATE expenses SET ${fields.join(', ')} WHERE id = ?`, values);
    }
  },

  async delete(id: number): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      await releaseVouchersRedeemedBy(db, '?', [id]);
      await db.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
    });
  },

  /**
   * Toplu silme; expense_items FK ile birlikte temizlenir (CASCADE).
   * Seçimin tamamı silinir (sessiz üst sınır yok) ve tüm parçalar TEK
   * transaction'dadır: ortada hata olursa hiçbir kayıt silinmez (BUG-06).
   * Gerçekten silinen satır sayısını döndürür.
   */
  async deleteMany(ids: number[]): Promise<number> {
    const safeIds = Array.from(new Set(sanitizeIdArray(ids, Number.MAX_SAFE_INTEGER)));
    if (safeIds.length === 0) return 0;
    const db = await getDatabase();
    // SQLite placeholder limiti (~999): chunk'lara böl
    const CHUNK = 400;
    let deleted = 0;
    await db.withTransactionAsync(async () => {
      for (let i = 0; i < safeIds.length; i += CHUNK) {
        const chunk = safeIds.slice(i, i + CHUNK);
        const placeholders = chunk.map(() => '?').join(',');
        await releaseVouchersRedeemedBy(db, placeholders, chunk);
        const result = await db.runAsync(`DELETE FROM expenses WHERE id IN (${placeholders})`, chunk);
        deleted += result.changes;
      }
    });
    return deleted;
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
    const safeFinancialKind = item.financial_kind === 'container_deposit'
      ? 'container_deposit'
      : 'product';
    const identity = safeFinancialKind === 'container_deposit'
      ? null
      : await resolveCanonicalProductForItem({
        name: safeName,
        measurementUnit: safeMeasurementUnit,
        hint: item.product_identity_hint,
      }, db);
    const result = await db.runAsync(
      `INSERT INTO expense_items
         (expense_id, name, turkish_name, user_label, quantity, measurement_unit,
          canonical_product_id, unit_price, total_price, category_id, line_discount,
          list_line_total_before_discount, financial_kind)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        safeFinancialKind,
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
        financial_kind: 'product' | 'container_deposit';
      }>(
        'SELECT name, measurement_unit, financial_kind FROM expense_items WHERE id = ?',
        [id],
      );
      if (!current) throw new Error('RECEIPT_ITEM_NOT_FOUND');
      const nextName = item.name === undefined
        ? current.name
        : sanitizeText(item.name, 500) || 'Ürün';
      const nextUnit = sanitizeMeasurementUnit(
        item.measurement_unit === undefined ? current.measurement_unit : item.measurement_unit,
      );
      const nextFinancialKind = item.financial_kind ?? current.financial_kind;
      const identity = nextFinancialKind === 'container_deposit'
        ? null
        : await resolveCanonicalProductForItem({
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
    if (item.financial_kind !== undefined) {
      fields.push('financial_kind = ?');
      values.push(item.financial_kind === 'container_deposit' ? 'container_deposit' : 'product');
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

  /**
   * Başlık toplamını kalemlerden yeniden üretir. `depositItemsChanged` true ise
   * (depozito kalemi eklendi/değişti/silindi) `container_deposit_paid` da aynı
   * ifadede depozito kalemlerinin toplamına eşitlenir; aksi hâlde fişten okunmuş
   * başlık depozitosu korunur (BUG-29). Cüzdandaki "ödenen depozito" bu alandan okunur.
   */
  async syncExpenseTotal(
    expenseId: number,
    options: { depositItemsChanged?: boolean } = {},
  ): Promise<void> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ total_minor: number; deposit_minor?: number }>(
      `SELECT COALESCE(
         SUM(CAST(ROUND(total_price * 100, 0) AS INTEGER)),
         0
       ) as total_minor,
       COALESCE(SUM(CASE WHEN financial_kind = 'container_deposit'
         THEN MAX(0, CAST(ROUND(total_price * 100, 0) AS INTEGER)) ELSE 0 END), 0) as deposit_minor
       FROM expense_items
       WHERE expense_id = ?`,
      [expenseId]
    );
    if (result) {
      const total = fromMinorUnits(Number(result.total_minor) || 0);
      const expense = await db.getFirstAsync<{ container_voucher_used: number }>(
        'SELECT container_voucher_used FROM expenses WHERE id = ?', [expenseId],
      );
      if ((expense?.container_voucher_used ?? 0) > total) throw new Error('INVALID_CONTAINER_RECOVERY');
      if (options.depositItemsChanged) {
        await db.runAsync(
          'UPDATE expenses SET total_amount = ?, container_deposit_paid = ? WHERE id = ?',
          [total, fromMinorUnits(Number(result.deposit_minor) || 0), expenseId],
        );
      } else {
        await db.runAsync('UPDATE expenses SET total_amount = ? WHERE id = ?', [total, expenseId]);
      }
    }
  },

  async addItemAndSyncTotal(
    item: ExpenseItemWrite,
  ): Promise<number> {
    const db = await getDatabase();
    let itemId = 0;
    await db.withTransactionAsync(async () => {
      itemId = await ExpenseDao.addItem(item);
      await ExpenseDao.syncExpenseTotal(item.expense_id, {
        depositItemsChanged: (item as { financial_kind?: string }).financial_kind === 'container_deposit',
      });
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
      const { isDeposit } = await assertItemBelongsToExpense(db, expenseId, itemId);
      await ExpenseDao.updateItem(itemId, item);
      await ExpenseDao.syncExpenseTotal(expenseId, {
        depositItemsChanged: isDeposit || item.financial_kind === 'container_deposit',
      });
    });
  },

  /**
   * BUG-03 (ürün kararı B, ADR-004 madde 12): yalnız gösterim adı düzeltmesi.
   * Para alanlarına ve fişin basılı toplamına dokunmaz; onay gerekmez.
   */
  async updateItemLabel(expenseId: number, itemId: number, label: string): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      await assertItemBelongsToExpense(db, expenseId, itemId);
      await ExpenseDao.updateItem(itemId, { user_label: label });
    });
  },

  async deleteItemAndSyncTotal(expenseId: number, itemId: number): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      const { isDeposit } = await assertItemBelongsToExpense(db, expenseId, itemId);
      await ExpenseDao.deleteItem(itemId);
      await ExpenseDao.syncExpenseTotal(expenseId, { depositItemsChanged: isDeposit });
    });
  },

  async getCashSpendingByDays(startDate: string, endDate: string): Promise<{ date: string; total: number }[]> {
    const rows = await (await getDatabase()).getAllAsync<{ date: string; total_amount: number; container_voucher_used: number }>(
      'SELECT date, total_amount, container_voucher_used FROM expenses WHERE date BETWEEN ? AND ? ORDER BY date',
      [startDate, endDate],
    );
    const days = new Map<string, number>();
    for (const row of rows) {
      const paid = Math.max(0, subtractMoney(row.total_amount, row.container_voucher_used ?? 0));
      days.set(row.date, sumMoney([days.get(row.date) ?? 0, paid]));
    }
    return Array.from(days, ([date, total]) => ({ date, total }));
  },

  /** Budget cash outflow; receipt totals and product discounts stay unchanged. */
  async getCashSpentByDateRange(startDate: string, endDate: string): Promise<number> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ total_amount: number; container_voucher_used: number }>(
      'SELECT total_amount, container_voucher_used FROM expenses WHERE date BETWEEN ? AND ?',
      [startDate, endDate],
    );
    return sumMoney(rows.map(row => Math.max(0, subtractMoney(row.total_amount, row.container_voucher_used ?? 0))));
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

  /** Ham tutarlar JS tarafında minor-unit ile toplanır; kategorisiz kayıtlar korunur. */
  async getCategoryChangeRows(startDate: string, endDate: string) {
    const db = await getDatabase();
    return db.getAllAsync<import('../utils/spendingChange').CategoryChangeTotal>(
      `SELECT COALESCE(p.id, c.id) AS category_id,
              COALESCE(p.name, c.name) AS category_name, e.total_amount AS total
       FROM expenses e
       LEFT JOIN categories c ON e.category_id = c.id
       LEFT JOIN categories p ON c.parent_id = p.id
       WHERE e.date BETWEEN ? AND ?`,
      [startDate, endDate],
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

  /**
   * İhtiyaç/istek dağılımı. `segment` dil bağımsız anahtardır (`needs|wants|other`);
   * yalnız sistem kök kategorisinin kanonik adı eşlenir (BUG-16, `spendSegment`).
   */
  async getNeedsVsWants(startDate: string, endDate: string) {
    const db = await getDatabase();
    const needs = systemRootsFor('needs');
    const wants = systemRootsFor('wants');
    const marks = (list: string[]) => list.map(() => '?').join(', ');
    const rows = await db.getAllAsync<{ segment: string; total: number }>(
      `SELECT
         CASE
           WHEN COALESCE(p.is_system, c.is_system) = 1 AND COALESCE(p.name, c.name) IN (${marks(needs)}) THEN 'needs'
           WHEN COALESCE(p.is_system, c.is_system) = 1 AND COALESCE(p.name, c.name) IN (${marks(wants)}) THEN 'wants'
           ELSE 'other'
         END as segment,
         COALESCE(SUM(e.total_amount), 0) as total
       FROM expenses e
       JOIN categories c ON e.category_id = c.id
       LEFT JOIN categories p ON c.parent_id = p.id
       WHERE e.date BETWEEN ? AND ?
       GROUP BY segment
       ORDER BY total DESC`,
      [...needs, ...wants, startDate, endDate]
    );
    return rows.map(row => ({
      segment: (isSpendSegment(row.segment) ? row.segment : 'other') as SpendSegment,
      total: row.total,
    }));
  },

  /** FN-07: segment dil bağımsız anahtardır ('weekday' | 'weekend'); etiket UI'da çevrilir. */
  async getWeekdayVsWeekend(startDate: string, endDate: string): Promise<{ segment: DayTypeSegment; total: number }[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ segment: string; total: number }>(
      `SELECT
         CASE
           WHEN strftime('%w', e.date) IN ('0', '6') THEN 'weekend'
           ELSE 'weekday'
         END as segment,
         COALESCE(SUM(e.total_amount), 0) as total
       FROM expenses e
       WHERE e.date BETWEEN ? AND ?
       GROUP BY segment
       ORDER BY total DESC`,
      [startDate, endDate]
    );
    return rows.map(row => ({
      segment: isDayTypeSegment(row.segment) ? row.segment : 'weekday',
      total: row.total,
    }));
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
         AND i.financial_kind = 'product'
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
       WHERE e.date BETWEEN ? AND ?
         AND i.financial_kind = 'product'`,
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
       WHERE i.financial_kind = 'product'
         ${safeCanonicalProductId ? 'AND i.canonical_product_id = ?' : ''}
       ORDER BY e.date ASC, i.id ASC`,
      // PERF-01: kimlik biliniyorsa yalnız o ürünün satırları gelir
      // (idx_expense_items_canonical_product); eskiden tüm kalem tablosu çekiliyordu.
      safeCanonicalProductId ? [safeCanonicalProductId] : [],
    );

    // Hedef anahtar ölçü birimi başına bir kez hesaplanır; eskiden her satırda yeniden.
    const targetKeyByUnit = new Map<MeasurementUnit, string>();
    const targetKeyFor = (unit: MeasurementUnit): string => {
      let key = targetKeyByUnit.get(unit);
      if (key === undefined) {
        key = productIdentityGroupKey({ name: itemName, measurementUnit: unit });
        targetKeyByUnit.set(unit, key);
      }
      return key;
    };
    const nameMatched = safeCanonicalProductId
      // SQL zaten süzüyor; ucuz savunma kontrolü (artık yalnız o ürünün satırları).
      ? rows.filter(row => row.canonical_product_id === safeCanonicalProductId)
      : rows.filter((row) => {
        const unit = sanitizeMeasurementUnit(row.measurement_unit);
        const rowKey = productIdentityGroupKey({ name: row.name, measurementUnit: unit });
        return rowKey !== '' && rowKey === targetKeyFor(unit);
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
       WHERE e.date >= ?
         AND i.financial_kind = 'product'
         AND i.unit_price > 0
       ORDER BY TRIM(i.name), e.date ASC`,
      [getLocalDateMonthsAgo(safeMonths)]
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
         AND i.financial_kind = 'product'
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
