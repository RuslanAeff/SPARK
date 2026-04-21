// S.P.A.R.K. — Ürün ismi normalizasyonu
// Amaç: Aynı ürünün farklı imlâ/diakritik varyasyonlarını tek anahtara indirmek.
// Neden gerekli: SQLite'ın LOWER() fonksiyonu yalnızca ASCII (a-z) üzerinde
// çalışır. Polonya (Ó, Ś, Ę, Ą, Ć, Ż, Ź, Ń) ve Türkçe (İ, Ğ, Ü, Ö, Ş, Ç) gibi
// diakritikli karakterler büyük-küçük dönüşümünde veya gruplamada farklı
// anahtarlar üretir → "Parówki Berlin Ser 250g" ile "PARÓWKI BERLIN SER 250G"
// aynı ürün olsa da farklı gruplara düşer, satıcı kartındaki "en çok alınan
// ürünler" listesinde aynı ürün birden çok satır gibi gözükür ve
// `ItemAnalyticsModal` içinde alım geçmişinin yalnızca bir kısmı yüklenir.
//
// Bu fonksiyon JS tarafında Unicode-doğru NFD ayrıştırma + diakritik kaldırma
// + boşluk normalize + küçük harfe indirgeme yapar. Hem DAO toplama
// sorgularında (`getVendorItems`) hem de ürün geçmişi sorgusunda
// (`getItemAnalytics`) eşleşme anahtarı olarak kullanılır.

/** Ürünün mantıksal tek anahtarı. Boş/undefined için boş string döner. */
export function normalizeItemKey(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .normalize('NFD')                    // é → e + ́ (birleşik diakritik ayrı kod noktasına)
    .replace(/\p{Diacritic}/gu, '')      // tüm birleşik aksan işaretlerini kaldır
    .replace(/ł/g, 'l')                  // Lehçe Ł/ł NFD'de ayrışmaz, elle eşle
    .replace(/Ł/g, 'L')
    .replace(/ı/g, 'i')                  // Türkçe noktasız ı → i (ASCII eş)
    .replace(/İ/g, 'i')
    .toLowerCase()
    .replace(/[\s\u00A0]+/g, ' ')        // tüm whitespace (non-breaking dahil) → tek boşluk
    .trim();
}

/**
 * İki ürün isminin aynı mantıksal ürüne karşılık gelip gelmediğini söyler.
 * Boş değerler asla eşleşmez.
 */
export function isSameItemName(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeItemKey(a);
  const nb = normalizeItemKey(b);
  return na.length > 0 && na === nb;
}
