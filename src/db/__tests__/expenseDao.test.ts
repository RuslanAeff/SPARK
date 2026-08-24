jest.mock('../database', () => ({ getDatabase: jest.fn() }));

import { getDatabase } from '../database';
import { ExpenseDao } from '../expenseDao';

const getDatabaseMock = getDatabase as jest.MockedFunction<typeof getDatabase>;

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

describe('ExpenseDao read projections', () => {
  const getAllAsync = jest.fn();
  const getFirstAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    getAllAsync.mockResolvedValue([]);
    getFirstAsync.mockResolvedValue(null);
    getDatabaseMock.mockResolvedValue({ getAllAsync, getFirstAsync } as any);
  });

  it('global takip başlangıcını ilk harcama tarihinden okur', async () => {
    getFirstAsync.mockResolvedValue({ first_date: '2026-07-10' });

    await expect(ExpenseDao.getFirstExpenseDate()).resolves.toBe('2026-07-10');
    expect(getFirstAsync).toHaveBeenCalledWith('SELECT MIN(date) as first_date FROM expenses');
  });

  it('seçim verilmediğinde geriye uyumlu overall sorgusunu ve kararlı sıralamayı kullanır', async () => {
    await ExpenseDao.getTopTransactions('2026-01-01', '2026-12-31', 8);

    expect(getAllAsync).toHaveBeenCalledTimes(1);
    const [sql, params] = getAllAsync.mock.calls[0];
    const normalized = normalizeSql(sql);

    expect(normalized).not.toContain('ROW_NUMBER()');
    expect(normalized).toContain(
      'ORDER BY e.total_amount DESC, e.date DESC, e.id DESC LIMIT ?',
    );
    expect(params).toEqual(['2026-01-01', '2026-12-31', 8]);
  });

  it('per-vendor modunda her satıcının en yüksek tek gerçek işlem kimliğini seçer', async () => {
    await ExpenseDao.getTopTransactions(
      '2026-01-01',
      '2026-12-31',
      8,
      'per-vendor',
    );

    expect(getAllAsync).toHaveBeenCalledTimes(1);
    const [sql, params] = getAllAsync.mock.calls[0];
    const normalized = normalizeSql(sql);

    expect(normalized).toContain('ROW_NUMBER() OVER');
    expect(normalized).toContain(
      'PARTITION BY e.vendor_id, CASE WHEN e.vendor_id IS NULL THEN e.id ELSE 0 END',
    );
    expect(normalized).toContain(
      'ORDER BY e.total_amount DESC, e.date DESC, e.id DESC',
    );
    expect(normalized).toContain(
      'JOIN ranked_expense_ids ranked ON ranked.id = e.id AND ranked.vendor_rank = 1',
    );
    expect(params).toEqual(['2026-01-01', '2026-12-31', 8]);
  });

  it('satıcısız işlemleri aynı grupta çökertmeyen ayrı id partition anahtarı kullanır', async () => {
    await ExpenseDao.getTopTransactions(
      '2026-01-01',
      '2026-12-31',
      8,
      'per-vendor',
    );

    const [sql] = getAllAsync.mock.calls[0];
    expect(normalizeSql(sql)).toContain(
      'CASE WHEN e.vendor_id IS NULL THEN e.id ELSE 0 END',
    );
  });

  it('bildirim satıcılarını tekrarsız kimliklerle tek sorguda yükler', async () => {
    await ExpenseDao.getNotificationSubjectsByIds([7, 7, 0, -2, 11]);

    expect(getAllAsync).toHaveBeenCalledTimes(1);
    const [sql, params] = getAllAsync.mock.calls[0];
    const normalized = normalizeSql(sql);

    expect(normalized).toContain(
      'SELECT e.id AS expense_id, v.name AS vendor_name FROM expenses e',
    );
    expect(normalized).toContain('WHERE e.id IN (?,?)');
    expect(params).toEqual([7, 11]);
  });

  it('geçerli bildirim harcama kimliği yoksa veritabanına gitmez', async () => {
    await expect(ExpenseDao.getNotificationSubjectsByIds([0, -1])).resolves.toEqual([]);
    expect(getAllAsync).not.toHaveBeenCalled();
  });

  it('ürün analizinde istenen ölçü türünü ayırır ve ağırlıklı birim fiyat hesaplar', async () => {
    getAllAsync.mockResolvedValue([
      { name: 'Çilek', date: '2026-08-01', unit_price: 10, total_price: 5, quantity: 0.5, vendor_name: 'A', measurement_unit: 'kg' },
      { name: 'ÇİLEK', date: '2026-08-02', unit_price: 12, total_price: 12, quantity: 1, vendor_name: 'B', measurement_unit: 'kg' },
      { name: 'Çilek', date: '2026-08-03', unit_price: 3, total_price: 3, quantity: 1, vendor_name: 'C', measurement_unit: 'piece' },
    ]);

    const result = await ExpenseDao.getItemAnalytics('cilek', 'kg');

    expect(result.stats.purchase_count).toBe(2);
    expect(result.stats.total_quantity).toBe(1.5);
    expect(result.stats.avg_price).toBeCloseTo(17 / 1.5);
    expect(result.stats.measurement_unit).toBe('kg');
    expect(result.history).toHaveLength(2);
  });

  it('fiyat geçmişi sorgusunda ölçü, miktar ve satır toplamını birlikte taşır', async () => {
    await ExpenseDao.getPriceHistory(6);
    const [sql, params] = getAllAsync.mock.calls[0];
    const normalized = normalizeSql(sql);
    expect(normalized).toContain('i.total_price, i.quantity');
    expect(normalized).toContain('i.measurement_unit');
    expect(params).toEqual([6]);
  });

  it('satıcı ürünlerini ilk 10 kayıtta kesmeden alım sayısına göre döndürür', async () => {
    getAllAsync.mockResolvedValue(Array.from({ length: 12 }, (_, index) => ({
      name: `Ürün ${index + 1}`,
      turkish_name: null,
      unit_price: 10,
      total_price: 10,
      quantity: 1,
      expense_date: `2026-08-${String(index + 1).padStart(2, '0')}`,
    })));

    const result = await ExpenseDao.getVendorItems(1, '2026-08-01', '2026-08-31');

    expect(result).toHaveLength(12);
    expect(result.every(item => item.purchase_count === 1)).toBe(true);
  });

  it('satıcı analizinde kalıcı kimliği aynı, yazımı farklı kg satırlarını birleştirir', async () => {
    getAllAsync.mockResolvedValue([
      {
        name: 'Tavuk Baget', turkish_name: null, user_label: null,
        canonical_product_id: 42, canonical_name: 'Tavuk Baget', measurement_unit: 'kg',
        unit_price: 19, total_price: 9.5, quantity: 0.5, expense_date: '2026-08-01',
      },
      {
        name: 'TAVUK BAGET KG', turkish_name: null, user_label: null,
        canonical_product_id: 42, canonical_name: 'Tavuk Baget', measurement_unit: 'kg',
        unit_price: 21, total_price: 21, quantity: 1, expense_date: '2026-08-02',
      },
    ]);

    const result = await ExpenseDao.getVendorItems(1, '2026-08-01', '2026-08-31');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      canonical_product_id: 42,
      measurement_unit: 'kg',
      purchase_count: 2,
      total_quantity: 1.5,
      total_spent: 30.5,
    });
  });

  it('ürün detayında aynı kalıcı kimliğin farklı fiş adlarını birlikte getirir', async () => {
    getAllAsync.mockResolvedValue([
      {
        name: 'Tavuk Kanadı', turkish_name: null, user_label: null,
        canonical_product_id: 8, canonical_name: 'Tavuk Kanat',
        date: '2026-08-01', unit_price: 17, total_price: 8.5, quantity: 0.5,
        vendor_name: 'A', measurement_unit: 'kg',
      },
      {
        name: 'Tavuk Kanat Kg', turkish_name: null, user_label: null,
        canonical_product_id: 8, canonical_name: 'Tavuk Kanat',
        date: '2026-08-02', unit_price: 20, total_price: 20, quantity: 1,
        vendor_name: 'B', measurement_unit: 'kg',
      },
      {
        name: 'Tavuk Baget', turkish_name: null, user_label: null,
        canonical_product_id: 9, canonical_name: 'Tavuk Baget',
        date: '2026-08-03', unit_price: 22, total_price: 22, quantity: 1,
        vendor_name: 'C', measurement_unit: 'kg',
      },
    ]);

    const result = await ExpenseDao.getItemAnalytics('Tavuk Kanat', 'kg', 8);

    expect(result.stats.purchase_count).toBe(2);
    expect(result.history.map(item => item.name)).toEqual(['Tavuk Kanadı', 'Tavuk Kanat Kg']);
  });

  it('davranış analizinde sınıflandırılmayan harcamaları tasarruf diye sunmaz', async () => {
    await ExpenseDao.getNeedsVsWants('2026-08-01', '2026-08-31');
    const [sql] = getAllAsync.mock.calls[0];
    const normalized = normalizeSql(sql);
    expect(normalized).toContain("ELSE 'Diğer Harcamalar'");
    expect(normalized).not.toContain('Tasarruf / Diğer');
  });
});

