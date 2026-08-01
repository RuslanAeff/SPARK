import { getEndOfMonth, getStartOfMonth } from './dateUtils';
import { getCycleForKey, shiftCycleKey } from './budgetCycle';

export type AnalyticsTimeframe = 'week' | 'month' | 'year' | 'custom';

export interface AnalyticsDateRange {
  start: string;
  end: string;
}

interface ResolveAnalyticsDateRangeOptions {
  timeframe: AnalyticsTimeframe;
  customStart: string;
  customEnd: string;
  /** useBudget tarafından çözülmüş, kanonik bütçe döngüsü sınırları. */
  budgetPeriodStart?: string;
  budgetPeriodEnd?: string;
  now?: Date;
}

function toLocalYmd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function parseLocalYmd(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function addLocalDays(value: string, amount: number): string {
  const date = parseLocalYmd(value);
  date.setDate(date.getDate() + amount);
  return toLocalYmd(date);
}

function inclusiveDayCount(range: AnalyticsDateRange): number {
  const start = parseLocalYmd(range.start);
  const end = parseLocalYmd(range.end);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
}

/**
 * Analiz ekranının tek tarih penceresi.
 *
 * `month`, ürün dilinde bütçe dönemidir. Başlangıç günü 1 ise bu zaten takvim
 * ayıyla birebir aynıdır; farklıysa Dashboard'daki çapraz-ay döngüsü kullanılır.
 */
export function resolveAnalyticsDateRange({
  timeframe,
  customStart,
  customEnd,
  budgetPeriodStart,
  budgetPeriodEnd,
  now = new Date(),
}: ResolveAnalyticsDateRangeOptions): AnalyticsDateRange {
  if (timeframe === 'week') {
    const end = toLocalYmd(now);
    return { start: addLocalDays(end, -6), end };
  }

  if (timeframe === 'month') {
    if (budgetPeriodStart && budgetPeriodEnd) {
      return { start: budgetPeriodStart, end: budgetPeriodEnd };
    }
    return { start: getStartOfMonth(now), end: getEndOfMonth(now) };
  }

  if (timeframe === 'year') {
    return { start: '2000-01-01', end: '2099-12-31' };
  }

  return { start: customStart, end: customEnd };
}

/** Aynı uzunluk/sözleşmedeki bir önceki karşılaştırma penceresini çözer. */
export function resolvePreviousAnalyticsDateRange(
  timeframe: AnalyticsTimeframe,
  current: AnalyticsDateRange,
  cycleStartDay: number,
): AnalyticsDateRange | null {
  if (timeframe === 'year') return null;

  if (timeframe === 'month') {
    // Döngü anahtarı, döngünün başladığı YYYY-MM'dir.
    const currentKey = current.start.slice(0, 7);
    const previous = getCycleForKey(cycleStartDay, shiftCycleKey(currentKey, -1));
    return { start: previous.start, end: previous.end };
  }

  const days = inclusiveDayCount(current);
  const end = addLocalDays(current.start, -1);
  return { start: addLocalDays(end, -(days - 1)), end };
}
