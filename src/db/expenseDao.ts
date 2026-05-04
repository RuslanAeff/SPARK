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
    if (expense.total_amount !== undefined) { fields.push('total_amount = ?'); values.push(expense.total_amount); }
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

  async addItem(item: Omit<ExpenseItem, 'id'> & { turkish_name?: string }): Promise<number> {
    const db = await getDatabase();
    const ld = (item as any).line_discount;
    const lb = (item as any).list_line_total_before_discount;
    const safeName = sanitizeText(item.name, 500) || 'Ürün';
    const safeTurkishName = (item as any).turkish_name
      ? sanitizeText((item as any).turkish_name, 500)
      : null;
    const safeQuantity = sanitizeQuantity(item.quantity);
    const safeUnitPrice = sanitizeUnitPrice(item.unit_price);
    const safeTotalPrice = sanitizeUnitPrice(item.total_price);
    const safeLineDiscount = ld != null && ld !== undefined ? sanitizeAmount(ld) : 0;
    const safeListBefore = lb != null && lb !== undefined ? sanitizeAmount(lb) : null;
    const result = await db.runAsync(
      `INSERT INTO expense_items (expense_id, name, turkish_name, quantity, unit_price, total_price, category_id, line_discount, list_line_total_before_discount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.expense_id,
        safeName,
        safeTurkishName,
        safeQuantity,
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

  async updateItem(id: number, item: Partial<ExpenseItem> & { turkish_name?: string }): Promise<void> {
    const db = await getDatabase();
    const fields: string[] = [];
    const values: any[] = [];
    
    if (item.name !== undefined) { fields.push('name = ?'); values.push(item.name); }
    if (item.turkish_name !== undefined) { fields.push('turkish_name = ?'); values.push(item.turkish_name); }
    if (item.quantity !== undefined) { fields.push('quantity = ?'); values.push(item.quantity); }
    if (item.unit_price !== undefined) { fields.push('unit_price = ?'); values.push(item.unit_price); }
    if (item.total_price !== undefined) { fields.push('total_price = ?'); values.push(item.total_price); }
    if (item.category_id !== undefined) { fields.push('category_id = ?'); values.push(item.category_id); }
    if (item.line_discount !== undefined) { fields.push('line_discount = ?'); values.push(item.line_discount); }
    if (item.list_line_total_before_discount !== undefined) {
      fields.push('list_line_total_before_discount = ?');
      values.push(item.list_line_total_before_discount);
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
    const result = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(total_price), 0) as total FROM expense_items WHERE expense_id = ?',
      [expenseId]
    );
    if (result) {
      await db.runAsync('UPDATE expenses SET total_amount = ? WHERE id = ?', [result.total, expenseId]);
    }
  },

  async getTotalByDateRange(startDate: string, endDate: string): Promise<number> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(total_amount), 0) as total FROM expenses WHERE date BETWEEN ? AND ?',
      [startDate, endDate]
    );
    return result?.total || 0;
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
           ELSE 'Tasarruf / Diğer'
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
    // NOT: SQLite LOWER() yalnızca ASCII'yi küçültür; Ó/Ś/Ę/Ą/Ł/Ç gibi
    // harfler büyük kalıp gruplamayı bozar → aynı ürün birden çok satır
    // gibi görünür ve sayımlar yanlış çıkar. Bu yüzden ham kayıtları
    // çekip JS'te `normalizeItemKey` ile gruplarız.
    const rows = await db.getAllAsync<{
      name: string;
      turkish_name: string | null;
      unit_price: number;
      total_price: number;
      quantity: number;
      expense_date: string;
    }>(
      `SELECT i.name, i.turkish_name, i.unit_price, i.total_price, i.quantity, e.date as expense_date
       FROM expense_items i
       JOIN expenses e ON i.expense_id = e.id
       WHERE e.vendor_id = ? AND e.date BETWEEN ? AND ?
         AND i.unit_price > 0`,
      [vendorId, startDate, endDate]
    );

    interface Group {
      key: string;
      // Kanonik isim için oylar (en sık geçen yazım kazansın)
      nameCounts: Map<string, number>;
      turkishNameCounts: Map<string, number>;
      latestDate: string;
      latestName: string;
      latestTurkishName: string | null;
      purchase_count: number;
      total_spent: number;
      total_quantity: number;
    }

    const groups = new Map<string, Group>();
    for (const r of rows) {
      const key = normalizeItemKey(r.name);
      if (!key) continue;
      let g = groups.get(key);
      if (!g) {
        g = {
          key,
          nameCounts: new Map(),
          turkishNameCounts: new Map(),
          latestDate: r.expense_date,
          latestName: r.name,
          latestTurkishName: r.turkish_name,
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
      if (r.expense_date > g.latestDate) {
        g.latestDate = r.expense_date;
        g.latestName = r.name;
        g.latestTurkishName = r.turkish_name;
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
      purchase_count: g.purchase_count,
      total_spent: g.total_spent,
      total_quantity: g.total_quantity,
      normalized_key: g.key,
    }));

    aggregated.sort((a, b) => {
      if (b.purchase_count !== a.purchase_count) return b.purchase_count - a.purchase_count;
      return b.total_spent - a.total_spent;
    });

    return aggregated.slice(0, 10);
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

  async getItemAnalytics(itemName: string) {
    const db = await getDatabase();
    // NOT: SQLite LOWER() ASCII dışında çalışmaz; ayrıca Ł/ł ve Türkçe
    // noktasız ı NFD ile ayrışmaz. Bu yüzden SQL'de toplama yapmak yerine
    // ilgili tüm satırları çekip JS'te `normalizeItemKey` ile birebir eşleriz.
    // Böylece aynı ürünün farklı imlâlarındaki (örn. "Parówki" ↔ "PARÓWKI"
    // ↔ "parowki") tüm alım geçmişi tek toplamda gösterilir.
    const targetKey = normalizeItemKey(itemName);
    if (!targetKey) {
      return {
        stats: { total_spent: 0, avg_price: 0, purchase_count: 0, total_quantity: 0 },
        history: [],
      };
    }

    const rows = await db.getAllAsync<{
      name: string;
      date: string;
      unit_price: number;
      total_price: number;
      quantity: number;
      vendor_name: string | null;
    }>(
      `SELECT i.name, e.date, i.unit_price, i.total_price, i.quantity,
              v.name as vendor_name
       FROM expense_items i
       JOIN expenses e ON i.expense_id = e.id
       LEFT JOIN vendors v ON e.vendor_id = v.id
       ORDER BY e.date ASC, i.id ASC`
    );

    const matched = rows.filter((r) => normalizeItemKey(r.name) === targetKey);

    let total_spent = 0;
    let total_quantity = 0;
    let unit_price_sum = 0;
    for (const r of matched) {
      total_spent += Number(r.total_price) || 0;
      total_quantity += Number(r.quantity) || 0;
      unit_price_sum += Number(r.unit_price) || 0;
    }
    const purchase_count = matched.length;
    const avg_price = purchase_count > 0 ? unit_price_sum / purchase_count : 0;

    const history = matched.map((r) => ({
      date: r.date,
      unit_price: Number(r.unit_price) || 0,
      total_price: Number(r.total_price) || 0,
      quantity: Number(r.quantity) || 0,
      vendor_name: r.vendor_name || '',
    }));

    return {
      stats: { total_spent, avg_price, purchase_count, total_quantity },
      history,
    };
  },

  async getPriceHistory(lookbackMonths: number = 6) {
    const db = await getDatabase();
    const safeMonths = Math.max(1, Math.floor(Math.abs(lookbackMonths)));
    return db.getAllAsync<{ name: string; turkish_name: string | null; unit_price: number; date: string }>(
      `SELECT TRIM(i.name) as name, i.turkish_name, i.unit_price, e.date
       FROM expense_items i
       JOIN expenses e ON i.expense_id = e.id
       WHERE e.date >= date('now', '-' || ? || ' months')
         AND i.unit_price > 0
       ORDER BY TRIM(i.name), e.date ASC`,
      [safeMonths]
    );
  },

  async getTopTransactions(startDate: string, endDate: string, limit: number = 3) {
    const db = await getDatabase();
    return db.getAllAsync<ExpenseWithDetails>(
      `SELECT e.*,
              v.name as vendor_name, v.logo_uri as vendor_logo,
              c.name as category_name, c.icon as category_icon, c.color as category_color
       FROM expenses e
       LEFT JOIN vendors v ON e.vendor_id = v.id
       LEFT JOIN categories c ON e.category_id = c.id
       WHERE e.date BETWEEN ? AND ?
       ORDER BY e.total_amount DESC
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
   * Yaklaşım: Verilen aralıkta tüm `expense_items`'ı çek, JS'te
   * `normalizeItemKey` ile grupla. Şu kriterleri sağlayan kalemleri dön:
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
      unit_price: number;
      total_price: number;
      quantity: number;
      category_id: number | null;
      category_name: string | null;
      category_icon: string | null;
      category_color: string | null;
    }>(
      `SELECT i.name, i.turkish_name, i.unit_price, i.total_price, i.quantity,
              c.id as category_id, c.name as category_name,
              c.icon as category_icon, c.color as category_color
       FROM expense_items i
       JOIN expenses e ON i.expense_id = e.id
       LEFT JOIN categories c ON i.category_id = c.id
       WHERE e.date BETWEEN ? AND ?
         AND i.unit_price > 0`,
      [startDate, endDate]
    );

    interface Group {
      key: string;
      nameCounts: Map<string, number>;
      latestName: string;
      turkish_name: string | null;
      purchase_count: number;
      total_spent: number;
      total_quantity: number;
      unit_price_sum: number;
      category_name: string | null;
      category_icon: string | null;
      category_color: string | null;
    }

    const groups = new Map<string, Group>();
    for (const r of rows) {
      const key = normalizeItemKey(r.name);
      if (!key) continue;
      let g = groups.get(key);
      if (!g) {
        g = {
          key,
          nameCounts: new Map(),
          latestName: r.name,
          turkish_name: r.turkish_name,
          purchase_count: 0,
          total_spent: 0,
          total_quantity: 0,
          unit_price_sum: 0,
          category_name: r.category_name,
          category_icon: r.category_icon,
          category_color: r.category_color,
        };
        groups.set(key, g);
      }
      g.nameCounts.set(r.name, (g.nameCounts.get(r.name) || 0) + 1);
      g.purchase_count += 1;
      g.total_spent += Number(r.total_price) || 0;
      g.total_quantity += Number(r.quantity) || 0;
      g.unit_price_sum += Number(r.unit_price) || 0;
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
        purchase_count: g.purchase_count,
        total_spent: g.total_spent,
        avg_price: g.purchase_count > 0 ? g.unit_price_sum / g.purchase_count : 0,
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
