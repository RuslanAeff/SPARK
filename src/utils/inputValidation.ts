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
export function sanitizeText(value: unknown, maxLen: number = 500): string {
  if (value == null) return '';
  let s = String(value).trim();
  // Kontrol karakterlerini kaldır (tab ve newline hariç)
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  if (s.length > maxLen) {
    s = s.substring(0, maxLen);
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

export function hasDangerousKeys(obj: unknown): boolean {
  if (obj == null || typeof obj !== 'object') return false;
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    if (DANGEROUS_KEYS.has(key)) return true;
  }
  return false;
}

/** Tehlikeli anahtarları nesne ve alt nesnelerden temizler (in-place). */
export function stripDangerousKeys<T extends Record<string, unknown>>(obj: T): T {
  for (const key of Object.keys(obj)) {
    if (DANGEROUS_KEYS.has(key)) {
      delete obj[key];
      continue;
    }
    const val = obj[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      stripDangerousKeys(val as Record<string, unknown>);
    } else if (Array.isArray(val)) {
      for (const item of val) {
        if (item && typeof item === 'object') {
          stripDangerousKeys(item as Record<string, unknown>);
        }
      }
    }
  }
  return obj;
}
