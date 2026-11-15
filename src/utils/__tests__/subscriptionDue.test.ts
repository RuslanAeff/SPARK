import { daysUntilLocal } from '../dateUtils';
import { getSubscriptionDueStatus } from '../subscriptionDue';

const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min);

describe('daysUntilLocal (FN-01)', () => {
  it('counts yesterday, today and tomorrow as -1, 0, 1', () => {
    const now = at(2026, 11, 15, 10);
    expect(daysUntilLocal('2026-11-14', now)).toBe(-1);
    expect(daysUntilLocal('2026-11-15', now)).toBe(0);
    expect(daysUntilLocal('2026-11-16', now)).toBe(1);
  });

  it('does not depend on the time of day', () => {
    expect(daysUntilLocal('2026-11-15', at(2026, 11, 15, 0, 1))).toBe(0);
    expect(daysUntilLocal('2026-11-15', at(2026, 11, 15, 23, 59))).toBe(0);
    expect(daysUntilLocal('2026-11-16', at(2026, 11, 15, 23, 59))).toBe(1);
  });

  it('handles month ends and returns null for invalid dates', () => {
    expect(daysUntilLocal('2026-03-01', at(2026, 2, 28, 12))).toBe(1);
    expect(daysUntilLocal('2026-02-30', at(2026, 2, 28, 12))).toBeNull();
  });
});

describe('getSubscriptionDueStatus', () => {
  const now = at(2026, 11, 15, 9);
  it('labels a past date as overdue', () => {
    expect(getSubscriptionDueStatus('2026-11-13', now)).toMatchObject({ labelKey: 'subscription_overdue', tone: 'overdue' });
  });
  it('labels today and tomorrow correctly (was off by one)', () => {
    expect(getSubscriptionDueStatus('2026-11-15', now)).toMatchObject({ labelKey: 'subscription_due_today', tone: 'urgent' });
    expect(getSubscriptionDueStatus('2026-11-16', now)).toMatchObject({ labelKey: 'subscription_due_tomorrow', tone: 'urgent' });
  });
  it('uses the days label with soon/normal tones', () => {
    expect(getSubscriptionDueStatus('2026-11-18', now)).toMatchObject({ labelKey: 'subscription_due_in_days', params: { days: '3' }, tone: 'soon' });
    expect(getSubscriptionDueStatus('2026-11-25', now)).toMatchObject({ params: { days: '10' }, tone: 'normal' });
  });
});