describe('ExpenseDao receipt money writes', () => {
  const getFirstAsync = jest.fn();
  const runAsync = jest.fn();
  const withTransactionAsync = jest.fn(async (operation: () => Promise<void>) => operation());

  beforeEach(() => {
    jest.clearAllMocks();
    getFirstAsync.mockResolvedValue({ total_minor: 5593 });
    runAsync.mockResolvedValue({ lastInsertRowId: 1 });
    getDatabaseMock.mockResolvedValue({
      getFirstAsync,
      runAsync,
      withTransactionAsync,
    } as any);
  });

  it('expense header güncellemesinde binary float artığını saklamaz', async () => {
    await ExpenseDao.update(7, { total_amount: 55.00000000000003 });

    expect(runAsync).toHaveBeenCalledWith(
      'UPDATE expenses SET total_amount = ? WHERE id = ?',
      [55, 7],
    );
  });

  it('item toplamı ve indirimi kuruşa normalize eder', async () => {
    await ExpenseDao.updateItem(4, {
      total_price: 6.319999999999999,
      line_discount: 3.170000000000001,
      list_line_total_before_discount: 9.490000000000002,
    });

    expect(runAsync).toHaveBeenCalledWith(
      'UPDATE expense_items SET total_price = ?, line_discount = ?, list_line_total_before_discount = ? WHERE id = ?',
      [6.32, 3.17, 9.49, 4],
    );
  });

  it('kullanıcı etiketini ham name ve turkish_name alanlarını ezmeden günceller', async () => {
    await ExpenseDao.updateItem(4, { user_label: 'Tavuk Kanat' });

    expect(runAsync).toHaveBeenCalledWith(
      'UPDATE expense_items SET user_label = ? WHERE id = ?',
      ['Tavuk Kanat', 4],
    );
  });

  it('item toplamını SQLite REAL yerine integer minor-unit toplamından üretir', async () => {
    await ExpenseDao.syncExpenseTotal(9);

    expect(getFirstAsync.mock.calls[0][0]).toContain(
      'SUM(CAST(ROUND(total_price * 100, 0) AS INTEGER))',
    );
    expect(runAsync).toHaveBeenCalledWith(
      'UPDATE expenses SET total_amount = ? WHERE id = ?',
      [55.93, 9],
    );
  });

  it('item düzenleme ve header senkronunu tek transaction içinde tamamlar', async () => {
    await ExpenseDao.updateItemAndSyncTotal(9, 4, { total_price: 6.32 });

    expect(withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(runAsync).toHaveBeenNthCalledWith(
      1,
      'UPDATE expense_items SET total_price = ? WHERE id = ?',
      [6.32, 4],
    );
    expect(runAsync).toHaveBeenNthCalledWith(
      2,
      'UPDATE expenses SET total_amount = ? WHERE id = ?',
      [55.93, 9],
    );
  });

  it('başka harcamaya ait item kimliğini güncellemez', async () => {
    getFirstAsync.mockResolvedValueOnce(null);

    await expect(
      ExpenseDao.updateItemAndSyncTotal(9, 404, { total_price: 6.32 }),
    ).rejects.toThrow('Receipt item does not belong to expense');
    expect(runAsync).not.toHaveBeenCalled();
  });
});
