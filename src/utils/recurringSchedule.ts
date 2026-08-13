// S.P.A.R.K. — Manuel ödeme/borç hatırlatıcıları için saf takvim tekrar motoru
//
// Bu modül yalnız kanonik YYYY-MM-DD takvim parçalarıyla çalışır. `Date`, UTC
// dönüşümü, cihaz saat dilimi, DB veya bildirim API'si kullanmaz. Böylece aynı
// program Europe/Warsaw ve başka bir saat diliminde aynı tarihi üretir.

export type RecurrenceUnit = 'day' | 'week' | 'month' | 'year';

export type RecurringSchedule =
  | Readonly<{
      kind: 'recurring';
      unit: RecurrenceUnit;
      /** Her kaç birimde bir tekrar edeceği; pozitif güvenli tamsayı. */
      interval: number;
      /** İlk oluşum ve ay/yıl tekrarlarının özgün gün anchor'ı. */
      anchorDate: string;
    }>
  | Readonly<{ kind: 'one_time'; dueDate: string }>;

/**
 * `on_or_after`: referans günü de geçerli bir oluşumdur.
 * `strictly_after`: referans günü dışlanır; yalnız daha sonraki oluşum döner.
 *
 * Boolean yerine isimli sınır kullanılması, "bugünkü ödeme tekrar gösterilsin
 * mi?" kararının çağrı yerinde açık olmasını sağlar.
 */
export type OccurrenceBoundary = 'on_or_after' | 'strictly_after';

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

const YMD_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MIN_YEAR = 1;
const MAX_YEAR = 9999;

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= min
    && value <= max;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if (month === 4 || month === 6 || month === 9 || month === 11) return 30;
  return 31;
}

/** 0001-01-01 öncesindeki gün sayısı. Proleptik Gregoryen takvim. */
function daysBeforeYear(year: number): number {
  const completedYears = year - 1;
  return 365 * completedYears
    + Math.floor(completedYears / 4)
    - Math.floor(completedYears / 100)
    + Math.floor(completedYears / 400);
}

function parseYmd(value: unknown): CalendarDate | null {
  if (typeof value !== 'string') return null;
  const match = YMD_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isIntegerInRange(year, MIN_YEAR, MAX_YEAR)) return null;
  if (!isIntegerInRange(month, 1, 12)) return null;
  if (!isIntegerInRange(day, 1, daysInMonth(year, month))) return null;
  return { year, month, day };
}

export function isValidYmd(value: unknown): value is string {
  return parseYmd(value) !== null;
}

/**
 * `referenceDate` ile `targetDate` arasındaki takvim günü ofsetini döndürür.
 *
 * Pozitif sonuç hedefin gelecekte, `0` aynı günde, negatif sonuç
 * geçmişte olduğunu ifade eder. Saat dilimi ve yaz/kış saati geçişlerinden
 * etkilenmez; geçersiz veya kanonik olmayan girdilerde fail-closed `null` döner.
 */
export function getCalendarDayOffset(
  referenceDate: unknown,
  targetDate: unknown,
): number | null {
  const reference = parseYmd(referenceDate);
  const target = parseYmd(targetDate);
  if (!reference || !target) return null;
  return toOrdinal(target) - toOrdinal(reference);
}

/**
 * Kanonik bir takvim tarihini belirtilen gün sayısı kadar kaydırır.
 *
 * Saat dilimi ve yaz/kış saati geçişlerinden etkilenmez. Geçersiz tarih,
 * güvenli tamsayı olmayan ofset veya desteklenen 0001–9999 yıl aralığının
 * dışına taşma durumunda fail-closed `null` döner.
 */
