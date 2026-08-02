import { computeSpendingStats } from '../spendingStats';

describe('computeSpendingStats', () => {
  it('counts inclusive calendar days with UTC ordinals across the Warsaw DST boundary', () => {
    const result = computeSpendingStats({
      dailyData: [],
      startDate: '2026-03-01',
      endDate: '2026-08-01',
      today: '2026-08-03',
    });

    expect(result.totalDays).toBe(154);
    expect(result.zeroSpendDays).toBe(154);
    expect(result.scopeStart).toBe('2026-03-01');
    expect(result.scopeEnd).toBe('2026-08-01');
  });

  it('excludes today from completed-day counts and resets a current streak when today has spending', () => {
    const result = computeSpendingStats({
      dailyData: [
        { date: '2026-08-01', total: 0 },
        { date: '2026-08-02', total: 20 },
      ],
      startDate: '2026-08-01',
      endDate: '2026-08-02',
      today: '2026-08-02',
    });

    expect(result).toMatchObject({
      status: 'ready',
      streakMode: 'current',
      scopeEnd: '2026-08-01',
      totalDays: 1,
      zeroSpendDays: 1,
      currentStreak: 0,
    });
  });

  it('continues the current streak through yesterday when today has no spending', () => {
    const result = computeSpendingStats({
      dailyData: [{ date: '2026-07-30', total: 10 }],
      startDate: '2026-07-30',
      endDate: '2026-08-02',
      today: '2026-08-02',
    });

    expect(result.currentStreak).toBe(2);
    expect(result.currentStreakDates).toEqual(['2026-07-31', '2026-08-01']);
  });

  it('labels a historical range streak as period_end', () => {
    const result = computeSpendingStats({
      dailyData: [{ date: '2026-06-01', total: 5 }],
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      today: '2026-08-02',
    });

    expect(result.streakMode).toBe('period_end');
    expect(result.currentStreakDates).toEqual(['2026-06-02', '2026-06-03']);
  });

  it('starts tracking mode at the first real source entry instead of inventing pre-history zeros', () => {
    const result = computeSpendingStats({
      dailyData: [
        { date: '2026-04-10', total: 12 },
        { date: '2026-04-12', total: 8 },
      ],
      startDate: '2000-01-01',
      endDate: '2099-12-31',
      today: '2026-04-13',
      trackingMode: true,
    });

    expect(result).toMatchObject({
      status: 'ready',
      streakMode: 'current',
      scopeStart: '2026-04-10',
      scopeEnd: '2026-04-12',
      totalDays: 3,
      zeroSpendDays: 1,
    });
    expect(result.zeroSpendDates).toEqual(['2026-04-11']);
  });

  it('returns no_data for an empty tracking period instead of treating it as zero spending', () => {
    const result = computeSpendingStats({
      dailyData: [],
      startDate: '2000-01-01',
      endDate: '2099-12-31',
      today: '2026-08-02',
      trackingMode: true,
    });

    expect(result).toMatchObject({
      status: 'no_data',
      scopeStart: null,
      scopeEnd: null,
      totalDays: 0,
      zeroSpendDays: 0,
      currentStreak: 0,
    });
  });

  it('sums duplicate dates and compares target values in cents', () => {
    const result = computeSpendingStats({
      dailyData: [
        { date: '2026-08-01', total: 4.004 },
        { date: '2026-08-01', total: 5.996 },
        { date: '2026-08-02', total: 10.01 },
      ],
      startDate: '2026-08-01',
      endDate: '2026-08-02',
      today: '2026-08-03',
      dailyTarget: 10,
      targetRange: { start: '2026-08-01', end: '2026-08-02' },
    });

    expect(result.dailyTarget).toBe(10);
    expect(result.underBudgetEntries).toEqual([{ date: '2026-08-01', total: 10 }]);
    expect(result.underBudgetDays).toBe(1);
    expect(result.zeroSpendDays).toBe(0);
  });

  it('uses the target only inside its explicit range and excludes zero days', () => {
    const result = computeSpendingStats({
      dailyData: [
        { date: '2026-08-01', total: 5 },
        { date: '2026-08-02', total: 5 },
        { date: '2026-08-03', total: 0 },
        { date: '2026-08-04', total: 5 },
      ],
      startDate: '2026-08-01',
      endDate: '2026-08-04',
      today: '2026-08-05',
      dailyTarget: 10,
      targetRange: { start: '2026-08-02', end: '2026-08-03' },
    });

    expect(result.underBudgetEntries).toEqual([{ date: '2026-08-02', total: 5 }]);
    expect(result.zeroSpendDates).toEqual(['2026-08-03']);
  });

  it('ignores an invalid or incomplete target contract', () => {
    const result = computeSpendingStats({
      dailyData: [{ date: '2026-08-01', total: 5 }],
      startDate: '2026-08-01',
      endDate: '2026-08-01',
      today: '2026-08-02',
      dailyTarget: 10,
    });

    expect(result.dailyTarget).toBeNull();
    expect(result.underBudgetDays).toBe(0);
  });

  it('returns no_completed_days when the selected scope starts today', () => {
    const result = computeSpendingStats({
      dailyData: [{ date: '2026-08-02', total: 5 }],
      startDate: '2026-08-02',
      endDate: '2026-08-10',
      today: '2026-08-02',
    });

    expect(result).toMatchObject({
      status: 'no_completed_days',
      streakMode: 'current',
      scopeStart: '2026-08-02',
      scopeEnd: null,
      totalDays: 0,
    });
  });

  it('rejects invalid or reversed selected ranges', () => {
    expect(() => computeSpendingStats({
      dailyData: [],
      startDate: '2026-02-30',
      endDate: '2026-03-01',
      today: '2026-03-02',
    })).toThrow(RangeError);

    expect(() => computeSpendingStats({
      dailyData: [],
      startDate: '2026-03-02',
      endDate: '2026-03-01',
      today: '2026-03-03',
    })).toThrow(RangeError);
  });
});
