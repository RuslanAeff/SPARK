// S.P.A.R.K. — Merkezi Girdi Doğrulama
// Tüm DAO ve servisler tarafından kullanılacak güvenlik katmanı.
import { roundMoney, roundUnitRate } from './moneyMath';
import { isValidYmd } from './recurringSchedule';

const CANONICAL_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function coerceNumericInput(value: unknown): number {
  if (typeof value === 'number') return value;
  const normalized = String(value ?? '').trim().replace(/\s/g, '').replace(',', '.');
  return normalized ? Number(normalized) : Number.NaN;
}

/** Güvenli parasal/sayısal değer: NaN, Infinity, negatif ve aşırı büyük kontrol. */
export function sanitizeAmount(value: unknown, fallback: number = 0): number {
  const n = coerceNumericInput(value);
  if (!Number.isFinite(n)) return fallback;
  if (n < 0) return fallback;
  if (n > 999_999_999) return 999_999_999;
  return roundMoney(n);
}

/** Miktar (quantity) doğrulama: 0'dan büyük olmalı. */
export function sanitizeQuantity(value: unknown, fallback: number = 1): number {
  const n = coerceNumericInput(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  if (n > 999_999) return 999_999;
  return n;
}

/** Birim fiyat doğrulama: negatif olabilir (iade), ama sınırlı. */
export function sanitizeUnitPrice(value: unknown, fallback: number = 0): number {
  const n = coerceNumericInput(value);
  if (!Number.isFinite(n)) return fallback;
  if (Math.abs(n) > 999_999_999) return fallback;
  return roundUnitRate(n);
}

/**
 * Metin sanitizasyonu: trim, kontrol karakterleri çıkarma, uzunluk sınırı.
 * SQL injection riski yok (parameterized queries kullanılıyor) ama
 * depolama taşması ve görüntüleme sorunlarını önler.
 */
// SEC-05: yön değiştirme (U+202A–U+202E, U+2066–U+2069, LRM/RLM) ve sıfır genişlikli
// (U+200B–U+200D, U+2060, BOM) karakterler. AI yanıtı veya yedekten gelen bir ad
// ekranda yanıltıcı görünebilir ya da yinelenen kayıt eşlemesini atlatabilirdi.
// Bilinen bedel: ZWJ ile birleşik emoji (ör. aile) ayrı emojilere dönüşür.
const INVISIBLE_OR_BIDI = /[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g;

export function sanitizeText(value: unknown, maxLen: number = 500): string {
  if (value == null) return '';
  let s = String(value)
    // Kontrol karakterlerini kaldır (tab ve newline hariç)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(INVISIBLE_OR_BIDI, '')
    // Temizlikten SONRA kırp: silinen karakterlerin arkasında kalan boşluk da gitsin.
    .trim();
  if (s.length > maxLen) {
    // Sınır UTF-16 birimidir (yedek doğrulaması `.length` ile ölçer); yalnız
    // yarım kalacak bir vekil çiftini (emoji) bırakmayız.
    s = s.substring(0, maxLen);
    const last = s.charCodeAt(s.length - 1);
    if (last >= 0xd800 && last <= 0xdbff) s = s.slice(0, -1);
    s = s.trimEnd();
  }
  return s;
}

/** Kalıcı uygulama verisi için desteklenen kanonik tarih aralığı. */
export function isSupportedYmd(value: unknown): value is string {
  if (typeof value !== 'string' || !isValidYmd(value)) return false;
  const year = Number(value.slice(0, 4));
  return year >= 2000 && year <= 2100;
}

/** Tarih doğrulama: gerçek YYYY-MM-DD ve desteklenen yıl aralığı kontrolü. */
export function sanitizeDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  return isSupportedYmd(s) ? s : null;
}

/** RFC 4122 v1-v5 UUID'yi kalıcı karşılaştırmalar için küçük harfe indirger. */
export function normalizeCanonicalUuid(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return CANONICAL_UUID_PATTERN.test(normalized) ? normalized : null;
}

/**
 * Toplu ID dizisi doğrulama: boyut sınırı ve tip kontrolü.
 * SQLite placeholder limiti (~999) ve bellek koruması için.
 */
export function sanitizeIdArray(ids: unknown[], maxLen: number = 500): number[] {
  if (!Array.isArray(ids)) return [];
  const safe: number[] = [];
  for (const id of ids) {
    if (safe.length >= maxLen) break;
    const n = typeof id === 'number' ? id : parseInt(String(id), 10);
    if (Number.isFinite(n) && n > 0 && Number.isInteger(n)) {
      safe.push(n);
    }
  }
  return safe;
}

/**
 * Güvenli JSON nesne anahtarları: proto-pollution ve prototype chain saldırılarını engeller.
 * Gemini gibi dış kaynaktan gelen JSON yanıtları için kullanılır.
 */
const DANGEROUS_KEYS = new Set([
  '__proto__', 'constructor', 'prototype',
  '__defineGetter__', '__defineSetter__',
  '__lookupGetter__', '__lookupSetter__',
]);

/** Tehlikeli anahtarları nesne ve alt nesnelerden temizler (in-place). */
export const MAX_JSON_DEPTH = 64;
export const MAX_JSON_NODES = 250_000;

export function stripDangerousKeys<T extends Record<string, unknown>>(obj: T): T {
  const stack: Array<{ value: Record<string, unknown>; depth: number }> = [{ value: obj, depth: 0 }];
  const seen = new WeakSet<object>();
  let nodes = 1;
  while (stack.length) {
    const { value, depth } = stack.pop()!;
    if (depth > MAX_JSON_DEPTH || seen.has(value)) throw new Error('INVALID_FORMAT');
    seen.add(value);
    for (const key of Object.keys(value)) {
      if (++nodes > MAX_JSON_NODES) throw new Error('INVALID_FORMAT');
      if (DANGEROUS_KEYS.has(key)) {
        delete value[key];
        continue;
      }
      const child = value[key];
      if (child && typeof child === 'object') {
        stack.push({ value: child as Record<string, unknown>, depth: depth + 1 });
      }
    }
  }
  return obj;
}