export function shiftCalendarDate(value: unknown, dayOffset: unknown): string | null {
  const date = parseYmd(value);
  if (!date || typeof dayOffset !== 'number' || !Number.isSafeInteger(dayOffset)) {
    return null;
  }
  const shiftedOrdinal = toOrdinal(date) + dayOffset;
  if (!Number.isSafeInteger(shiftedOrdinal)) return null;
  const shifted = fromOrdinal(shiftedOrdinal);
  return shifted ? toYmd(shifted) : null;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function toYmd(date: CalendarDate): string {
  return `${String(date.year).padStart(4, '0')}-${pad2(date.month)}-${pad2(date.day)}`;
}

function toOrdinal(date: CalendarDate): number {
  let ordinal = daysBeforeYear(date.year);
  for (let month = 1; month < date.month; month++) {
    ordinal += daysInMonth(date.year, month);
  }
  return ordinal + date.day - 1;
}

const MAX_ORDINAL = daysBeforeYear(MAX_YEAR + 1) - 1;

function fromOrdinal(ordinal: number): CalendarDate | null {
  if (!Number.isSafeInteger(ordinal) || ordinal < 0 || ordinal > MAX_ORDINAL) return null;

  // En büyük `daysBeforeYear(year) <= ordinal` yılını ikili aramayla bul.
  let low = MIN_YEAR;
  let high = MAX_YEAR;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (daysBeforeYear(middle) <= ordinal) low = middle + 1;
    else high = middle - 1;
  }
  const year = high;
  let dayOfYear = ordinal - daysBeforeYear(year);
  let month = 1;
  while (month <= 12) {
    const monthDays = daysInMonth(year, month);
    if (dayOfYear < monthDays) break;
    dayOfYear -= monthDays;
    month += 1;
  }
  return month <= 12 ? { year, month, day: dayOfYear + 1 } : null;
}

function acceptsBoundaryOrdinal(
  candidate: number,
  reference: number,
  boundary: OccurrenceBoundary,
): boolean {
  return boundary === 'on_or_after' ? candidate >= reference : candidate > reference;
}

function isBoundary(value: unknown): value is OccurrenceBoundary {
  return value === 'on_or_after' || value === 'strictly_after';
}

function isRecurrenceUnit(value: unknown): value is RecurrenceUnit {
  return value === 'day' || value === 'week' || value === 'month' || value === 'year';
}

function occurrenceInMonth(year: number, month: number, anchorDay: number): CalendarDate {
  return { year, month, day: Math.min(anchorDay, daysInMonth(year, month)) };
}

function occurrenceByDayInterval(
  anchor: CalendarDate,
  reference: CalendarDate,
  intervalDays: number,
  boundary: OccurrenceBoundary,
): string | null {
  if (!Number.isSafeInteger(intervalDays) || intervalDays <= 0) return null;
  const anchorOrdinal = toOrdinal(anchor);
  const referenceOrdinal = toOrdinal(reference);
  const requiredOrdinal = boundary === 'on_or_after' ? referenceOrdinal : referenceOrdinal + 1;
  const steps = requiredOrdinal <= anchorOrdinal
    ? 0
    : Math.ceil((requiredOrdinal - anchorOrdinal) / intervalDays);
  const offset = steps * intervalDays;
  if (!Number.isSafeInteger(offset)) return null;
  const occurrence = fromOrdinal(anchorOrdinal + offset);
  return occurrence ? toYmd(occurrence) : null;
}

function occurrenceByMonthInterval(
  anchor: CalendarDate,
  reference: CalendarDate,
  interval: number,
  boundary: OccurrenceBoundary,
): string | null {
  const anchorMonthIndex = (anchor.year - 1) * 12 + (anchor.month - 1);
  const referenceMonthIndex = (reference.year - 1) * 12 + (reference.month - 1);
  const monthDelta = referenceMonthIndex - anchorMonthIndex;
  let steps = monthDelta <= 0 ? 0 : Math.floor(monthDelta / interval);

  const candidateForStep = (step: number): CalendarDate | null => {
    const offset = step * interval;
    if (!Number.isSafeInteger(offset)) return null;
    const monthIndex = anchorMonthIndex + offset;
    const maxMonthIndex = (MAX_YEAR - 1) * 12 + 11;
    if (monthIndex < anchorMonthIndex || monthIndex > maxMonthIndex) return null;
    const year = Math.floor(monthIndex / 12) + 1;
    const month = (monthIndex % 12) + 1;
    // Her oluşum özgün anchor gününden üretilir; Şubat clamp'i Mart'a taşınmaz.
    return occurrenceInMonth(year, month, anchor.day);
  };

  let candidate = candidateForStep(steps);
  if (!candidate) return null;
  if (!acceptsBoundaryOrdinal(toOrdinal(candidate), toOrdinal(reference), boundary)) {
    steps += 1;
    candidate = candidateForStep(steps);
  }
  return candidate ? toYmd(candidate) : null;
}

