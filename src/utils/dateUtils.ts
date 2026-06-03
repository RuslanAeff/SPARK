// S.P.A.R.K. — Date Utilities
type TranslateFunc = (key: string, params?: Record<string, string | number>) => string;

/**
 * Yerel saat dilimine duyarlı YYYY-MM-DD üretici.
 * `Date.toISOString()` UTC'ye çevirir → kullanıcı yerel saatinde 23:30'da
 * "bugün" ertesi gün dönebilir veya `getEndOfMonth(Şubat)` 28 yerine 27 olabilir.
 * Bu fonksiyon yerel takvim gününü garanti eder.
 */
function toLocalYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMonthShort(monthIndex: number, t?: TranslateFunc): string {
  if (t) return t(`month_short_${String(monthIndex + 1).padStart(2, '0')}`);
  const fallback = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  return fallback[monthIndex];
}

function getMonthFull(monthIndex: number, t?: TranslateFunc): string {
  if (t) return t(`month_${String(monthIndex + 1).padStart(2, '0')}`);
  const fallback = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  return fallback[monthIndex];
}

export function formatDate(dateStr: string, t?: TranslateFunc): string {
  const d = new Date(dateStr);
  return `${d.getDate()} ${getMonthShort(d.getMonth(), t)} ${d.getFullYear()}`;
}

export function formatDateFull(dateStr: string, t?: TranslateFunc): string {
  const d = new Date(dateStr);
  return `${d.getDate()} ${getMonthFull(d.getMonth(), t)} ${d.getFullYear()}`;
}

export function formatMonthYear(dateStr: string, t?: TranslateFunc): string {
  const d = new Date(dateStr);
  return `${getMonthFull(d.getMonth(), t)} ${d.getFullYear()}`;
}

/** Yıl olmadan kompakt "gün kısa-ay" (ör. "23 May") — döngü aralığı etiketleri için. */
export function formatDayMonth(dateStr: string, t?: TranslateFunc): string {
  const d = new Date(dateStr);
  return `${d.getDate()} ${getMonthShort(d.getMonth(), t)}`;
}

export function getToday(): string {
  return toLocalYmd(new Date());
}

/** Normalize various date formats to YYYY-MM-DD for DB storage */
export function normalizeToYYYYMMDD(dateStr: string): string {
  if (!dateStr || typeof dateStr !== 'string') return getToday();
  const s = dateStr.trim();
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD.MM.YYYY or DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (dmy) {
    const [, day, month, year] = dmy;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  // Try parsing as ISO or generic
  const d = new Date(s);
  if (!isNaN(d.getTime())) return toLocalYmd(d);
  return getToday();
}

export function getStartOfMonth(date?: Date): string {
  const d = date || new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function getEndOfMonth(date?: Date): string {
  const d = date || new Date();
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return toLocalYmd(lastDay);
}

export function getDaysInMonth(date?: Date): number {
  const d = date || new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function getDayOfMonth(date?: Date): number {
  return (date || new Date()).getDate();
}

export function getMonthsArray(count: number = 6, t?: TranslateFunc): { label: string; start: string; end: string }[] {
  const result = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({
      label: getMonthShort(d.getMonth(), t).toLowerCase(),
      start: getStartOfMonth(d),
      end: getEndOfMonth(d),
    });
  }
  return result;
}

export function isToday(dateStr: string): boolean {
  return dateStr === getToday();
}

export function groupByDate<T extends { date: string }>(items: T[]): Record<string, T[]> {
  return items.reduce((acc, item) => {
    const key = item.date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}
