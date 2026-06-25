// S.P.A.R.K. — Gemini AI Service for Receipt Parsing
import { getSecureApiKey, setSecureApiKey, hasSecureApiKey, deleteSecureApiKey } from './secureKeyStore';
import { finalizeParsedReceipt } from './receiptLineMerge';
import {
  extractFirstBalancedJsonObject,
  relaxInvalidJsonLiterals,
  stripMarkdownCodeFences,
  stripTrailingCommasJson,
} from '../utils/receiptJsonRepair';
import { stripDangerousKeys } from '../utils/inputValidation';
import type { Language } from '../i18n/translations';

// Preferred model keywords in priority order (for auto-selection)
const MODEL_PREFERENCES = ['flash', 'pro'];

const FETCH_TIMEOUT_MS = 60_000;

let _modelCache: { models: string[]; expiry: number } | null = null;
let _modelCachePromise: Promise<string[]> | null = null; // S11: in-flight dedup
const MODEL_CACHE_TTL = 5 * 60 * 1000;

// #4: Anormal/halüsinasyonlu bir yanıtta kalem sayısı patlamasını engelle —
// 500'den fazla kalem hem UI'ı (kalem listesi render) hem DB transaction'ını
// (toplu INSERT) gereksiz şişirir. Gerçek fişler bunun çok altındadır.
const MAX_RECEIPT_ITEMS = 500;

// #4: 404 dönen (bu API anahtarı için generateContent desteklemeyen) modelleri
// kısa süre önbelleğe al → sonraki taramalarda boşuna deneyip gecikme yaratma.
// TTL sonunda yeniden denenir (model erişimi sonradan açılabilir).
const FAILED_MODEL_TTL = 10 * 60 * 1000;
const _failedModels = new Map<string, number>(); // modelStr → expiry (epoch ms)

