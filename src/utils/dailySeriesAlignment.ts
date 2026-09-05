// S.P.A.R.K. — Günlük seri hizalama
//
// `useDailySpending` grafik aralığını sıfır dolgulu döndürür (harcamasız günler
// de bir satırdır). Önceki dönem karşılaştırması ise DAO'dan HAM gelir: yalnız
// harcaması olan günler vardır. İki seri bu hâliyle ne uzunluk ne de indeks
// olarak eşleşir; grafik önceki dönem çubuklarını çizemez ama ölçeğe kattığı
// için gerçek çubuklar sıfıra yapışır. Burada önceki dönem, dönem başından
// itibaren gün gün sıfır dolgulanıp geçerli seriyle aynı uzunluğa getirilir:
// i. indeks her iki dönemde de "dönemin i. günü" demektir.
export interface DailyTotal {
  date: string;
  total: number;
}

function toUtcNoon(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const time = Date.parse(`${date}T12:00:00Z`);
  return Number.isNaN(time) ? null : time;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** `start`–`end` arasındaki her günü, harcaması yoksa 0 ile üretir. */
export function buildZeroFilledDailySeries(
  start: string,
  end: string,
  rows: DailyTotal[],
): DailyTotal[] {
  const startTime = toUtcNoon(start);
  const endTime = toUtcNoon(end);
  if (startTime === null || endTime === null || endTime < startTime) return [];

  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.date, (totals.get(row.date) ?? 0) + row.total);
  }

  const series: DailyTotal[] = [];
  for (let time = startTime; time <= endTime; time += DAY_MS) {
    const date = new Date(time).toISOString().split('T')[0];
    series.push({ date, total: totals.get(date) ?? 0 });
  }
  return series;
}

/**
 * Önceki dönemi geçerli serinin uzunluğuna hizalar. Dönem başları eşlenir;
 * önceki dönem daha uzunsa fazlası atılır, daha kısaysa sonu 0 ile tamamlanır
 * (ör. 31 günlük döngünün 30 günlük öncesi).
 */
export function alignPreviousDailySeries(
  currentLength: number,
  previousRange: { start: string; end: string } | null | undefined,
  previousRows: DailyTotal[],
): DailyTotal[] {
  if (currentLength <= 0 || !previousRange) return [];
  const filled = buildZeroFilledDailySeries(
    previousRange.start,
    previousRange.end,
    previousRows,
  );
  if (filled.length === 0) return [];
  if (filled.length >= currentLength) return filled.slice(0, currentLength);

  const padded = filled.slice();
  const lastTime = toUtcNoon(filled[filled.length - 1].date);
  while (padded.length < currentLength) {
    const time = lastTime === null
      ? null
      : lastTime + DAY_MS * (padded.length - filled.length + 1);
    padded.push({
      date: time === null ? `pad-${padded.length}` : new Date(time).toISOString().split('T')[0],
      total: 0,
    });
  }
  return padded;
}
