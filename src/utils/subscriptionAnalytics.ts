import type {
  RecurringPaymentReminder,
  SubscriptionWithDetails,
} from '../db/schema';
import { roundMoney, sumMoney } from './moneyMath';

export interface ActiveSubscriptionAnalyticsItem {
  id: string;
  vendor_name: string;
  amount: number | null;
  currency: string;
  nextDate: string;
  daysUntil: number;
  category_icon: string | null;
  category_color: string | null;
  source: 'confirmed' | 'detected';
}

export interface SubscriptionAnalyticsInfo {
  count: number;
  monthlyTotal: number;
  upcoming: ActiveSubscriptionAnalyticsItem[];
}

function localDateAtNoon(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysUntil(value: string, today: Date): number {
  const next = localDateAtNoon(value);
  if (!next) return Number.MAX_SAFE_INTEGER;
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  return Math.round((next.getTime() - base.getTime()) / 86_400_000);
}

export function monthlyEquivalentForPlan(plan: RecurringPaymentReminder): number {
  if (plan.expected_amount == null) return 0;
  const interval = Math.max(1, plan.recurrence_interval);
  const multiplier = plan.recurrence_unit === 'day'
    ? 30 / interval
    : plan.recurrence_unit === 'week'
      ? 30 / (7 * interval)
      : plan.recurrence_unit === 'year'
        ? 1 / (12 * interval)
        : 1 / interval;
  return roundMoney(plan.expected_amount * multiplier);
}

/**
 * Kullanıcının onayladığı ödeme planları ile otomatik tespitleri tek görünümde
 * birleştirir. Aynı satıcı iki kaynakta da varsa onaylı plan kanonik kabul edilir.
 */
export function buildSubscriptionAnalyticsInfo(
  detected: SubscriptionWithDetails[],
  confirmed: RecurringPaymentReminder[],
  today = new Date(),
): SubscriptionAnalyticsInfo {
  const confirmedVendorIds = new Set(
    confirmed.flatMap(plan => plan.vendor_id == null ? [] : [plan.vendor_id]),
  );

  const confirmedItems: ActiveSubscriptionAnalyticsItem[] = confirmed.map(plan => ({
    id: `confirmed:${plan.id}`,
    vendor_name: plan.title,
    amount: plan.expected_amount,
    currency: plan.currency,
    nextDate: plan.next_due_date,
    daysUntil: daysUntil(plan.next_due_date, today),
    category_icon: null,
    category_color: null,
    source: 'confirmed',
  }));

  const remainingDetected = detected.filter(row => !confirmedVendorIds.has(row.vendor_id));
  const detectedItems: ActiveSubscriptionAnalyticsItem[] = remainingDetected.map(row => ({
    id: `detected:${row.id}`,
    vendor_name: row.vendor_name,
    amount: row.amount,
    currency: row.currency,
    nextDate: row.next_expected_date,
    daysUntil: daysUntil(row.next_expected_date, today),
    category_icon: row.category_icon,
    category_color: row.category_color,
    source: 'detected',
  }));

  const all = [...confirmedItems, ...detectedItems]
    .sort((a, b) => a.daysUntil - b.daysUntil || a.id.localeCompare(b.id));

  return {
    count: all.length,
    monthlyTotal: sumMoney([
      ...confirmed.map(monthlyEquivalentForPlan),
      ...remainingDetected.map(row => roundMoney(row.amount * (30 / (row.period_days || 30)))),
    ]),
    upcoming: all.slice(0, 3),
  };
}
