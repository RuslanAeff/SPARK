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
    // BUG-08: pencere başlangıcı yerel takvimden hesaplanmış tarih olarak bağlanır.
    expect(params).toEqual([expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)]);
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
    expect(normalized).toContain("ELSE 'other'");
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

describe('ExpenseDao header input validation (BUG-10)', () => {
  let runAsync: jest.Mock;

  beforeEach(() => {
    runAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 77 });
    getDatabaseMock.mockResolvedValue({ runAsync } as any);
  });

  const baseCreate = {
    vendor_id: null,
    category_id: 1,
    total_amount: 10,
    currency: 'PLN',
    note: null,
    receipt_uri: null,
    date: '2026-11-11',
  };

  it('create rejects an invalid date without writing', async () => {
    await expect(ExpenseDao.create({ ...baseCreate, date: '2026-13-45' } as any))
      .rejects.toThrow('INVALID_EXPENSE_DATE');
    expect(runAsync).not.toHaveBeenCalled();
  });

  it('update rejects an invalid date without writing', async () => {
    await expect(ExpenseDao.update(5, { date: '2026-13-45' }))
      .rejects.toThrow('INVALID_EXPENSE_DATE');
    expect(runAsync).not.toHaveBeenCalled();
  });

  it('update caps note to the backup contract and cleans currency', async () => {
    await ExpenseDao.update(5, { note: 'x'.repeat(2000), currency: '  EUR\u0000  ' });

    const [sql, values] = runAsync.mock.calls[0];
    expect(normalizeSql(sql)).toBe('UPDATE expenses SET currency = ?, note = ? WHERE id = ?');
    expect(values[0]).toBe('EUR');
    expect((values[1] as string).length).toBe(1000);
    expect(values[2]).toBe(5);
  });

  it('update stores empty note as NULL and empty currency as PLN', async () => {
    await ExpenseDao.update(5, { note: '   ', currency: '' });

    const [, values] = runAsync.mock.calls[0];
    expect(values).toEqual(['PLN', null, 5]);
  });

  it('create caps receipt_uri and note to backup limits', async () => {
    await ExpenseDao.create({
      ...baseCreate,
      note: 'n'.repeat(1500),
      receipt_uri: 'file://' + 'a'.repeat(3000),
    } as any);

    const [, values] = runAsync.mock.calls[0];
    expect((values[4] as string).length).toBe(1000);
    expect((values[5] as string).length).toBe(2000);
    expect(values[8]).toBe('2026-11-11');
  });
});

describe('ExpenseDao.deleteMany (BUG-06)', () => {
  let runAsync: jest.Mock;
  let withTransactionAsync: jest.Mock;

  beforeEach(() => {
    runAsync = jest.fn(async (sql: string, params: unknown[]) => (
      sql.startsWith('DELETE') ? { changes: params.length, lastInsertRowId: 0 } : { changes: 0, lastInsertRowId: 0 }
    ));
    withTransactionAsync = jest.fn(async (work: () => Promise<void>) => work());
    getDatabaseMock.mockClear();
    getDatabaseMock.mockResolvedValue({ runAsync, withTransactionAsync } as any);
  });

  const deleteCalls = () => runAsync.mock.calls.filter(([sql]) => String(sql).startsWith('DELETE'));

  it('deletes every selected id instead of silently stopping at 500', async () => {
    const ids = Array.from({ length: 600 }, (_, i) => i + 1);

    await expect(ExpenseDao.deleteMany(ids)).resolves.toBe(600);

    const deleted = deleteCalls().flatMap(([, params]) => params as number[]);
    expect(deleted).toHaveLength(600);
    expect(new Set(deleted)).toEqual(new Set(ids));
    deleteCalls().forEach(([, params]) => expect((params as number[]).length).toBeLessThanOrEqual(400));
  });

  it('runs all chunks in a single transaction so a late failure rolls everything back', async () => {
    const ids = Array.from({ length: 900 }, (_, i) => i + 1);
    let deletes = 0;
    runAsync.mockImplementation(async (sql: string) => {
      if (String(sql).startsWith('DELETE') && ++deletes === 2) throw new Error('synthetic');
      return { changes: 0, lastInsertRowId: 0 };
    });

    await expect(ExpenseDao.deleteMany(ids)).rejects.toThrow('synthetic');
    expect(withTransactionAsync).toHaveBeenCalledTimes(1);
  });

  it('returns the real deleted row count and ignores duplicates or invalid ids', async () => {
    runAsync.mockImplementation(async (sql: string) => (
      String(sql).startsWith('DELETE') ? { changes: 2, lastInsertRowId: 0 } : { changes: 0, lastInsertRowId: 0 }
    ));

    await expect(ExpenseDao.deleteMany([4, 4, -1, Number.NaN, 7, 9])).resolves.toBe(2);
    expect(deleteCalls()[0][1]).toEqual([4, 7, 9]);
  });

  it('does not open the database for an empty selection', async () => {
    await expect(ExpenseDao.deleteMany([])).resolves.toBe(0);
    expect(getDatabaseMock).not.toHaveBeenCalled();
  });
});

