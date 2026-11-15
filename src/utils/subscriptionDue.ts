// S.P.A.R.K. — Abonelik vade etiketi (UI denetimi FN-01)
//
// Eski ekran hesabı hedefi öğlen, bugünü gece yarısı alıp `Math.ceil` ile
// yuvarlıyordu: bugün "Yarın", dün "Bugün" görünüyordu. Gün farkı artık tek
// yerden (`daysUntilLocal`) gelir; vadesi geçmiş abonelik ayrı "Gecikti"
// etiketi alır (ürün sahibi kararı, 15 Kasım 2026).
import { daysUntilLocal } from './dateUtils';

export type SubscriptionDueTone = 'overdue' | 'urgent' | 'soon' | 'normal';

export interface SubscriptionDueStatus {
  days: number;
  labelKey: 'subscription_overdue' | 'subscription_due_today' | 'subscription_due_tomorrow' | 'subscription_due_in_days';
  params?: { days: string };
  tone: SubscriptionDueTone;
}

export function getSubscriptionDueStatus(nextDate: string, today: Date = new Date()): SubscriptionDueStatus {
  // Bozuk tarih "uzak gelecek" sayılır: yanlış alarm üretmez.
  const days = daysUntilLocal(nextDate, today) ?? Number.MAX_SAFE_INTEGER;
  if (days < 0) return { days, labelKey: 'subscription_overdue', tone: 'overdue' };
  if (days === 0) return { days, labelKey: 'subscription_due_today', tone: 'urgent' };
  if (days === 1) return { days, labelKey: 'subscription_due_tomorrow', tone: 'urgent' };
  return {
    days,
    labelKey: 'subscription_due_in_days',
    params: { days: String(days) },
    tone: days <= 3 ? 'soon' : 'normal',
  };
}
