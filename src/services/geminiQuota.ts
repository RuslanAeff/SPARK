// S.P.A.R.K. — Gemini kota yanıtlarının yorumu (saf: ağ ve state yok).
//
// 429 yanıtı iki çok farklı durumu kapsar: dakikalık sınır birkaç saniyede açılır,
// günlük sınır ise Google'ın gün dönümüne kadar kapalı kalır. Google günlük sınırda
// da kısa bir `retryDelay` gönderebildiği için yalnız ona bakmak kullanıcıya
// "40 sn sonra dene" gibi yanıltıcı bir süre söyletir. Hangi sınırın dolduğu
// `QuotaFailure.violations[].quotaId` alanından okunur
// (ör. `GenerateRequestsPerDayPerProjectPerModel-FreeTier`).

export type QuotaScope = 'daily' | 'minute' | 'unknown';

/** Gemini'nin 429 gövdesindeki RetryInfo süresi ("43s" → 43000 ms). */
export function parseRetryDelay(errorBody: string): number | null {
  try {
    const parsed = JSON.parse(errorBody);
    const retryInfo = parsed?.error?.details?.find(
      (d: { '@type'?: string }) => d?.['@type']?.includes('RetryInfo'),
    );
    const seconds = parseFloat(String(retryInfo?.retryDelay ?? '').replace('s', ''));
    if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  } catch {}
  return null;
}

/** Hangi kota doldu? Günlük ihlal varsa günlük sayılır (en uzun bekleme). */
export function classifyQuotaFailure(errorBody: string): QuotaScope {
  let ids: string[] = [];
  try {
    const parsed = JSON.parse(errorBody);
    ids = (parsed?.error?.details ?? [])
      .filter((d: { '@type'?: string }) => d?.['@type']?.includes('QuotaFailure'))
      .flatMap((d: { violations?: Array<{ quotaId?: string }> }) => d.violations ?? [])
      .map((v: { quotaId?: string }) => String(v?.quotaId ?? ''));
  } catch {}
  // Yapılandırılmış alan yoksa gövde metnine bakılır (biçim değişirse de çalışsın).
  const haystack = ids.length > 0 ? ids.join(' ') : errorBody;
  if (/PerDay/i.test(haystack)) return 'daily';
  if (/PerMinute/i.test(haystack)) return 'minute';
  return 'unknown';
}

/** Ayın n'inci pazar gününün tarihi (UTC takvim hesabı). */
function nthSunday(year: number, month: number, n: number): number {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return 1 + ((7 - firstWeekday) % 7) + 7 * (n - 1);
}

/**
 * ABD Pasifik saatinin verilen andaki UTC farkı (saat). Yaz saati mart ayının
 * ikinci pazarı 02:00 PST'de başlar, kasımın ilk pazarı 02:00 PDT'de biter.
 * Intl saat dilimi desteğine (Hermes sürümüne bağlı) güvenmemek için elle hesaplanır.
 */
function pacificOffsetHours(utcMs: number): number {
  const year = new Date(utcMs).getUTCFullYear();
  const dstStart = Date.UTC(year, 2, nthSunday(year, 2, 2), 10); // 02:00 PST = 10:00 UTC
  const dstEnd = Date.UTC(year, 10, nthSunday(year, 10, 1), 9); // 02:00 PDT = 09:00 UTC
  return utcMs >= dstStart && utcMs < dstEnd ? -7 : -8;
}

/** Google'ın günlük kota sıfırlaması: bir sonraki Pasifik gece yarısı (epoch ms). */
export function nextPacificMidnight(nowMs: number): number {
  const offset = pacificOffsetHours(nowMs);
  const local = new Date(nowMs + offset * 3_600_000);
  const nextLocalMidnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1);
  // Yaz saati değişimi 02:00'de olduğundan gece yarısındaki fark önceki günün farkıdır.
  return nextLocalMidnight - pacificOffsetHours(nextLocalMidnight - offset * 3_600_000) * 3_600_000;
}
