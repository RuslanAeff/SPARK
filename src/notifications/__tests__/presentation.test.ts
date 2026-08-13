import {
  localizeNotificationParams,
  notificationContentRevision,
} from '../presentation';

const MONTHS: Record<string, string> = {
  month_05: 'Mayıs',
  month_08: 'Ağustos',
};

const t = (key: string) => MONTHS[key] ?? key;

describe('notification presentation', () => {
  it('yerel tarih ve dönem parametrelerini aynı snapshot içinde biçimler', () => {
    expect(localizeNotificationParams(
      { date: '2026-08-11', month: '2026-05', untouched: 'x' },
      t,
    )).toEqual({
      date: '11 Ağustos 2026',
      month: 'Mayıs 2026',
      untouched: 'x',
    });
  });

  it('kanonik olmayan domain metnini değiştirmez', () => {
    const params = { date: '11.08.2026', month: 'Mayıs', count: 2 };
    expect(localizeNotificationParams(params, t)).toEqual(params);
  });

  it('içerik revisionı oluşturulma zamanından bağımsızdır ve finansal metin değişimini ayırır', () => {
    const base = {
      severity: 'warning' as const,
      titleKey: 'notif_debt_due_today_t',
      bodyKey: 'notif_debt_due_today_b',
      params: { amount: '100.00 PLN' },
    };
    expect(notificationContentRevision({ ...base, createdAt: 1 } as typeof base))
      .toBe(notificationContentRevision({ ...base, createdAt: 2 } as typeof base));
    expect(notificationContentRevision(base)).not.toBe(
      notificationContentRevision({ ...base, params: { amount: '90.00 PLN' } }),
    );
  });
});
