// S.P.A.R.K. — Gemini model seçimi ve istek uyumluluğu (saf: ağ, anahtar, state yok).
//
// Model kimliği sabitlenmez; Google'ın model listesi çalışma anında okunur ve
// burada sıralanır. Google model kuşaklarını ve parametre adlarını değiştirdiğinde
// (ör. Haziran 2026'da 2.0 kuşağının kapanması, Gemini 3'te `thinkingBudget`
// yerine `thinkingLevel`) yalnız bu dosyadaki kurallar güncellenir.

// Fiş ayrıştırma METİN (JSON) çıktısı ister. Bazı modeller `generateContent`
// destekler ama görüntü/ses/video/gömme ÜRETİR (ör. gemini-*-flash-image JSON
// yerine görüntü döndürür) → aday listesinde olmamalı; yoksa boşa bir kota/429
// denemesi harcanır ve yanıt ayrıştırması bozulabilir.
const UNSUITABLE_MODEL_KEYWORDS = ['image', 'imagen', 'tts', 'audio', 'live', 'veo', 'embedding', 'aqa'];

export function isUnsuitableForReceiptParsing(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return UNSUITABLE_MODEL_KEYWORDS.some((k) => lower.includes(k));
}

export interface GeminiVersion {
  major: number;
  minor: number;
}

/** `gemini-3.8-flash` → {3, 8}. Sürümsüz takma adlar (`gemini-flash-latest`) → null. */
export function parseGeminiVersion(modelId: string): GeminiVersion | null {
  const match = /^gemini-(\d+)(?:\.(\d+))?(?=-|$)/i.exec(modelId);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2] ?? 0) };
}

/**
 * 1.x ve 2.0 kuşakları Gemini API'de kapatıldı (2.0 ailesi: 1 Haziran 2026).
 * Liste API'si bazı anahtarlarda bunları hâlâ döndürebilir; generateContent 404
 * verir. Önceden elemek boşa bir istek ve gecikmeyi önler. Liste yalnız bu
 * modellerden oluşuyorsa çağıran taraf ham listeye geri döner.
 */
export function isRetiredModelId(modelId: string): boolean {
  const version = parseGeminiVersion(modelId);
  if (!version) return false;
  return version.major < 2 || (version.major === 2 && version.minor === 0);
}

// Sıra: stabil tam flash → flash-lite → pro → preview/experimental → Gemini dışı.
// Flash, fiş için hız/kota dengesi en iyi olan ailedir; lite daha düşük doğrulukla
// yedektir; pro yavaş ve kotası dardır.
function tier(modelId: string): number {
  const lower = modelId.toLowerCase();
  if (!lower.startsWith('gemini-')) return 4;
  if (/preview|exp/.test(lower)) return 3;
  if (lower.includes('lite')) return 1;
  if (lower.includes('flash')) return 0;
  if (lower.includes('pro')) return 2;
  return 3;
}

/** Aynı katmanda en yeni sürüm önce; sürümsüz takma ad, sürümlülerden sonra. */
function compareVersionDesc(a: string, b: string): number {
  const va = parseGeminiVersion(a);
  const vb = parseGeminiVersion(b);
  if (va && !vb) return -1;
  if (!va && vb) return 1;
  if (va && vb) {
    if (va.major !== vb.major) return vb.major - va.major;
    if (va.minor !== vb.minor) return vb.minor - va.minor;
  }
  return 0;
}

/** `ver:id` biçimindeki keşif kayıtlarının model kimliği. */
export function modelStrToId(modelStr: string): string {
  return modelStr.split(':').slice(1).join(':');
}

/**
 * Denenecek adayları farklı kapasite havuzlarına yayar.
 *
 * Google "yüksek talep" 503'ünü model ailesinin paylaşılan havuzu dolunca verir;
 * aynı anda 3.8/3.7/3.6 flash'ın hepsi 503 dönebilir. Adayların hepsi aynı
 * aileden seçilirse tarama hep birlikte düşer. Bu yüzden en iyi flash'tan hemen
 * sonra en iyi flash-lite denenir (ayrı havuz ve ayrı kota), kalan yer sıralı
 * listeden doldurulur. Giriş zaten `sortModelStrings` ile sıralanmış olmalıdır.
 */
export function pickCandidates(sorted: readonly string[], max: number): string[] {
  const picked: string[] = [];
  for (const wanted of [0, 1]) {
    const best = sorted.find((m) => tier(modelStrToId(m)) === wanted);
    if (best && !picked.includes(best)) picked.push(best);
  }
  for (const model of sorted) {
    if (picked.length >= max) break;
    if (!picked.includes(model)) picked.push(model);
  }
  return picked.slice(0, max);
}

export function sortModelStrings(list: readonly string[]): string[] {
  return [...list].sort((a, b) => {
    const aId = modelStrToId(a);
    const bId = modelStrToId(b);
    const byTier = tier(aId) - tier(bId);
    if (byTier !== 0) return byTier;
    const byVersion = compareVersionDesc(aId, bId);
    if (byVersion !== 0) return byVersion;
    return aId.localeCompare(bId);
  });
}

export type ThinkingConfig = Record<string, unknown>;

/**
 * Bir modele denenecek düşünme ayarları, tercih sırasıyla.
 *
 * Neden var: düşünen modeller çıktı bütçesini düşünmeye harcayıp JSON'u
 * MAX_TOKENS ile yarıda kesebiliyor; mümkün olan en az düşünme istenir.
 *  - Gemini 3+: `thinkingBudget` kaldırıldı ve düşünme kapatılamaz; açık
 *    `thinkingBudget: 0` 400 INVALID_ARGUMENT döner. `thinkingLevel: low`
 *    kullanılır: `minimal` 3.7/3.8 Flash'ta desteklenmez (400) ve 3.1
 *    Flash-Lite'ta sessizce `low`a yükseltilir; denemek her taramada bir istek
 *    ve kota harcıyordu (cihaz logu, 24 Eylül 2026).
 *  - 2.5: `thinkingBudget: 0` flash'ta düşünmeyi kapatır; pro 0'ı reddeder.
 *  - Diğer/sürümsüz: parametre gönderilmez (modelin varsayılanı).
 * Son seçenek her zaman `null`dur: parametre reddedilirse aynı model bir kez de
 * `thinkingConfig` olmadan denenir, böylece bir sonraki API değişikliği taramayı
 * tamamen durdurmaz.
 */
export function thinkingVariantsFor(modelId: string): Array<ThinkingConfig | null> {
  const version = parseGeminiVersion(modelId);
  if (version && version.major >= 3) {
    return [{ thinkingLevel: 'low' }, null];
  }
  if (version && version.major === 2 && version.minor === 5) {
    return [{ thinkingBudget: 0 }, null];
  }
  return [null];
}

/** 400 yanıtı düşünme parametresine itiraz ediyorsa model uyumsuz değildir; ayar değişmelidir. */
export function isThinkingConfigRejection(status: number, body: string): boolean {
  return status === 400 && /thinking/i.test(body);
}

/** Model değil anahtar/proje reddedildi → başka model denemek anlamsızdır. */
export function isKeyRejection(status: number, body: string): boolean {
  if (status === 401) return true;
  return (status === 400 || status === 403) && /API[_ ]KEY|SERVICE_DISABLED/i.test(body);
}
