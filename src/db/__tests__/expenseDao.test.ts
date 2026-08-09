jest.mock('../database', () => ({ getDatabase: jest.fn() }));

import { getDatabase } from '../database';
import { ExpenseDao } from '../expenseDao';

const getDatabaseMock = getDatabase as jest.MockedFunction<typeof getDatabase>;

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

describe('ExpenseDao read projections', () => {
  const getAllAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    getAllAsync.mockResolvedValue([]);
    getDatabaseMock.mockResolvedValue({ getAllAsync } as any);
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
