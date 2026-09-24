// S.P.A.R.K. — Gemini hata sözleşmesi.
//
// Servis kullanıcıya dönük metin üretmez; ekranların dört dilde anlamlı mesaj
// ve doğru eylemi (Ayarlar, bekle, manuel kayıt) seçebilmesi için tipli bir kod
// fırlatır. `message` her zaman koda eşittir, böylece `error.message` ile
// karşılaştıran mevcut çağıranlar da çalışmaya devam eder.

export type GeminiErrorCode =
  /** Anahtar kayıtlı değil. */
  | 'AI_NO_KEY'
  /** Google anahtarı veya projeyi reddetti (geçersiz anahtar, API kapalı). */
  | 'AI_KEY_REJECTED'
  /** Dakikalık (kısa süreli) kota/hız sınırı doldu (429). */
  | 'AI_QUOTA'
  /** Günlük ücretsiz kota doldu; Google'ın gün dönümüne kadar açılmaz. */
  | 'AI_QUOTA_DAILY'
  /** Hiçbir model isteği kabul etmedi (kapatılmış/erişimsiz/uyumsuz model). */
  | 'AI_MODEL_UNAVAILABLE'
  /** Google geçici olarak yoğun (5xx). */
  | 'AI_SERVER_BUSY'
  /** Ağa ulaşılamadı. */
  | 'AI_NETWORK'
  /** Model zamanında yanıt vermedi. */
  | 'AI_TIMEOUT'
  /** Yanıt çıktı sınırında kesildi; JSON yarım kaldı. */
  | 'AI_RESPONSE_TRUNCATED'
  /** Model yanıt verdi ama beklenen yapıda değil. */
  | 'AI_INVALID_RESPONSE'
  /** Fiş güvenilir biçimde okunamadı (mevcut ekran sözleşmesi). */
  | 'RECEIPT_INVALID_RESULT';

export class GeminiServiceError extends Error {
  readonly code: GeminiErrorCode;
  /** Yalnız AI_QUOTA: en erken yeniden deneme süresi (saniye). */
  readonly retryAfterSec?: number;
  /** Yalnız AI_QUOTA_DAILY: kotanın yenileneceği an (epoch ms). */
  readonly resetsAt?: number;

  constructor(code: GeminiErrorCode, options: { retryAfterSec?: number; resetsAt?: number } = {}) {
    super(code);
    this.name = 'GeminiServiceError';
    this.code = code;
    this.retryAfterSec = options.retryAfterSec;
    this.resetsAt = options.resetsAt;
  }
}

// Birden fazla model farklı nedenle başarısız olduğunda kullanıcıya en eyleme
// dönük neden gösterilir. Anahtar sorunu her şeyi bloke eder; ardından görüntüyü
// gerçekten görmüş bir modelin verdiği içerik sinyali (okunamadı/kesildi),
// fotoğrafla ilgili olduğundan kota veya erişilebilirlikten daha doğrudur.
// Günlük kota, geçici yoğunluktan sonra gelir: bir model gün boyu kapalıyken
// diğerleri yalnız birkaç dakikalığına doluysa kullanıcıya "yarın" demek yanlıştır.
const PRIORITY: readonly GeminiErrorCode[] = [
  'AI_KEY_REJECTED',
  'RECEIPT_INVALID_RESULT',
  'AI_RESPONSE_TRUNCATED',
  'AI_INVALID_RESPONSE',
  'AI_QUOTA',
  'AI_SERVER_BUSY',
  'AI_TIMEOUT',
  'AI_QUOTA_DAILY',
  'AI_MODEL_UNAVAILABLE',
];

export function moreActionable(current: GeminiErrorCode | null, next: GeminiErrorCode): GeminiErrorCode {
  if (current === null) return next;
  const rank = (code: GeminiErrorCode) => {
    const index = PRIORITY.indexOf(code);
    return index === -1 ? PRIORITY.length : index;
  };
  return rank(next) < rank(current) ? next : current;
}
