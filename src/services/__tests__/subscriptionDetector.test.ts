// detectForVendor SAF bir algoritma; ancak modül DB importları içeriyor.
// Native SQLite jest'te yüklenmesin diye DB modülleri mock'lanır.
jest.mock('../../db/database', () => ({ getDatabase: jest.fn() }));
jest.mock('../../db/subscriptionDao', () => ({ SubscriptionDao: {} }));

import { detectForVendor, periodLabelKey, monthlyEquivalent } from '../subscriptionDetector';

type Row = { vendor_id: number; amount: number; currency: string; date: string };
const row = (date: string, amount = 50): Row => ({ vendor_id: 1, amount, currency: 'PLN', date });

describe('detectForVendor', () => {
  it('düzenli aylık ödemeleri abonelik olarak tespit eder', () => {
    const res = detectForVendor([
      row('2026-03-02'), // sırasız verilir → fonksiyon sıralar
      row('2026-01-01'),
      row('2026-01-31'),
    ]);
    expect(res).not.toBeNull();
    expect(res!.period.key).toBe('monthly');
    expect(res!.amount).toBe(50);
    expect(res!.occurrences).toBe(3);
    expect(res!.last_seen_date).toBe('2026-03-02');
  });

  it('haftalık ödemeleri tespit eder', () => {
    const res = detectForVendor([
      row('2026-01-01'),
      row('2026-01-08'),
      row('2026-01-15'),
    ]);
    expect(res).not.toBeNull();
    expect(res!.period.key).toBe('weekly');
  });

  it('3 ödemeden az ise null döner', () => {
    expect(detectForVendor([row('2026-01-01'), row('2026-01-31')])).toBeNull();
  });

  it('tutar sapması %15\'i aşarsa null döner', () => {
    const res = detectForVendor([
      row('2026-01-01', 50),
      row('2026-01-31', 50),
      row('2026-03-02', 100),
    ]);
    expect(res).toBeNull();
  });

  it('aralıklar bilinen periyoda uymuyorsa null döner', () => {
    const res = detectForVendor([
      row('2026-01-01'),
      row('2026-01-11'), // 10 gün — hiçbir banda uymaz
      row('2026-01-21'),
    ]);
    expect(res).toBeNull();
  });
});

describe('periodLabelKey', () => {
  it('gün sayısını doğru etikete eşler', () => {
    expect(periodLabelKey(7)).toBe('subscription_period_weekly');
    expect(periodLabelKey(30)).toBe('subscription_period_monthly');
    expect(periodLabelKey(60)).toBe('subscription_period_bimonthly');
    expect(periodLabelKey(90)).toBe('subscription_period_quarterly');
    expect(periodLabelKey(365)).toBe('subscription_period_yearly');
  });
});

describe('monthlyEquivalent', () => {
  it('periyodu 30 güne normalize eder', () => {
    expect(monthlyEquivalent(30, 30)).toBe(30);
    expect(monthlyEquivalent(120, 365)).toBeCloseTo(9.863, 2);
  });

  it('geçersiz periyotta tutarı aynen döner', () => {
    expect(monthlyEquivalent(50, 0)).toBe(50);
  });
});
