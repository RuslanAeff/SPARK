/**
 * Uygulamadaki tüm hata kayıtlarının tek kapısı (SEC-02).
 *
 * - Geliştirmede (`__DEV__`) tam hata nesnesi konsola yazılır.
 * - Yayın sürümünde yalnız etiket yazılır: SQLite hata metni tablo/kolon adı
 *   içerebilir ve Android'de sistem günlüğüne (logcat) düşer.
 *
 * Bu fonksiyon hiçbir koşulda fırlatmaz; hata yolunda ikinci bir hata üretmemelidir.
 * Yerel hata günlüğü (kullanıcı onayıyla paylaşılan rapor) bu kapıya bağlanır.
 */
export type ErrorSink = (tag: string, error?: unknown, options?: { includeDetail?: boolean }) => void;

let sink: ErrorSink | null = null;

/**
 * Uygulama açılışında yerel hata günlüğü buraya takılır (bkz. errorJournal).
 * Testlerde takılı hedef yoktur; böylece logError dosya sistemine dokunmaz.
 */
export function setErrorSink(next: ErrorSink | null): void {
  sink = next;
}

export function logError(tag: string, error?: unknown): void {
  try {
    if (__DEV__) {
      if (error === undefined) console.warn(`[${tag}]`);
      else console.warn(`[${tag}]`, error);
    } else {
      console.warn(`[${tag}]`);
    }
  } catch {
    /* kayıt yolu asla uygulamayı düşürmez */
  }
  try {
    sink?.(tag, error);
  } catch {
    /* hedefin hatası çağıranı etkilemez */
  }
}

/**
 * Konsola hiçbir şey yazmadan yalnız hata türünü (mesajsız) günlüğe bildirir.
 * Ham hata verisini geliştirmede bile yazmaması gereken yüzeyler (ErrorBoundary) içindir.
 */
export function reportErrorKind(tag: string, error?: unknown): void {
  try {
    sink?.(tag, error, { includeDetail: false });
  } catch {
    /* hedefin hatası çağıranı etkilemez */
  }
}