describe('ExpenseDao.getPriceHistory lookback (BUG-08)', () => {
  afterEach(() => jest.useRealTimers());

  it('pencere başlangıcını SQLite UTC "now" yerine yerel takvimden parametre olarak verir', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 31, 0, 30)); // Varşova 31 Ağu 00:30
    const getAllAsync = jest.fn().mockResolvedValue([]);
    getDatabaseMock.mockResolvedValue({ getAllAsync } as any);

    await ExpenseDao.getPriceHistory(6);

    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).not.toContain("date('now'");
    expect(normalizeSql(sql)).toContain('WHERE e.date >= ?');
    expect(params).toEqual(['2026-02-28']);
  });
});

describe('ExpenseDao deposit header sync on item edits (BUG-29)', () => {
  let getFirstAsync: jest.Mock;
  let runAsync: jest.Mock;
  let withTransactionAsync: jest.Mock;

  function mockReads(itemKind: 'product' | 'container_deposit' | null, sums: { total_minor: number; deposit_minor: number }) {
    getFirstAsync = jest.fn(async (sql: string) => {
      if (sql.includes('FROM expense_items WHERE id = ? AND expense_id = ?')) {
        return itemKind ? { id: 4, financial_kind: itemKind } : null;
      }
      if (sql.includes('total_minor')) return sums;
      if (sql.includes('container_voucher_used')) return { container_voucher_used: 0 };
      return null;
    });
    runAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 12 });
    withTransactionAsync = jest.fn(async (work: () => Promise<void>) => work());
    getDatabaseMock.mockResolvedValue({ getFirstAsync, runAsync, withTransactionAsync } as any);
  }

  const headerUpdate = () => runAsync.mock.calls.find(([sql]) => String(sql).startsWith('UPDATE expenses'));

  it('deleting a deposit item recomputes container_deposit_paid with the total', async () => {
    mockReads('container_deposit', { total_minor: 5000, deposit_minor: 0 });

    await ExpenseDao.deleteItemAndSyncTotal(9, 4);

    expect(headerUpdate()).toEqual([
      'UPDATE expenses SET total_amount = ?, container_deposit_paid = ? WHERE id = ?',
      [50, 0, 9],
    ]);
  });

  it('editing a deposit item keeps the header deposit equal to deposit lines', async () => {
    mockReads('container_deposit', { total_minor: 5100, deposit_minor: 100 });

    await ExpenseDao.updateItemAndSyncTotal(9, 4, { total_price: 1 });

    expect(headerUpdate()![1]).toEqual([51, 1, 9]);
  });

  it('adding a deposit item recomputes the header deposit', async () => {
    mockReads(null, { total_minor: 5050, deposit_minor: 50 });

    await ExpenseDao.addItemAndSyncTotal({
      expense_id: 9, name: 'Kaucja', quantity: 1, unit_price: 0.5, total_price: 0.5,
      category_id: null, financial_kind: 'container_deposit',
    } as any);

    expect(headerUpdate()![1]).toEqual([50.5, 0.5, 9]);
  });

  it('editing a product item leaves a printed header deposit untouched', async () => {
    mockReads('product', { total_minor: 5000, deposit_minor: 0 });

    await ExpenseDao.updateItemAndSyncTotal(9, 4, { total_price: 2 });

    expect(headerUpdate()).toEqual(['UPDATE expenses SET total_amount = ? WHERE id = ?', [50, 9]]);
  });
});