function fetchWithTimeout(
  url: string,
  options?: RequestInit,
  timeoutMs = FETCH_TIMEOUT_MS,
  externalSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // Dışarıdan iptal (ör. tarayıcıda "Durdur") → iç controller'ı da iptal et.
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function discoverModels(apiKey: string): Promise<string[]> {
  // Cache hit — hâlâ geçerli
  if (_modelCache && Date.now() < _modelCache.expiry) {
    return _modelCache.models;
  }
  // S11: Eşzamanlı çağrılarda tek network isteği — diğerleri aynı promise'ı bekler
  if (_modelCachePromise) {
    return _modelCachePromise;
  }

  _modelCachePromise = _discoverModelsImpl(apiKey).finally(() => {
    _modelCachePromise = null;
  });
  return _modelCachePromise;
}

// Fiş ayrıştırma METİN (JSON) çıktısı ister. Bazı modeller `generateContent`
// destekler ama görüntü/ses/video/gömme ÜRETİR (ör. gemini-*-flash-image JSON
// yerine görüntü döndürür) → aday listesinde olmamalı; yoksa boşa bir kota/429
// denemesi harcanır ve yanıt ayrıştırması bozulabilir.
const UNSUITABLE_MODEL_KEYWORDS = ['image', 'imagen', 'tts', 'audio', 'live', 'veo', 'embedding', 'aqa'];
export function isUnsuitableForReceiptParsing(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return UNSUITABLE_MODEL_KEYWORDS.some((k) => lower.includes(k));
}

async function _discoverModelsImpl(apiKey: string): Promise<string[]> {
  const versions = ['v1beta', 'v1'];
  
  for (const ver of versions) {
    try {
      const url = `https://generativelanguage.googleapis.com/${ver}/models`;
      if (__DEV__) console.log(`[MODEL DISCOVERY] Querying models via ${ver}...`);
      const res = await fetchWithTimeout(url, {
        headers: { 'x-goog-api-key': apiKey },
      });
      if (!res.ok) continue;
      
      const data = await res.json();
      const models: string[] = (data.models || [])
        .filter((m: any) => 
          m.supportedGenerationMethods?.includes('generateContent')
        )
        .map((m: any) => ({
          id: m.name?.replace('models/', '') || '',
          ver,
        }))
        .filter((m: any) => m.id && !isUnsuitableForReceiptParsing(m.id))
        .map((m: any) => `${m.ver}:${m.id}`);
      
      if (models.length > 0) {
        if (__DEV__) console.log(`[MODEL DISCOVERY] Found ${models.length} models`);
        _modelCache = { models, expiry: Date.now() + MODEL_CACHE_TTL };
        return models;
      }
    } catch (e) {
      if (__DEV__) console.warn(`[MODEL DISCOVERY] ${ver} query failed:`, e);
    }
  }
  return [];
}

// Pick the best model from discovered list based on preferences
function pickBestModel(models: string[]): { apiVersion: string; model: string } | null {
  // Priority: flash models first (cheaper/faster), then pro
  for (const pref of MODEL_PREFERENCES) {
    const match = models.find(m => m.split(':')[1].includes(pref));
    if (match) {
      const [ver, id] = [match.split(':')[0], match.split(':').slice(1).join(':')];
      return { apiVersion: ver, model: id };
    }
  }
  // Fallback: just pick the first available model
  if (models.length > 0) {
    const [ver, id] = [models[0].split(':')[0], models[0].split(':').slice(1).join(':')];
    return { apiVersion: ver, model: id };
  }
  return null;
}

const buildApiUrl = (model: string, apiVersion: string) =>
  `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent`;

const MAX_ATTEMPTS_PER_MODEL = 6;

// Dile göre çeviri talimatları (JSON'daki alan adı turkish_name olarak kalır — DB şeması değişmez)
const LANG_META: Record<Language, { langName: string; examples: string }> = {
  tr: {
    langName: 'Turkish',
    examples: 'Woda Niegaz 5L -> Doğal Su 5L, Chleb -> Ekmek, Pomid gat luz -> Domates',
  },
  en: {
    langName: 'English',
    examples: 'Woda Niegaz 5L -> Natural Water 5L, Chleb -> Bread, Pomid gat luz -> Tomatoes',
  },
  az: {
    langName: 'Azerbaijani',
    examples: 'Woda Niegaz 5L -> Təbii Su 5L, Chleb -> Çörək, Pomid gat luz -> Pomidor',
  },
  ru: {
    langName: 'Russian',
    examples: 'Woda Niegaz 5L -> Питьевая вода 5L, Chleb -> Хлеб, Pomid gat luz -> Помидоры',
  },
};

function buildReceiptPrompt(language: Language = 'tr'): string {
  const { langName, examples } = LANG_META[language] ?? LANG_META.tr;
  return `You are a receipt parser for a personal finance app called S.P.A.R.K.
Analyze the receipt image carefully and extract all information.

Return ONLY a valid JSON object (no markdown, no code blocks) with this exact structure:
{
  "vendor_name": "Store/restaurant name from the receipt",
  "date": "YYYY-MM-DD format",
  "items": [
    {
      "name": "Item name exactly as printed on the receipt",
      "turkish_name": "${langName} translation of item name (e.g. ${examples})",
      "quantity": 1,
      "unit_price": 0.00,
      "total_price": 0.00,
      "suggested_category": "Closest Turkish leaf category (e.g. Market, Bakkal, İlaç, Medikal Ürün & Cihaz, Elektrik, Ev Kirası, Yakıt, Diğer)",
      "line_discount": 0.00,
      "list_line_total_before_discount": 0.00
    }
  ],
  "total": 0.00,
  "currency": "PLN"
}

Rules:
- Extract EVERY real product line from the receipt, INCLUDING duplicates: if the same product appears on multiple lines (e.g. "NapCocColaZer1,75l" printed twice, or "But Plastik kaucja" twice), output a SEPARATE item for EACH occurrence. NEVER merge, deduplicate, or skip repeated lines — the item count and order must match the receipt exactly.
- The "total" field MUST be the printed grand total on the receipt (the "SUMA PLN" / "SUMA" / "TOTAL" line, e.g. 68.80), read DIRECTLY from that line. Do NOT compute "total" by summing the items you extracted — if your item sum differs from the printed total, trust the printed total.
- Prices must be numbers (not strings).
- If quantity is not specified, assume 1.
- For each PRODUCT row: total_price is the LINE TOTAL the customer pays AFTER any line-specific discount (net). unit_price = total_price / quantity.
- DISCOUNTS ON A PRODUCT (e.g. Biedronka: product line then "Discount 1.41" under it, then net price): Do NOT output a separate item named "Discount". Instead, for that product set:
  - list_line_total_before_discount = price BEFORE discount (e.g. 6.99),
  - line_discount = discount amount as a POSITIVE number (e.g. 1.41),
  - total_price = net line total after discount (e.g. 5.58),
  - unit_price = total_price / quantity.
- If you cannot merge, you may still output a negative-price discount line; the app will merge it — but PREFER the merged form above.
- line_discount and list_line_total_before_discount: use 0 or omit when there is no line discount.
- The receipt "total" must match the printed total.
- Date format must be YYYY-MM-DD
- If currency is not clear, default to PLN
- suggested_category should be the most fitting Turkish category name (never "İndirim" for a real product — use Market, etc.)
- turkish_name MUST be a clear, natural ${langName} translation of the product name. Abbreviations from the receipt should be expanded to full product names in ${langName}.`;
}

export interface ParsedReceipt {
  vendor_name: string;
  date: string;
  items: ParsedItem[];
  total: number;
  currency: string;
  _modelUsed?: string;
}

export interface ParsedItem {
  name: string;
  turkish_name?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  suggested_category: string;
  /** Satırda uygulanan indirim tutarı (pozitif, para birimi) */
  line_discount?: number;
  /** İndirim öncesi satır toplamı (ör. 6.99 → 1.41 indirim → 5.58 net) */
  list_line_total_before_discount?: number;
}

async function getApiKey(): Promise<string | null> {
  return getSecureApiKey();
}

// Delay helper
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Parse the retryDelay from Gemini's 429 error response (e.g. "43s" -> 43000)
function parseRetryDelay(errorBody: string): number | null {
  try {
    const parsed = JSON.parse(errorBody);
    const retryInfo = parsed?.error?.details?.find(
      (d: any) => d['@type']?.includes('RetryInfo')
    );
    if (retryInfo?.retryDelay) {
      const seconds = parseInt(retryInfo.retryDelay.replace('s', ''), 10);
      if (!isNaN(seconds)) return seconds * 1000;
    }
  } catch {}
  return null;
}

// Build a user-friendly error message for quota issues
function buildQuotaErrorMessage(modelName: string, retryDelayMs: number | null): string {
  const waitSec = retryDelayMs ? Math.ceil(retryDelayMs / 1000) : 60;
  return (
    `Gemini AI quota limit reached (${modelName}).\n\n` +
    `Your free usage quota is currently exhausted. ` +
    `Please wait approximately ${waitSec} seconds and try again.\n\n` +
    `Tip: You can upgrade to a paid plan on Google AI Studio ` +
    `or use a different API key for higher quota.`
  );
}

function isTransientServerError(status: number): boolean {
  return status === 500 || status === 502 || status === 503 || status === 504;
}

/** List API döndürür ama yeni API anahtarlarında generateContent 404 — denemeyi atla (gereksiz hata görünümü) */
function isDeprecatedListedModelId(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return lower.includes('gemini-2.0-flash-lite');
}

function modelStrToId(modelStr: string): string {
  return modelStr.split(':').slice(1).join(':');
}

/** Metro’da kırmızı ERROR/stack tetiklemez; 404 = normal yedek akış */
function devLogGeminiHttpFailure(
  model: string,
  apiVersion: string,
  status: number,
  errorBody: string,
  attempt: number
): void {
  if (!__DEV__ || attempt !== 0) return;
  if (status === 404) {
    console.log(
      `[GEMINI] ${model} (${apiVersion}) → 404 (bu model atlanıyor, sıradaki kullanılacak)`
    );
    return;
  }
  if (status === 429 || isTransientServerError(status)) {
    return;
  }
  console.warn(
    `[GEMINI] ${model} (${apiVersion}) → HTTP ${status}: ${errorBody.replace(/\s+/g, ' ').slice(0, 100)}`
  );
}

// Core fetch-with-retry for a single model + API version combo (429 + geçici sunucu yoğunluğu 502/503/504)
async function callGeminiModel(
  model: string,
  apiVersion: string,
  apiKey: string,
  requestBody: object,
  signal?: AbortSignal,
): Promise<{ ok: true; content: string } | { ok: false; status: number; body: string }> {
  let lastStatus = 0;
  let lastBody = '';

  for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_MODEL; attempt++) {
    const url = buildApiUrl(model, apiVersion);
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
    }, FETCH_TIMEOUT_MS, signal);

    if (response.ok) {
      const data = await response.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const finishReason = data.candidates?.[0]?.finishReason as string | undefined;
      if (finishReason === 'MAX_TOKENS' && __DEV__) {
        console.warn('[GEMINI] Yanıt MAX_TOKENS ile kesilmiş olabilir; JSON yarım kalabilir.');
      }
      // Düşünme parçaları hariç tüm metinleri birleştir (JSON birden fazla parçada gelebilir)
      const nonThought = parts.filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought);
      let text = nonThought.map((p: { text: string }) => p.text).join('\n');
      if (!text) {
        for (const part of parts) {
          if ((part as { text?: string }).text) {
            text = (text ? `${text}\n` : '') + (part as { text: string }).text;
          }
        }
      }
      if (!text) throw new Error('Gemini API returned an empty response.');
      return { ok: true, content: text };
    }

    const errorBody = await response.text();
    lastStatus = response.status;
    lastBody = errorBody;

    devLogGeminiHttpFailure(model, apiVersion, response.status, errorBody, attempt);

    // Rate limit (429) — AYNI modelde uzun uzun beklemek YERINE hemen dön; üst
    // katman sıradaki modeli dener (farklı modellerin ayrı RPM/kota havuzu olabilir).
    // Tüm modeller 429 verirse parseReceipt kullanıcıya "kota dolu, X sn bekle"
    // mesajını gösterir. Eski 6×(~30-60s) bekleme ücretsiz tier'da taramayı
    // dakikalarca "işleniyor" durumunda bırakıyordu.
    if (response.status === 429) {
      if (__DEV__) console.warn(`Gemini ${model} (${apiVersion}) 429 — sıradaki model deneniyor (model-içi bekleme yok)`);
      return { ok: false, status: 429, body: errorBody };
    }

    // Google "high demand" / UNAVAILABLE — kısa backoff ile tekrar dene
    if (isTransientServerError(response.status)) {
      const waitMs = Math.min(1500 * Math.pow(2, attempt), 20000);
      if (__DEV__) {
        console.warn(
          `Gemini ${model} (${apiVersion}) busy (${response.status}), retry in ${Math.ceil(waitMs / 1000)}s (attempt ${attempt + 1}/${MAX_ATTEMPTS_PER_MODEL})...`
        );
      }
      await delay(waitMs);
      continue;
    }

    // Kalıcı istemci/sunucu hataları — hemen dön (üst katman başka modele geçebilir)
    if (response.status === 400 || response.status === 403) {
      return { ok: false, status: response.status, body: errorBody };
    }

    // Diğer 4xx/5xx: bu modelde bir deneme daha anlamsızsa dön
    return { ok: false, status: response.status, body: errorBody };
  }

  return { ok: false, status: lastStatus, body: lastBody || 'Max attempts exceeded for this model.' };
}

