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

const CANONICAL_YMD_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Kanonik YYYY-MM-DD değerini UTC'ye uğratmadan yerel takvim tarihine çevirir.
 * Geçersiz takvim günleri (örn. 2026-02-29) sessizce başka güne taşınmaz.
 */
export function parseLocalYYYYMMDD(dateStr: string): Date | null {
  if (typeof dateStr !== 'string') return null;

  const match = dateStr.match(CANONICAL_YMD_PATTERN);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);

  const parsed = new Date(0);
  parsed.setHours(0, 0, 0, 0);
  parsed.setFullYear(year, monthIndex, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== monthIndex ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function parseDateForDisplay(dateStr: string): Date {
  if (CANONICAL_YMD_PATTERN.test(dateStr)) {
    return parseLocalYYYYMMDD(dateStr) ?? new Date(Number.NaN);
  }
  return new Date(dateStr);
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
  const d = parseDateForDisplay(dateStr);
  return `${d.getDate()} ${getMonthShort(d.getMonth(), t)} ${d.getFullYear()}`;
}

export function formatDateFull(dateStr: string, t?: TranslateFunc): string {
  const d = parseDateForDisplay(dateStr);
  return `${d.getDate()} ${getMonthFull(d.getMonth(), t)} ${d.getFullYear()}`;
}

export function formatMonthYear(dateStr: string, t?: TranslateFunc): string {
  const d = parseDateForDisplay(dateStr);
  return `${getMonthFull(d.getMonth(), t)} ${d.getFullYear()}`;
}

/** Yıl olmadan kompakt "gün kısa-ay" (ör. "23 May") — döngü aralığı etiketleri için. */
export function formatDayMonth(dateStr: string, t?: TranslateFunc): string {
  const d = parseDateForDisplay(dateStr);
  return `${d.getDate()} ${getMonthShort(d.getMonth(), t)}`;
}

/**
 * Bütçe/analiz dönemini ay adıyla takma adlandırmadan, tek ve kesin bir aralık
 * olarak gösterir. Aynı ay/yıl tekrarını sıkıştırır; yıl değişiminde iki yılı da
 * yazar (örn. "22 Ara 2026 – 21 Oca 2027").
 */
export function formatPeriodRange(
  startDateStr: string,
  endDateStr: string,
  t?: TranslateFunc,
): string {
  const start = parseDateForDisplay(startDateStr);
  const end = parseDateForDisplay(endDateStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';

  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  if (sameMonth) {
    return `${start.getDate()}–${end.getDate()} ${getMonthShort(end.getMonth(), t)} ${end.getFullYear()}`;
  }
  if (sameYear) {
    return `${formatDayMonth(startDateStr, t)} – ${formatDayMonth(endDateStr, t)} ${end.getFullYear()}`;
  }
  return `${formatDate(startDateStr, t)} – ${formatDate(endDateStr, t)}`;
}

export function getToday(): string {
  return toLocalYmd(new Date());
}

/** Normalize various date formats to YYYY-MM-DD for DB storage */
export function normalizeToYYYYMMDD(dateStr: string): string {
  if (!dateStr || typeof dateStr !== 'string') return getToday();
  const s = dateStr.trim();
  // Already YYYY-MM-DD
  if (CANONICAL_YMD_PATTERN.test(s)) {
    return parseLocalYYYYMMDD(s) ? s : getToday();
  }
  // DD.MM.YYYY or DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (dmy) {
    const [, day, month, year] = dmy;
    const canonical = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    return parseLocalYYYYMMDD(canonical) ? canonical : getToday();
  }
  // Try parsing as ISO or generic
  const d = new Date(s);
  if (!isNaN(d.getTime())) return toLocalYmd(d);
  return getToday();
}

/**
 * Yerel takvimde `months` ay öncesi (YYYY-MM-DD). Hedef ayda o gün yoksa ayın son
 * gününe sabitlenir: `setMonth` gibi taşmaz (31 Mart − 1 ay → 28/29 Şubat, 3 Mart değil).
 */
export function getLocalDateMonthsAgo(months: number, from: Date = new Date()): string {
  const target = new Date(from.getFullYear(), from.getMonth() - months, 1, 12);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(from.getDate(), lastDay));
  return toLocalYmd(target);
}

/** Yerel takvimde `days` gün öncesi (YYYY-MM-DD); UTC'ye uğramaz. */
export function getLocalDateDaysAgo(days: number, from: Date = new Date()): string {
  const target = new Date(from.getFullYear(), from.getMonth(), from.getDate() - days, 12);
  return toLocalYmd(target);
}

/** Yerel takvim günü + `days` (YYYY-MM-DD); geçersiz girişte `null`. */
export function addLocalDays(ymd: string, days: number): string | null {
  const base = parseLocalYYYYMMDD(ymd);
  if (!base) return null;
  return getLocalDateDaysAgo(-days, base);
}

/**
 * Bugünden `ymd` gününe kalan yerel takvim günü: bugün 0, yarın 1, dün -1.
 * İki taraf da yerel öğlene sabitlenir; yaz saati geçişi ve gün içindeki saat
 * sonucu değiştirmez. Geçersiz girişte `null` (UI denetimi FN-01 / CQ-04).
 */
export function daysUntilLocal(ymd: string, from: Date = new Date()): number | null {
  const target = parseLocalYYYYMMDD(ymd);
  if (!target) return null;
  const targetNoon = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 12);
  const todayNoon = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12);
  return Math.round((targetNoon.getTime() - todayNoon.getTime()) / 86_400_000);
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

export function groupByDate<T extends { date: string }>(items: T[]): Record<string, T[]> {
  return items.reduce((acc, item) => {
    const key = item.date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}
