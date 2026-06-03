// S.P.A.R.K. — Bütçe döngüsü (gelir gününe göre) — TEK KAYNAK
//
// Kullanıcı bütçesini takvim ayına değil, seçtiği bir "döngü başlangıç günü"ne
// göre takip edebilir (ör. her ayın 23'ü — maaş/destek günü). Bu modül anchor
// (başlangıç günü) değerinden döngü sınırlarını (start / end / key) hesaplar.
//
//  • anchor = 1 → döngü TAM olarak takvim ayına eşittir. Bu varsayılandır ve
//    eski davranışı birebir korur (start = ayın 1'i, end = ayın son günü).
//  • Kısa aylarda gün ay sonuna "clamp" edilir: anchor = 31 ise Şubat'ta 28/29,
//    Nisan'da 30 olur. Döngüler bu sayede boşluksuz/çakışmasız zincirlenir.
//
// Saf modül (leaf): React / DB importu yok → util ve testler db mock'u olmadan
// kullanabilir. Tüm tarihler yerel takvim günüdür (YYYY-MM-DD), UTC kaymaz.

export const DEFAULT_CYCLE_START_DAY = 1;
export const MIN_CYCLE_START_DAY = 1;
export const MAX_CYCLE_START_DAY = 31;

export interface BudgetCycle {
  /** Döngünün ilk günü (dahil), YYYY-MM-DD. */
  start: string;
  /** Döngünün son günü (dahil), YYYY-MM-DD. */
  end: string;
  /** Bütçe anahtarı = döngünün BAŞLADIĞI ay (YYYY-MM). anchor=1'de takvim ayı. */
  key: string;
  /** Döngüdeki toplam gün sayısı. */
  totalDays: number;
  /** Kullanılan (normalize edilmiş) başlangıç günü. */
  startDay: number;
}

/** 1–31 aralığına kıst; geçersiz değerde varsayılana (1) döner. */
export function normalizeCycleStartDay(day: unknown): number {
  const n = typeof day === 'number' ? day : parseInt(String(day ?? ''), 10);
  if (!Number.isFinite(n)) return DEFAULT_CYCLE_START_DAY;
  return Math.min(MAX_CYCLE_START_DAY, Math.max(MIN_CYCLE_START_DAY, Math.trunc(n)));
}

function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

/** anchor gününün o ay için clamp'lenmiş hali (kısa ayda ay sonuna çekilir). */
function anchorDayInMonth(year: number, month0: number, anchor: number): number {
  return Math.min(anchor, daysInMonth(year, month0));
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toYmd(year: number, month0: number, day: number): string {
  return `${year}-${pad2(month0 + 1)}-${pad2(day)}`;
}

/** İki yerel tarih (YYYY-MM-DD) arası tam gün farkı: b - a. */
function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  // UTC ile hesapla → DST gün kayması olmaz.
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/** Verilen ayın anchor gününden bir gün öncesi (önceki döngünün son günü). */
function dayBeforeAnchor(year: number, month0: number, anchorDay: number): string {
  if (anchorDay > 1) return toYmd(year, month0, anchorDay - 1);
  // Ayın 1'inden bir gün geri = önceki ayın son günü.
  const pY = month0 === 0 ? year - 1 : year;
  const pM = month0 === 0 ? 11 : month0 - 1;
  return toYmd(pY, pM, daysInMonth(pY, pM));
}

/**
 * Referans takvim gününü (year / month0 / day) içeren döngüyü döndürür.
 * Çekirdek hesap — diğer yardımcılar bunu çağırır.
 */
export function getCycleForYmd(
  anchorRaw: number,
  refYear: number,
  refMonth0: number,
  refDay: number,
): BudgetCycle {
  const anchor = normalizeCycleStartDay(anchorRaw);
  const thisAnchorDay = anchorDayInMonth(refYear, refMonth0, anchor);

  // Bugün anchor gününden önceyse döngü ÖNCEKİ ayda başlamıştır.
  let sY = refYear;
  let sM = refMonth0;
  if (refDay < thisAnchorDay) {
    sM = refMonth0 - 1;
    if (sM < 0) {
      sM = 11;
      sY = refYear - 1;
    }
  }
  const startDay = anchorDayInMonth(sY, sM, anchor);

  // Bitiş = bir SONRAKİ ayın anchor günü - 1 gün.
  const eY = sM === 11 ? sY + 1 : sY;
  const eM = sM === 11 ? 0 : sM + 1;
  const nextAnchorDay = anchorDayInMonth(eY, eM, anchor);
  const end = dayBeforeAnchor(eY, eM, nextAnchorDay);

  const start = toYmd(sY, sM, startDay);
  return {
    start,
    end,
    key: `${sY}-${pad2(sM + 1)}`,
    totalDays: dayDiff(start, end) + 1,
    startDay: anchor,
  };
}

/** Bugünü (ya da verilen tarihi) içeren güncel döngü. */
export function getCurrentCycle(anchorRaw: number, ref: Date = new Date()): BudgetCycle {
  return getCycleForYmd(anchorRaw, ref.getFullYear(), ref.getMonth(), ref.getDate());
}

/** Bir bütçe anahtarına (YYYY-MM = başlangıç ayı) karşılık gelen döngü. */
export function getCycleForKey(anchorRaw: number, key: string): BudgetCycle {
  const [y, m] = key.split('-').map(Number);
  const anchor = normalizeCycleStartDay(anchorRaw);
  // Referans olarak o ayın anchor gününü ver → aynı ayda başlayan döngüyü döndürür.
  const startDay = anchorDayInMonth(y, m - 1, anchor);
  return getCycleForYmd(anchor, y, m - 1, startDay);
}

/** Bir döngü anahtarını ay bazında kaydır (−1 = önceki döngü, +1 = sonraki). */
export function shiftCycleKey(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** Döngü içinde geçen gün (1 tabanlı) ve kalan gün sayısı. */
export function getCycleProgress(
  cycle: BudgetCycle,
  ref: Date = new Date(),
): { dayOfCycle: number; daysRemaining: number } {
  const refStr = toYmd(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const elapsed = dayDiff(cycle.start, refStr); // 0 tabanlı
  const dayOfCycle = Math.min(cycle.totalDays, Math.max(0, elapsed) + 1);
  const daysRemaining = Math.max(0, cycle.totalDays - dayOfCycle);
  return { dayOfCycle, daysRemaining };
}
