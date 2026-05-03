// S.P.A.R.K. — Tekrar eden ödeme (abonelik) tespiti
// Yapay zeka değil, yerel SQLite verisi üzerinden istatistiksel tespit:
//
//   • Son 6 ay içindeki harcamalar satıcıya göre gruplandırılır.
//   • Her satıcı için kayıtlar tarih sırasına dizilir.
//   • Ardışık iki kayıt arasındaki gün farkları hesaplanır.
//   • Bilinen periyotlardan birine uyuyorsa (haftalık 6-8, aylık 27-33,
//     iki aylık 56-64, üç aylık 85-95, yıllık 350-380), ve son 3+
//     ödeme aynı periyot bandına düşüyorsa abonelik kabul edilir.
//   • Ödeme tutarları arasında %15'ten fazla sapma varsa elenir.
//   • Sonuçlar `subscriptions` tablosuna upsert edilir.
//
// Kullanıcının "abonelik değil" tepkisi (status='dismissed') korunur;
// aynı satıcı tekrar tespit edilse de status değişmez.
import { getDatabase } from '../db/database';
import { SubscriptionDao } from '../db/subscriptionDao';
import type { SubscriptionRow } from '../db/schema';

interface PeriodBand {
  /** Periyot etiketi — UI için key. */
  key: 'weekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'yearly';
  /** Bandın merkez gün sayısı. */
  centerDays: number;
  /** Min — max (inclusive) — sapma toleransı. */
  minDays: number;
  maxDays: number;
}

const PERIOD_BANDS: PeriodBand[] = [
  { key: 'weekly', centerDays: 7, minDays: 6, maxDays: 8 },
  { key: 'monthly', centerDays: 30, minDays: 27, maxDays: 33 },
  { key: 'bimonthly', centerDays: 60, minDays: 56, maxDays: 64 },
  { key: 'quarterly', centerDays: 90, minDays: 85, maxDays: 95 },
  { key: 'yearly', centerDays: 365, minDays: 350, maxDays: 380 },
];

/** Minimum tespit eşiği — en az bu kadar uyumlu ödeme bulunmalı. */
const MIN_OCCURRENCES = 3;
/** Tutarlar arası kabul edilebilir maksimum sapma (oran). */
const MAX_AMOUNT_VARIANCE = 0.15;
/** Lookback penceresi (gün). */
const LOOKBACK_DAYS = 220;

interface CandidateRow {
  vendor_id: number;
  amount: number;
  currency: string;
  date: string;
}

function dayDiff(a: string, b: string): number {
  const da = new Date(a + 'T12:00:00').getTime();
  const db = new Date(b + 'T12:00:00').getTime();
  return Math.round(Math.abs(db - da) / (86400 * 1000));
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function classifyInterval(days: number): PeriodBand | null {
  for (const b of PERIOD_BANDS) {
    if (days >= b.minDays && days <= b.maxDays) return b;
  }
  return null;
}

function meanAmount(rows: CandidateRow[]): number {
  if (rows.length === 0) return 0;
  return rows.reduce((s, r) => s + r.amount, 0) / rows.length;
}

function amountVariance(rows: CandidateRow[]): number {
  if (rows.length < 2) return 0;
  const m = meanAmount(rows);
  if (m === 0) return Infinity;
  const dev = rows.map((r) => Math.abs(r.amount - m) / m);
  return Math.max(...dev);
}

interface DetectionResult {
  vendor_id: number;
  amount: number;
  currency: string;
  period: PeriodBand;
  last_seen_date: string;
  next_expected_date: string;
  occurrences: number;
}

function detectForVendor(rows: CandidateRow[]): DetectionResult | null {
  if (rows.length < MIN_OCCURRENCES) return null;
  // Tarih artan
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));

  // Sondan geriye doğru, en uzun aynı banda düşen ardışık zinciri bul.
  // Min 2 aralık (yani 3 ödeme) gerekir.
  let bestBand: PeriodBand | null = null;
  let bestChain: CandidateRow[] = [];

  for (let start = 0; start <= sorted.length - MIN_OCCURRENCES; start++) {
    const intervals: { band: PeriodBand; days: number }[] = [];
    for (let i = start; i < sorted.length - 1; i++) {
      const d = dayDiff(sorted[i].date, sorted[i + 1].date);
      const band = classifyInterval(d);
      if (!band) {
        intervals.length = 0;
        break;
      }
      intervals.push({ band, days: d });
    }
    if (intervals.length === 0) continue;
    // Tüm aralıkların aynı banda düşmesini şart koş
    const firstBand = intervals[0].band;
    const allSame = intervals.every((iv) => iv.band.key === firstBand.key);
    if (!allSame) continue;
    const chain = sorted.slice(start);
    if (chain.length > bestChain.length) {
      bestChain = chain;
      bestBand = firstBand;
    }
  }

  if (!bestBand || bestChain.length < MIN_OCCURRENCES) return null;
  const variance = amountVariance(bestChain);
  if (variance > MAX_AMOUNT_VARIANCE) return null;

  const avgAmount = meanAmount(bestChain);
  const last = bestChain[bestChain.length - 1];

  return {
    vendor_id: last.vendor_id,
    amount: Math.round(avgAmount * 100) / 100,
    currency: last.currency,
    period: bestBand,
    last_seen_date: last.date,
    next_expected_date: addDays(last.date, bestBand.centerDays),
    occurrences: bestChain.length,
  };
}