function occurrenceByYearInterval(
  anchor: CalendarDate,
  reference: CalendarDate,
  interval: number,
  boundary: OccurrenceBoundary,
): string | null {
  const yearDelta = reference.year - anchor.year;
  let steps = yearDelta <= 0 ? 0 : Math.floor(yearDelta / interval);

  const candidateForStep = (step: number): CalendarDate | null => {
    const offset = step * interval;
    if (!Number.isSafeInteger(offset)) return null;
    const year = anchor.year + offset;
    if (year < anchor.year || year > MAX_YEAR) return null;
    // 29 Şubat gibi anchor'lar her hedef yılda özgün günden clamp edilir.
    return occurrenceInMonth(year, anchor.month, anchor.day);
  };

  let candidate = candidateForStep(steps);
  if (!candidate) return null;
  if (!acceptsBoundaryOrdinal(toOrdinal(candidate), toOrdinal(reference), boundary)) {
    steps += 1;
    candidate = candidateForStep(steps);
  }
  return candidate ? toYmd(candidate) : null;
}

/**
 * Bir programın referansa göre sıradaki takvim gününü döndürür.
 *
 * - Hiçbir recurring oluşum `anchorDate` öncesine gidemez.
 * - Ay/yıl tekrarları özgün anchor gününü korur ve kısa ayda ay sonuna çekilir.
 * - Gün/hafta tekrarları saf proleptik Gregoryen gün sırası üzerinde ilerler.
 * - Tek seferlik tarih tüketildikten sonra `null` döner.
 * - Geçersiz program, referans veya sınırda exception yerine `null` döner.
 */
export function getNextOccurrence(
  schedule: RecurringSchedule,
  referenceDate: string,
  boundary: OccurrenceBoundary,
): string | null {
  const reference = parseYmd(referenceDate);
  if (!reference || !isBoundary(boundary) || !schedule || typeof schedule !== 'object') {
    return null;
  }
  if (schedule.kind === 'recurring') {
    if (!isRecurrenceUnit(schedule.unit)) return null;
    if (!Number.isSafeInteger(schedule.interval) || schedule.interval <= 0) return null;
    const anchor = parseYmd(schedule.anchorDate);
    if (!anchor) return null;

    if (schedule.unit === 'day') {
      return occurrenceByDayInterval(anchor, reference, schedule.interval, boundary);
    }
    if (schedule.unit === 'week') {
      const intervalDays = schedule.interval * 7;
      return occurrenceByDayInterval(anchor, reference, intervalDays, boundary);
    }
    if (schedule.unit === 'month') {
      return occurrenceByMonthInterval(anchor, reference, schedule.interval, boundary);
    }
    return occurrenceByYearInterval(anchor, reference, schedule.interval, boundary);
  }

  if (schedule.kind === 'one_time') {
    const due = parseYmd(schedule.dueDate);
    if (!due) return null;
    return acceptsBoundaryOrdinal(toOrdinal(due), toOrdinal(reference), boundary)
      ? toYmd(due)
      : null;
  }

  return null;
}

/** Bir tarihin verilen tekrar programının gerçek bir oluşumu olup olmadığını doğrular. */
export function isRecurringOccurrence(
  unit: unknown,
  interval: unknown,
  anchorDate: unknown,
  candidateDate: unknown,
): boolean {
  if (!isRecurrenceUnit(unit)
    || typeof interval !== 'number'
    || typeof anchorDate !== 'string'
    || typeof candidateDate !== 'string') return false;
  return getNextOccurrence(
    { kind: 'recurring', unit, interval, anchorDate },
    candidateDate,
    'on_or_after',
  ) === candidateDate;
}
