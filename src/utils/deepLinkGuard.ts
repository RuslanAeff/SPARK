// S.P.A.R.K. — Gelen bağlantı koruması (SEC-08, ürün kararı A)
//
// `spark://` şeması kayıtlı olduğu için cihazdaki başka bir uygulama veya bir
// bağlantı uygulamaya rastgele adres gönderebilir. Expo Router 55'in zincirindeki
// `query-string@7 → decode-uri-component@0.2.2` bozuk yüzde kodlamasında aşırı
// süre harcayabiliyor (GHSA-vcc3-ghjq-m6fr, GHSA-qr28-fpjm-wq7f). İnceleme: o kod
// yalnız `parse/parseUrl` içinde; ne uygulama ne Expo Router bunları çağırıyor
// (yalnız `stringify`). Yamalı sürüm yalnız ESM olduğu için CJS `query-string@7`
// ile zorla değiştirilmedi. Bu koruma ek bir katmandır: yönlendiriciye ulaşmadan
// aşırı uzun, kontrol karakterli veya bozuk yüzde kodlamalı adresleri yok sayar.

/** Uygulamanın kendi bağlantıları birkaç yüz karakteri geçmez. */
export const MAX_INCOMING_LINK_LENGTH = 2048;

export function isSafeIncomingLink(path: unknown): path is string {
  if (typeof path !== 'string' || path.length === 0 || path.length > MAX_INCOMING_LINK_LENGTH) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(path)) return false;
  try {
    // Yerleşik çözücü doğrusal sürede çalışır ve bozuk kodlamada hata fırlatır.
    decodeURIComponent(path);
  } catch {
    return false;
  }
  return true;
}

/**
 * Expo Router `+native-intent` kancası için: güvenliyse adresi olduğu gibi
 * döndürür, değilse `null` (yönlendirme yapılmaz, uygulama bulunduğu yerde kalır).
 */
export function filterIncomingLink(path: unknown): string | null {
  try {
    return isSafeIncomingLink(path) ? path : null;
  } catch {
    return null;
  }
}
