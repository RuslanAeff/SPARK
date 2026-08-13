jest.mock('../database', () => ({ getDatabase: jest.fn() }));
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => '123e4567-e89b-42d3-a456-426614174000'),
}));

import { getDatabase } from '../database';
import { RecurringPaymentReminderDao } from '../recurringPaymentReminderDao';

const getDatabaseMock = getDatabase as jest.MockedFunction<typeof getDatabase>;

describe('RecurringPaymentReminderDao', () => {
  const getFirstAsync = jest.fn();
  const getAllAsync = jest.fn();
  const runAsync = jest.fn();
  const withTransactionAsync = jest.fn(async (operation: () => Promise<void>) => operation());

  beforeEach(() => {
    jest.clearAllMocks();
    getFirstAsync.mockResolvedValue(null);
    getAllAsync.mockResolvedValue([]);
    runAsync.mockResolvedValue({ changes: 1, lastInsertRowId: 12 });
    getDatabaseMock.mockResolvedValue({
      getFirstAsync,
      getAllAsync,
      runAsync,
      withTransactionAsync,
    } as any);
  });

  it('UUID ve güvenli varsayılanlarla manuel hatırlatıcı oluşturur', async () => {
    await expect(RecurringPaymentReminderDao.create({
      title: 'Ev interneti',
      expectedAmount: 79.999,
      anchorDate: '2026-01-31',
      nextDueDate: '2026-08-31',
      recurrenceUnit: 'month',
    })).resolves.toBe(12);

    const [sql, params] = runAsync.mock.calls[0];
    expect(sql).toContain('INSERT INTO recurring_payment_reminders');
    expect(params.slice(0, 14)).toEqual([
      '123e4567-e89b-42d3-a456-426614174000',
      'Ev interneti',
      null,
      80,
      'PLN',
      '2026-01-31',
      '2026-08-31',
      'month',
      1,
      3,
      '09:00',
      'active',
      'manual',
      null,
    ]);
  });

  it('backup UID değerini korur ve canonical lowercase saklar', async () => {
    await RecurringPaymentReminderDao.create({
      uid: '123E4567-E89B-42D3-A456-426614174000',
      title: 'Telefon',
      anchorDate: '2026-08-01',
      nextDueDate: '2026-08-01',
      recurrenceUnit: 'month',
    });

    expect(runAsync.mock.calls[0][1][0]).toBe('123e4567-e89b-42d3-a456-426614174000');
  });

  it('backup ile aynı RFC UUID sözleşmesine uymayan UID değerini reddeder', async () => {
    await expect(RecurringPaymentReminderDao.create({
      uid: '00000000-0000-0000-0000-000000000000',
      title: 'Telefon',
      anchorDate: '2026-08-01',
      nextDueDate: '2026-08-01',
      recurrenceUnit: 'month',
    })).rejects.toThrow('Invalid reminder uid');
    expect(runAsync).not.toHaveBeenCalled();
  });

  it.each([
    [{ title: '', anchorDate: '2026-08-01', nextDueDate: '2026-08-01', recurrenceUnit: 'month' }],
    [{ title: 'X', anchorDate: '2026-02-30', nextDueDate: '2026-08-01', recurrenceUnit: 'month' }],
    [{ title: 'X', anchorDate: '2026-08-10', nextDueDate: '2026-08-01', recurrenceUnit: 'month' }],
    [{ title: 'X', anchorDate: '2026-08-10', nextDueDate: '2026-09-09', recurrenceUnit: 'month' }],
    [{ title: 'X', anchorDate: '1999-12-31', nextDueDate: '2026-08-01', recurrenceUnit: 'month' }],
    [{ title: 'X', anchorDate: '2026-08-01', nextDueDate: '2026-08-01', recurrenceUnit: 'month', reminderTime: '25:00' }],
    [{ title: 'X', anchorDate: '2026-08-01', nextDueDate: '2026-08-01', recurrenceUnit: 'month', recurrenceInterval: 0 }],
    [{ title: 'X', anchorDate: '2026-08-01', nextDueDate: '2026-08-01', recurrenceUnit: 'month', expectedAmount: -1 }],
  ])('geçersiz create girdisini DB yazısından önce reddeder: %j', async (input) => {
    await expect(RecurringPaymentReminderDao.create(input as any)).rejects.toThrow();
    expect(runAsync).not.toHaveBeenCalled();
  });

  it('detected kaynağı vendor olmadan oluşturmaz', async () => {
    await expect(RecurringPaymentReminderDao.create({
      title: 'Algılanan ödeme',
      anchorDate: '2026-08-01',
      nextDueDate: '2026-09-01',
      recurrenceUnit: 'month',
      source: 'detected',
    })).rejects.toThrow('requires a vendor');
    expect(runAsync).not.toHaveBeenCalled();
  });

  it('yalnız aktif ve vadesi gelen hatırlatıcıları kararlı sırayla listeler', async () => {
    await RecurringPaymentReminderDao.listDue('2026-08-20');

    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).toContain("status = 'active' AND next_due_date <= ?");
    expect(sql).toContain('ORDER BY next_due_date ASC, id ASC');
    expect(params).toEqual(['2026-08-20']);
  });

  it('geçersiz ilerletme referansını transaction açmadan reddeder', async () => {
    await expect(RecurringPaymentReminderDao.advancePastDue('2026-02-30'))
      .rejects.toThrow('Invalid reference date');

    expect(getDatabaseMock).not.toHaveBeenCalled();
    expect(withTransactionAsync).not.toHaveBeenCalled();
  });

  it('yalnız aktif ve bugünden eski imleçleri aynı transaction içinde ilerletir', async () => {
    getAllAsync.mockResolvedValueOnce([
      {
        id: 7,
        anchor_date: '2026-01-31',
        next_due_date: '2026-07-31',
        recurrence_unit: 'month',
        recurrence_interval: 1,
      },
      {
        id: 8,
        anchor_date: '2026-08-02',
        next_due_date: '2026-08-08',
        recurrence_unit: 'day',
        recurrence_interval: 2,
      },
    ]);
    runAsync
      .mockResolvedValueOnce({ changes: 1 })
      .mockResolvedValueOnce({ changes: 0 });

    await expect(RecurringPaymentReminderDao.advancePastDue('2026-08-31'))
      .resolves.toBe(1);

    expect(withTransactionAsync).toHaveBeenCalledTimes(1);
    const [selectSql, selectParams] = getAllAsync.mock.calls[0];
    expect(selectSql).toContain("status = 'active' AND next_due_date < ?");
    expect(selectSql).not.toContain('next_due_date <= ?');
    expect(selectParams).toEqual(['2026-08-31']);

    expect(runAsync).toHaveBeenCalledTimes(2);
    expect(runAsync.mock.calls[0][0]).toContain(
      'AND anchor_date = ?',
    );
    expect(runAsync.mock.calls[0][0]).toContain('AND recurrence_unit = ?');
    expect(runAsync.mock.calls[0][0]).toContain('AND recurrence_interval = ?');
    expect(runAsync.mock.calls[0][0]).toContain("AND status = 'active'");
    expect(runAsync.mock.calls[0][0]).toContain('SET next_due_date = ?, updated_at = ?');
    expect(runAsync.mock.calls[0][1]).toEqual([
      '2026-08-31',
      expect.any(String),
      7,
      '2026-07-31',
      '2026-01-31',
      'month',
      1,
    ]);
    expect(runAsync.mock.calls[1][1]).toEqual([
      '2026-09-01',
      expect.any(String),
      8,
      '2026-08-08',
      '2026-08-02',
      'day',
      2,
    ]);
  });

  it('desteklenen takvim aralığında sonraki oluşum yoksa imleci değiştirmez', async () => {
    getAllAsync.mockResolvedValueOnce([{
      id: 9,
      anchor_date: '2100-01-01',
      next_due_date: '2100-01-01',
      recurrence_unit: 'year',
      recurrence_interval: 1,
    }]);

    await expect(RecurringPaymentReminderDao.advancePastDue('2100-12-31'))
      .resolves.toBe(0);

    expect(runAsync).not.toHaveBeenCalled();
  });

  it('pause/resume durumunu ve updated_at değerini birlikte yazar', async () => {
    await expect(RecurringPaymentReminderDao.pause(7)).resolves.toBe(true);
    await expect(RecurringPaymentReminderDao.resume(7)).resolves.toBe(true);

    expect(runAsync.mock.calls[0][0]).toContain("SET status = 'paused', updated_at = ?");
    expect(runAsync.mock.calls[0][1]).toEqual([expect.any(String), 7]);
    expect(runAsync.mock.calls[1][0]).toContain("SET status = 'active', updated_at = ?");
  });

  it('güncelleme ve silme gerçek changes sonucunu döndürür', async () => {
    getFirstAsync.mockResolvedValueOnce({
      vendor_id: 3,
      anchor_date: '2026-08-01',
      next_due_date: '2026-08-01',
      source: 'manual',
      recurrence_unit: 'month',
      recurrence_interval: 1,
    });
    await expect(RecurringPaymentReminderDao.update(4, {
      nextDueDate: '2026-09-01',
      reminderDaysBefore: 5,
    })).resolves.toBe(true);
    runAsync.mockResolvedValueOnce({ changes: 0 });
    await expect(RecurringPaymentReminderDao.remove(404)).resolves.toBe(false);

    expect(runAsync.mock.calls[0][0]).toContain(
      'next_due_date = ?, reminder_days_before = ?, updated_at = ?',
    );
    expect(runAsync.mock.calls[0][1]).toEqual([
      '2026-09-01', 5, expect.any(String), 4,
    ]);
    expect(runAsync.mock.calls[1]).toEqual([
      'DELETE FROM recurring_payment_reminders WHERE id = ?',
      [404],
    ]);
  });

  it('partial update ile tarih veya detected-vendor değişmezini bozdurmaz', async () => {
    getFirstAsync.mockResolvedValueOnce({
      vendor_id: null,
      anchor_date: '2026-08-10',
      next_due_date: '2026-09-10',
      source: 'manual',
      recurrence_unit: 'month',
      recurrence_interval: 1,
    });
    await expect(RecurringPaymentReminderDao.update(4, {
      nextDueDate: '2026-08-01',
    })).rejects.toThrow('cannot precede');

    getFirstAsync.mockResolvedValueOnce({
      vendor_id: null,
      anchor_date: '2026-08-10',
      next_due_date: '2026-09-10',
      source: 'manual',
      recurrence_unit: 'month',
      recurrence_interval: 1,
    });
    await expect(RecurringPaymentReminderDao.update(4, {
      source: 'detected',
    })).rejects.toThrow('requires a vendor');

    expect(runAsync).not.toHaveBeenCalled();
  });

  it('partial update ile sıradaki vadeyi tekrar programının dışına çıkarmaz', async () => {
    getFirstAsync.mockResolvedValueOnce({
      vendor_id: null,
      anchor_date: '2026-01-31',
      next_due_date: '2026-02-28',
      source: 'manual',
      recurrence_unit: 'month',
      recurrence_interval: 1,
    });

    await expect(RecurringPaymentReminderDao.update(4, {
      nextDueDate: '2026-03-30',
    })).rejects.toThrow('not a recurrence occurrence');
    expect(runAsync).not.toHaveBeenCalled();
  });
});