/**
 * Tüm aktif aboneliklerin tespitini yeniden çalıştırır ve tabloya yazar.
 * Çağrılma yerleri:
 *  • runNotificationSync (her senkronda — debounce'lu, ucuz)
 *  • Subscriptions ekranı pull-to-refresh
 *  • Yeni harcama eklendikten sonra (RefreshContext üzerinden dolaylı)
 */
export async function syncSubscriptions(): Promise<{ active: number }> {
  const db = await getDatabase();
  const since = new Date();
  since.setDate(since.getDate() - LOOKBACK_DAYS);
  const sinceIso = since.toISOString().slice(0, 10);

  const rows = await db.getAllAsync<CandidateRow>(
    `SELECT vendor_id, total_amount AS amount, currency, date
       FROM expenses
      WHERE vendor_id IS NOT NULL
        AND date >= ?`,
    [sinceIso]
  );

  // Vendor bazlı grupla
  const byVendor = new Map<number, CandidateRow[]>();
  for (const r of rows) {
    if (!byVendor.has(r.vendor_id)) byVendor.set(r.vendor_id, []);
    byVendor.get(r.vendor_id)!.push(r);
  }

  const detectedVendorIds: number[] = [];
  const now = new Date().toISOString();

  for (const [vendorId, list] of byVendor) {
    const detection = detectForVendor(list);
    if (!detection) continue;
    detectedVendorIds.push(vendorId);
    const sub: Omit<SubscriptionRow, 'id'> = {
      vendor_id: vendorId,
      amount: detection.amount,
      currency: detection.currency,
      period_days: detection.period.centerDays,
      last_seen_date: detection.last_seen_date,
      next_expected_date: detection.next_expected_date,
      occurrences: detection.occurrences,
      status: 'active',
      updated_at: now,
    };
    await SubscriptionDao.upsert(sub);
  }

  // Artık tespit edilmeyen aktif kayıtları temizle (dismissed olanlar kalır).
  await SubscriptionDao.deactivateMissing(detectedVendorIds);

  return { active: detectedVendorIds.length };
}

export function periodLabelKey(periodDays: number): string {
  if (periodDays <= 8) return 'subscription_period_weekly';
  if (periodDays <= 33) return 'subscription_period_monthly';
  if (periodDays <= 64) return 'subscription_period_bimonthly';
  if (periodDays <= 95) return 'subscription_period_quarterly';
  return 'subscription_period_yearly';
}

/** UI'da kullanılan toplam aylık eşdeğer hesap. */
export function monthlyEquivalent(amount: number, periodDays: number): number {
  if (periodDays <= 0) return amount;
  return (amount * 30) / periodDays;
}
