import {
  buildSubscriptionAnalyticsInfo,
  monthlyEquivalentForPlan,
} from '../subscriptionAnalytics';
import type { RecurringPaymentReminder, SubscriptionWithDetails } from '../../db/schema';

function plan(overrides: Partial<RecurringPaymentReminder> = {}): RecurringPaymentReminder {
  return {
    id: 1,
    uid: 'plan-1',
    title: 'İnternet',
    vendor_id: null,
    expected_amount: 60,
    currency: 'PLN',
    anchor_date: '2026-08-01',
    next_due_date: '2026-08-25',
    recurrence_unit: 'month',
    recurrence_interval: 1,
    reminder_days_before: 3,
    reminder_time: '09:00',
    status: 'active',
    source: 'manual',
    note: null,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('subscription analytics', () => {
  it('kullanıcının eklediği aktif ödeme planını tek başına da Analiz özetine taşır', () => {
    const result = buildSubscriptionAnalyticsInfo([], [plan()], new Date(2026, 7, 21));

    expect(result.count).toBe(1);
    expect(result.monthlyTotal).toBe(60);
    expect(result.upcoming[0]).toMatchObject({
      id: 'confirmed:1',
      vendor_name: 'İnternet',
      amount: 60,
      daysUntil: 4,
      source: 'confirmed',
    });
  });

  it('aynı satıcıdaki otomatik tespiti onaylı planın yanında ikinci kez göstermez', () => {
    const detected = [{
      id: 8,
      vendor_id: 42,
      vendor_name: 'Play',
      amount: 45,
      currency: 'PLN',
      period_days: 30,
      next_expected_date: '2026-08-28',
      category_icon: null,
      category_color: null,
    }] as SubscriptionWithDetails[];

    const result = buildSubscriptionAnalyticsInfo(
      detected,
      [plan({ vendor_id: 42, title: 'Play', expected_amount: 50 })],
      new Date(2026, 7, 21),
    );

    expect(result.count).toBe(1);
    expect(result.monthlyTotal).toBe(50);
    expect(result.upcoming[0].source).toBe('confirmed');
  });

  it('tekrar aralığını 30 günlük karşılığa deterministik normalize eder', () => {
    expect(monthlyEquivalentForPlan(plan({ expected_amount: 14, recurrence_unit: 'week', recurrence_interval: 2 }))).toBe(30);
    expect(monthlyEquivalentForPlan(plan({ expected_amount: 120, recurrence_unit: 'year', recurrence_interval: 1 }))).toBe(10);
    expect(monthlyEquivalentForPlan(plan({ expected_amount: null }))).toBe(0);
  });
});