export async function parseReceipt(
  imageBase64: string,
  language: Language = 'tr',
  signal?: AbortSignal,
): Promise<ParsedReceipt> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key not configured. Please set it in Settings → API Key.');
  }

  if (__DEV__) {
    console.log(`[DIAGNOSTIC] API Key: present (${apiKey.length} chars)`);
  }

  const requestBody = {
    contents: [{
      parts: [
        { text: buildReceiptPrompt(language) },
        {
          inline_data: {
            mime_type: 'image/jpeg',
            data: imageBase64,
          },
        },
      ],
    }],
    generationConfig: {
      temperature: 0.1,
      topK: 1,
      topP: 0.8,
      // Uzun fişlerde JSON'un kesilmemesi için yükseltildi. "thinking" modelleri
      // (gemini-2.5/3-flash) çıktı bütçesinin çoğunu düşünmeye harcayıp JSON'u
      // MAX_TOKENS ile yarıda kesiyordu → thinkingBudget:0 ile düşünme kapatılır,
      // tüm bütçe JSON çıkışına kalır. thinkingConfig'i desteklemeyen modeller
      // 400 dönerse aşağıda atlanır (tarama ölmez).
      maxOutputTokens: 16384,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  // 1. Discover available models dynamically from Google
  const availableModels = await discoverModels(apiKey);
  
  if (availableModels.length === 0) {
    throw new Error(
      'Could not retrieve model list from Google AI API.\n\n' +
      'Possible causes:\n' +
      '• Your API key is invalid (or has extra spaces)\n' +
      '• Free Gemini API may be disabled on your project\n' +
      '• Your internet connection may be restricted\n\n' +
      'Please get a new key from aistudio.google.com and update it in Settings.'
    );
  }

  const sortModelStrings = (list: string[]) =>
    [...list].sort((a, b) => {
      const aId = modelStrToId(a);
      const bId = modelStrToId(b);

      // Model sıralama penaltısı (küçük = önce):
      //  0 = tam stable model (ör. gemini-2.5-flash) — prompt'u en iyi takip eder
      //      (turkish_name çevirisi + doğru kategori).
      //  1 = `lite` modeller (ör. gemini-flash-lite) — hızlı ama prompt takibi zayıf;
      //      çeviri/kategori alanlarını sık atlar → tam flash'tan SONRA denensin.
      //  2 = preview/deneysel (ör. gemini-3-flash-preview) — ücretsiz anahtarla
      //      genelde 403 → en sona.
      const rank = (id: string) =>
        /preview|exp/i.test(id) ? 2 : (/lite/i.test(id) ? 1 : 0);
      const aPrev = rank(aId);
      const bPrev = rank(bId);
      if (aPrev !== bPrev) return aPrev - bPrev;

      const aPref = MODEL_PREFERENCES.findIndex(p => aId.includes(p));
      const bPref = MODEL_PREFERENCES.findIndex(p => bId.includes(p));
      const aScore = aPref === -1 ? 999 : aPref;
      const bScore = bPref === -1 ? 999 : bPref;
      if (aScore !== bScore) return aScore - bScore;

      const a25 = aId.includes('2.5') ? 1 : 0;
      const b25 = bId.includes('2.5') ? 1 : 0;
      if (a25 !== b25) return a25 - b25;

      return aId.localeCompare(bId);
    });

  // Sıralama: flash → pro; 1.5 önce; bilinen 404'lü liste adlarını VE son
  // FAILED_MODEL_TTL içinde 404 dönen modelleri (#4 önbellek) çıkar. Hepsi
  // elenirse güvenli geri-düşüş: önce deprecated-hariç tam liste, o da boşsa ham
  // liste denenir (asla "hiç model yok" durumuna düşme).
  const now = Date.now();
  const notRecentlyFailed = (m: string) => {
    const exp = _failedModels.get(m);
    if (exp === undefined) return true;
    if (now < exp) return false;
    _failedModels.delete(m); // süresi doldu — temizle, yeniden denenebilir
    return true;
  };
  const nonDeprecated = availableModels.filter(
    (m) => !isDeprecatedListedModelId(modelStrToId(m))
  );
  const baseList = nonDeprecated.length > 0 ? nonDeprecated : [...availableModels];
  const usable = baseList.filter(notRecentlyFailed);
  const sortedModels = sortModelStrings(usable.length > 0 ? usable : baseList);

  // Try each discovered model starting from the best one
  let lastError = '';
  for (const modelStr of sortedModels) {
    const apiVersion = modelStr.split(':')[0];
    const modelId = modelStr.split(':').slice(1).join(':');
    const tag = `${modelId} (${apiVersion})`;
    
    if (__DEV__) console.log(`[GEMINI] Trying model: ${tag}`);
    const result = await callGeminiModel(modelId, apiVersion, apiKey, requestBody, signal);

    if (result.ok) {
      if (__DEV__) console.log(`[GEMINI] Success: ${tag}`);
      const parsed = cleanAndParseResponse(result.content);
      parsed._modelUsed = tag;
      return parsed;
    }

    if (result.status === 429) {
      const retryMs = parseRetryDelay(result.body);
      if (__DEV__) console.warn(`[GEMINI] ${tag} quota full, trying next model...`);
      lastError = buildQuotaErrorMessage(modelId, retryMs);
      continue;
    }

    if (isTransientServerError(result.status)) {
      if (__DEV__) console.warn(`[GEMINI] ${tag} server busy (${result.status}), trying next model...`);
      lastError =
        'Gemini sunucusu geçici olarak yoğundu (503). Başka model denendi; tüm modeller meşgulse bir süre sonra tekrar deneyin.';
      continue;
    }

    // 404 (model yok), 403 (anahtar/projeye kapalı — özellikle preview/exp), VE
    // 400 (geçersiz istek — ör. model thinkingConfig/maxOutputTokens'ı kabul
    // etmiyor) → modeli kısa süre atla ve SIRADAKİ modele geç. Tek bir uyumsuz
    // model yüzünden tüm tarama düşmesin; uygun bir flash modeli (gemini-2.5-flash
    // gibi) çalışır. (Eskiden 403/400 doğrudan throw ediyordu → tarama ölüyordu.)
    if (result.status === 404 || result.status === 403 || result.status === 400) {
      _failedModels.set(modelStr, Date.now() + FAILED_MODEL_TTL);
      if (__DEV__) {
        console.log(`[GEMINI] ${tag} → ${result.status}, sıradaki model deneniyor (kısa süre atlanacak)`);
      }
      lastError =
        result.status === 403
          ? `Google API ${tag} erişimini reddetti (403) — sıradaki model denendi.`
          : result.status === 400
            ? `Model ${tag} isteği reddetti (400) — sıradaki model denendi.`
            : `Model ${tag} is currently unavailable (404).`;
      continue;
    }
    throw new Error(`Unknown API Error (${result.status}). Please check your internet connection.`);
  }

  // All known combos failed
  throw new Error(
    lastError || 'All available Gemini models rejected your request. Your quota may be exhausted.'
  );
}

function toFiniteNumber(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/** Model bazen sayıları string döndürür; şema gevşetilir. (Saf — test edilebilir.) */
export function coerceParsedReceipt(raw: Record<string, unknown>): ParsedReceipt | null {
  if (!raw || typeof raw !== 'object') return null;
  // S8: Proto-pollution koruması — dış kaynaktan gelen JSON'dan tehlikeli anahtarları temizle
  stripDangerousKeys(raw);
  if (!Array.isArray(raw.items)) return null;

  // #4: Kalem sayısını üst sınıra indir (raw.total korunur — printed total tercih
  // edildiğinden kapatma toplamı bozulmaz).
  const rawItems = raw.items as Record<string, unknown>[];
  const cappedItems =
    rawItems.length > MAX_RECEIPT_ITEMS ? rawItems.slice(0, MAX_RECEIPT_ITEMS) : rawItems;
  if (__DEV__ && rawItems.length > MAX_RECEIPT_ITEMS) {
    console.warn(
      `[GEMINI] ${rawItems.length} kalem döndü, ${MAX_RECEIPT_ITEMS} ile sınırlandırıldı.`
    );
  }

  const items = cappedItems.map((it) => {
    const q = Math.max(0.001, toFiniteNumber(it.quantity, 1));
    const total = toFiniteNumber(it.total_price, 0);
    let unit = toFiniteNumber(it.unit_price, 0);
    if (unit <= 0 && q > 0 && total > 0) unit = total / q;
    const lineDisc = it.line_discount !== undefined && it.line_discount !== null
      ? toFiniteNumber(it.line_discount, 0)
      : undefined;
    const listBefore = it.list_line_total_before_discount !== undefined && it.list_line_total_before_discount !== null
      ? toFiniteNumber(it.list_line_total_before_discount, 0)
      : undefined;

    return {
      name: String(it.name ?? 'Ürün'),
      turkish_name: it.turkish_name != null ? String(it.turkish_name) : undefined,
      quantity: q,
      unit_price: unit,
      total_price: total,
      suggested_category: String(it.suggested_category ?? 'Diğer'),
      line_discount: lineDisc && lineDisc > 0.0001 ? lineDisc : undefined,
      list_line_total_before_discount:
        listBefore != null && listBefore > 0.0001 ? listBefore : undefined,
    } as ParsedItem;
  });

  const sum = items.reduce((s, i) => s + (Number.isFinite(i.total_price) ? i.total_price : 0), 0);
  const total = toFiniteNumber(raw.total, sum > 0 ? sum : 0);

  return {
    vendor_name: String(raw.vendor_name ?? 'Bilinmiyor'),
    date: String(raw.date ?? new Date().toISOString().slice(0, 10)),
    items,
    total: Number.isFinite(total) ? total : sum,
    currency: String(raw.currency ?? 'PLN'),
  };
}

/** Ham metni (markdown/bozuk JSON dahil) onarıp ParsedReceipt'e çevirir. (Saf — test edilebilir.) */
export function tryJsonToReceipt(jsonStr: string): ParsedReceipt | null {
  const variants = new Set<string>();
  let base = stripMarkdownCodeFences(jsonStr.trim());
  variants.add(base);

  const balanced = extractFirstBalancedJsonObject(base);
  if (balanced) variants.add(balanced);

  for (const v of variants) {
    const chain = [
      v,
      stripTrailingCommasJson(v),
      relaxInvalidJsonLiterals(stripTrailingCommasJson(v)),
      relaxInvalidJsonLiterals(v),
    ];
    for (const candidate of chain) {
      try {
        const raw = JSON.parse(candidate) as Record<string, unknown>;
        const coerced = coerceParsedReceipt(raw);
        if (coerced && coerced.items.length >= 0) {
          return finalizeParsedReceipt(coerced);
        }
      } catch {
        /* devam */
      }
    }
  }
  return null;
}

function cleanAndParseResponse(content: string): ParsedReceipt {
  const parsed = tryJsonToReceipt(content);
  if (parsed) return parsed;

  if (__DEV__) {
    const preview = content.replace(/\s+/g, ' ').slice(0, 400);
    console.warn('[GEMINI] JSON ayrıştırılamadı. Önizleme:', preview);
  }

  throw new Error(
    'Fiş verisi okunamadı (geçersiz yanıt). Tekrar deneyin; gerekirse fişi daha net çekin veya galeriden seçin.'
  );
}

export async function saveApiKey(key: string): Promise<void> {
  await setSecureApiKey(key);
}

export async function deleteApiKey(): Promise<void> {
  await deleteSecureApiKey();
}

export async function hasApiKey(): Promise<boolean> {
  return hasSecureApiKey();
}
