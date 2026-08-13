jest.mock('../database', () => ({ getDatabase: jest.fn() }));

import { getDatabase } from '../database';
import { DebtDao } from '../debtDao';

const getDatabaseMock = getDatabase as jest.MockedFunction<typeof getDatabase>;

describe('DebtDao reminder and repayment invariants', () => {
  const getFirstAsync = jest.fn();
  const getAllAsync = jest.fn();
  const runAsync = jest.fn();
  const withTransactionAsync = jest.fn(async (operation: () => Promise<void>) => operation());

  beforeEach(() => {
    jest.clearAllMocks();
    getFirstAsync.mockResolvedValue(null);
    getAllAsync.mockResolvedValue([]);
    runAsync.mockResolvedValue({ changes: 1, lastInsertRowId: 9 });
    getDatabaseMock.mockResolvedValue({
      getFirstAsync,
      getAllAsync,
      runAsync,
      withTransactionAsync,
    } as any);
  });

  it('vade ve hatırlatma ayarlarıyla borç oluşturur', async () => {
    await expect(DebtDao.create({
      counterparty: 'LandLord',
      amount: 2000.129,
      date: '2026-08-09',
      dueDate: '2026-08-15',
      reminderEnabled: true,
      reminderDaysBefore: 2,
      reminderTime: '08:30',
    })).resolves.toBe(9);

    const [sql, params] = runAsync.mock.calls[0];
    expect(sql).toContain('due_date, reminder_enabled, reminder_days_before, reminder_time');
    expect(params.slice(0, 12)).toEqual([
      'borrowed', 'LandLord', 2000.13, 2000.13, 'PLN', '2026-08-09',
      '2026-08-15', 1, 2, '08:30', null, null,
    ]);
  });

  it.each([0, -1, Number.NaN])('sıfır/geçersiz borç tutarını yazmaz: %p', async (amount) => {
    await expect(DebtDao.create({
      counterparty: 'Test',
      amount,
      date: '2026-08-09',
    })).rejects.toThrow('greater than zero');
    expect(runAsync).not.toHaveBeenCalled();
  });

  it('vadesiz etkin hatırlatmayı ve geçersiz takvim/saat girdisini reddeder', async () => {
    await expect(DebtDao.create({
      counterparty: 'Test', amount: 10, date: '2026-02-30',
    })).rejects.toThrow('Invalid debt date');
    await expect(DebtDao.create({
      counterparty: 'Test', amount: 10, date: '2026-08-09', reminderEnabled: true,
    })).rejects.toThrow('requires a due date');
    await expect(DebtDao.create({
      counterparty: 'Test', amount: 10, date: '2026-08-09', dueDate: '2026-02-30',
    })).rejects.toThrow('Invalid debt due date');
    await expect(DebtDao.create({
      counterparty: 'Test', amount: 10, date: '2026-08-09', dueDate: '1999-12-31',
    })).rejects.toThrow('Invalid debt due date');
    await expect(DebtDao.create({
      counterparty: 'Test', amount: 10, date: '2026-08-09', reminderTime: '24:00',
    })).rejects.toThrow('Invalid reminder time');
    expect(runAsync).not.toHaveBeenCalled();
  });

  it('sağlanan geçersiz ödeme tarihini bugüne sessizce dönüştürmez', async () => {
    await expect(DebtDao.repay(5, 10, '2026-02-30'))
      .rejects.toThrow('Invalid debt payment date');
    expect(withTransactionAsync).not.toHaveBeenCalled();
    expect(runAsync).not.toHaveBeenCalled();
  });

  it('hatırlatma ayarlarını tek UPDATE ile değiştirir ve opsiyonel değerleri korur', async () => {
    await expect(DebtDao.updateReminderSettings(4, {
      dueDate: '2026-09-01',
      reminderEnabled: true,
    })).resolves.toBe(true);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringMatching(/reminder_days_before = COALESCE[\s\S]*status = 'open'[\s\S]*remaining > 0/),
      ['2026-09-01', 1, null, null, 4],
    );
  });

  it('kapanmış veya bakiyesi kalmamış borçta hatırlatmayı yeniden etkinleştirmez', async () => {
    runAsync.mockResolvedValueOnce({ changes: 0, lastInsertRowId: 0 });

    await expect(DebtDao.updateReminderSettings(4, {
      dueDate: '2026-09-01',
      reminderEnabled: true,
    })).resolves.toBe(false);

    expect(runAsync.mock.calls[0][0]).toMatch(/status = 'open'[\s\S]*remaining > 0/);
  });

  it('kapanmış borçta kapalı ayar yazımını da eski ekran yarışına karşı reddeder', async () => {
    runAsync.mockResolvedValueOnce({ changes: 0, lastInsertRowId: 0 });

    await expect(DebtDao.updateReminderSettings(4, {
      dueDate: null,
      reminderEnabled: false,
    })).resolves.toBe(false);

    expect(runAsync.mock.calls[0][0]).toMatch(/status = 'open'[\s\S]*remaining > 0/);
  });

  it('kısmi ödemede hatırlatmayı korur', async () => {
    getFirstAsync.mockResolvedValueOnce({ remaining: 100 });

    await DebtDao.repay(5, 40, '2026-08-10');

    expect(withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(runAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('CASE WHEN ? = 1 THEN 0 ELSE reminder_enabled END'),
      [60, 'open', 0, 5],
    );
  });

  it('tam/fazla ödemeyi kalana kıstırır ve aynı transactionda hatırlatmayı kapatır', async () => {
    getFirstAsync.mockResolvedValueOnce({ remaining: 100 });

    await DebtDao.repay(5, 150, '2026-08-10');

    expect(runAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO debt_payments'),
      [5, 100, '2026-08-10', expect.any(String)],
    );
    expect(runAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('reminder_enabled'),
      [0, 'settled', 1, 5],
    );
  });

  it('geri ödeme çıkarımını minor-unit ile yapıp binary float artığı üretmez', async () => {
    getFirstAsync.mockResolvedValueOnce({ remaining: 0.3 });

    await DebtDao.repay(5, 0.1, '2026-08-10');

    expect(runAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('SET remaining = ?'),
      [0.2, 'open', 0, 5],
    );
  });

  it('yalnız açık, etkin ve vadesi gelen borçları kararlı sırayla listeler', async () => {
    await DebtDao.listDueReminders('2026-08-20');

    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).toContain("status = 'open'");
    expect(sql).toContain('reminder_enabled = 1');
    expect(sql).toContain('due_date <= ?');
    expect(sql).toContain('ORDER BY due_date ASC, id ASC');
    expect(params).toEqual(['2026-08-20']);
  });
});
