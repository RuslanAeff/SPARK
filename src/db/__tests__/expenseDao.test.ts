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
