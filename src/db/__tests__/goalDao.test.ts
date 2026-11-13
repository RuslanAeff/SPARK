jest.mock('../database', () => ({ getDatabase: jest.fn() }));

import { getDatabase } from '../database';
import { GoalDao } from '../goalDao';

const getDatabaseMock = getDatabase as jest.MockedFunction<typeof getDatabase>;

describe('GoalDao clear contract', () => {
  const runAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    getDatabaseMock.mockResolvedValue({ runAsync } as any);
  });

  it('returns true only when a persisted goal was actually removed', async () => {
    runAsync.mockResolvedValueOnce({ changes: 1 });

    await expect(GoalDao.clear()).resolves.toBe(true);
    expect(runAsync).toHaveBeenCalledWith('DELETE FROM savings_goal WHERE id = 1');
  });

  it('returns false when there is no goal to remove', async () => {
    runAsync.mockResolvedValueOnce({ changes: 0 });

    await expect(GoalDao.clear()).resolves.toBe(false);
  });
});

const normalizeSql = (sql: string) => sql.replace(/\s+/g, ' ').trim();

describe('GoalDao input validation and atomic writes (BUG-09)', () => {
  let runAsync: jest.Mock;
  let getFirstAsync: jest.Mock;
  let withTransactionAsync: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    runAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 0 });
    getFirstAsync = jest.fn().mockResolvedValue({ current_amount: 30.3 });
    withTransactionAsync = jest.fn(async (work: () => Promise<void>) => work());
    getDatabaseMock.mockResolvedValue({ runAsync, getFirstAsync, withTransactionAsync } as any);
  });

  const validGoal = {
    title: '  Tatil  ',
    target_amount: 1500.005,
    target_date: '2027-06-01',
    currency: 'PLN',
  };

  it.each([
    ['empty title', { title: '   ' }],
    ['zero amount', { target_amount: 0 }],
    ['NaN amount', { target_amount: Number.NaN }],
    ['invalid date', { target_date: '2027-02-30' }],
  ])('upsert rejects %s without writing', async (_label, patch) => {
    await expect(GoalDao.upsert({ ...validGoal, ...patch })).rejects.toThrow('INVALID_SAVINGS_GOAL');
    expect(runAsync).not.toHaveBeenCalled();
  });

  it('upsert writes one sanitized statement and keeps current_amount when omitted', async () => {
    await GoalDao.upsert(validGoal);

    expect(runAsync).toHaveBeenCalledTimes(1);
    const [sql, params] = runAsync.mock.calls[0];
    expect(normalizeSql(sql)).toContain('ON CONFLICT(id) DO UPDATE SET');
    // Atlanan current_amount mevcut değeri tek ifade içinde korur (oku-yaz yarışı yok).
    expect(normalizeSql(sql)).toContain('COALESCE(?, (SELECT current_amount FROM savings_goal WHERE id = 1), 0)');
    expect(params).toEqual(['Tatil', 1500.01, '2027-06-01', 'PLN', null]);
  });

  it('addContribution is a single atomic UPDATE with rounding and a 0 floor', async () => {
    getFirstAsync.mockResolvedValue({ current_amount: 42.5 });

    await expect(GoalDao.addContribution(12.345)).resolves.toBe(42.5);

    expect(runAsync).toHaveBeenCalledTimes(1);
    const [sql, params] = runAsync.mock.calls[0];
    expect(normalizeSql(sql)).toBe(
      'UPDATE savings_goal SET current_amount = MAX(0, ROUND(current_amount + ?, 2)) WHERE id = 1',
    );
    expect(params).toEqual([12.35]);
  });

  it('addContribution returns 0 without reading when no goal exists', async () => {
    runAsync.mockResolvedValue({ changes: 0, lastInsertRowId: 0 });

    await expect(GoalDao.addContribution(5)).resolves.toBe(0);
    expect(getFirstAsync).not.toHaveBeenCalled();
  });

  it('addContribution rejects a non-finite delta', async () => {
    await expect(GoalDao.addContribution(Number.NaN)).rejects.toThrow('INVALID_SAVINGS_CONTRIBUTION');
    expect(runAsync).not.toHaveBeenCalled();
  });

  it('saveSettings writes goal and the month limit set in one transaction', async () => {
    await GoalDao.saveSettings({
      goal: { ...validGoal, current_amount: 20 },
      month: '2026-11',
      limits: [{ category_id: 7, limit_amount: 12.5 }, { category_id: 9, limit_amount: 300 }],
    });

    expect(withTransactionAsync).toHaveBeenCalledTimes(1);
    const statements = runAsync.mock.calls.map(([sql]) => normalizeSql(sql));
    expect(statements[0]).toContain('INSERT INTO savings_goal');
    expect(statements[1]).toBe('DELETE FROM category_limits WHERE month = ? AND category_id NOT IN (?, ?)');
    expect(runAsync.mock.calls[1][1]).toEqual(['2026-11', 7, 9]);
    expect(statements.slice(2).every(sql => sql.includes('ON CONFLICT(category_id, month) DO UPDATE'))).toBe(true);
    expect(runAsync.mock.calls[2][1]).toEqual([7, '2026-11', 12.5]);
  });

  it('saveSettings without goal and limits clears only that month', async () => {
    await GoalDao.saveSettings({ goal: null, month: '2026-11', limits: [] });

    expect(runAsync).toHaveBeenCalledTimes(1);
    expect(normalizeSql(runAsync.mock.calls[0][0])).toBe('DELETE FROM category_limits WHERE month = ?');
    expect(runAsync.mock.calls[0][1]).toEqual(['2026-11']);
  });

  it('saveSettings validates everything before opening the transaction', async () => {
    await expect(GoalDao.saveSettings({
      goal: validGoal,
      month: '2026-11',
      limits: [{ category_id: 7, limit_amount: 10 }, { category_id: 9, limit_amount: Number.NaN }],
    })).rejects.toThrow('INVALID_CATEGORY_LIMIT');
    expect(withTransactionAsync).not.toHaveBeenCalled();
    expect(runAsync).not.toHaveBeenCalled();
  });
});
