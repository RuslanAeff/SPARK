import {
  resolveAnalyticsDateRange,
  resolveComparableAnalyticsRanges,
  resolvePreviousAnalyticsDateRange,
} from '../analyticsPeriod';

describe('analytics period resolution', () => {
  it('ayın 23ünde başlayan bütçede 1 Ağustos Analytics penceresini Dashboard ile eşitler', () => {
    const current = resolveAnalyticsDateRange({
      timeframe: 'month',
      customStart: '2026-01-01',
      customEnd: '2026-01-31',
      budgetPeriodStart: '2026-07-23',
      budgetPeriodEnd: '2026-08-22',
      now: new Date(2026, 7, 1),
    });

    expect(current).toEqual({ start: '2026-07-23', end: '2026-08-22' });
    expect(resolvePreviousAnalyticsDateRange('month', current, 23)).toEqual({
      start: '2026-06-23',
      end: '2026-07-22',
    });
  });

  it('aktif özel aralıkta bugünü ve geleceği dışlayıp eşit ilerlemeyi karşılaştırır', () => {
    expect(resolveComparableAnalyticsRanges(
      'custom',
      { start: '2026-07-22', end: '2026-08-30' },
      23,
      new Date(2026, 7, 22, 12),
    )).toEqual({
      current: { start: '2026-07-22', end: '2026-08-21' },
      previous: { start: '2026-06-12', end: '2026-07-12' },
      completedDays: 31,
    });
  });

  it('aktif bütçe döngüsünü önceki döngünün aynı tamamlanmış günleriyle eşler', () => {
    expect(resolveComparableAnalyticsRanges(
      'month',
      { start: '2026-07-23', end: '2026-08-22' },
      23,
      new Date(2026, 7, 5, 12),
    )).toEqual({
      current: { start: '2026-07-23', end: '2026-08-04' },
      previous: { start: '2026-06-23', end: '2026-07-05' },
      completedDays: 13,
    });
  });

  it('seçili dönem bugün başlıyorsa henüz karşılaştırma üretmez', () => {
    expect(resolveComparableAnalyticsRanges(
      'custom',
      { start: '2026-08-22', end: '2026-08-22' },
      1,
      new Date(2026, 7, 22, 12),
    )).toBeNull();
  });

  it('başlangıç günü 1 olduğunda takvim ayı geriye uyumluluğunu korur', () => {
    const current = resolveAnalyticsDateRange({
      timeframe: 'month',
      customStart: '2026-01-01',
      customEnd: '2026-01-31',
      budgetPeriodStart: '2026-08-01',
      budgetPeriodEnd: '2026-08-31',
      now: new Date(2026, 7, 1),
    });

    expect(current).toEqual({ start: '2026-08-01', end: '2026-08-31' });
    expect(resolvePreviousAnalyticsDateRange('month', current, 1)).toEqual({
      start: '2026-07-01',
      end: '2026-07-31',
    });
  });

  it('haftalık ve özel aralıkları yerel takvim günleriyle geriye kaydırır', () => {
    const week = resolveAnalyticsDateRange({
      timeframe: 'week',
      customStart: '2026-01-01',
      customEnd: '2026-01-31',
      now: new Date(2026, 7, 1, 0, 30),
    });
    expect(week).toEqual({ start: '2026-07-26', end: '2026-08-01' });
    expect(resolvePreviousAnalyticsDateRange('week', week, 23)).toEqual({
      start: '2026-07-19',
      end: '2026-07-25',
    });

    const custom = { start: '2026-07-28', end: '2026-08-01' };
    expect(resolvePreviousAnalyticsDateRange('custom', custom, 23)).toEqual({
      start: '2026-07-23',
      end: '2026-07-27',
    });
  });
});
