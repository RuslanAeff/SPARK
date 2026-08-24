import { normalizeItemKey } from './itemNameNormalizer';
import {
  sanitizeMeasurementUnit,
  type MeasurementUnit,
} from './measurementUnit';

export interface CanonicalProductLabel {
  /** Kullanıcıya gösterilebilecek, yalnız güvenli dönüşümler uygulanmış ad. */
  canonicalName: string;
  /** Ölçü birimiyle birlikte deterministik eşleşmede kullanılan ad anahtarı. */
  canonicalKey: string;
  /** Orijinal etiketi kaybetmeden alias aramasında kullanılan yazımsal anahtar. */
  normalizedAlias: string;
  measurementUnit: MeasurementUnit;
}

export interface ProductIdentityGroupInput {
  canonicalProductId?: number | null;
  name?: string | null;
  measurementUnit?: MeasurementUnit | string | null;
}

const DECIMAL_SEPARATOR_MARKER = '\uE000';

function cleanDisplayLabel(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\s\u00A0]+/gu, ' ')
    .trim()
    .replace(/^[,.;:!?/\\_\-]+\s*/u, '')
    .replace(/\s*[,.;:!?/\\_\-]+$/u, '')
    .trim();
}

/**
 * Noktalamayı eşleşme için temizlerken paket kimliğinin parçası olan sayıları,
 * ondalık ayırıcıyı, yüzdeyi ve `6x50` gibi çarpanları korur.
 */
function normalizeProductLookupKey(value: string): string {
  const decimalSafe = value
    .replace(/(\d)[,.](?=\d)/gu, `$1${DECIMAL_SEPARATOR_MARKER}`)
    .replace(/(\d)\s*[x×]\s*(?=\d)/giu, '$1x')
    .replace(/(\d)\s+(?=(?:g|kg|ml|l)\b)/giu, '$1');

  return normalizeItemKey(
    decimalSafe
      .replace(/[’'`´]/gu, '')
      .replace(/[^\p{L}\p{N}%+x\uE000]+/gu, ' ')
      .split(DECIMAL_SEPARATOR_MARKER)
      .join('.'),
  );
}

function replacementWithCase(source: string, replacement: string): string {
  if (source === source.toUpperCase()) return replacement.toUpperCase();
  const first = source.charAt(0);
  if (first && first === first.toUpperCase() && first !== first.toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/** Yalnız ürün anlamını değiştirmediği gözden geçirilmiş açık token eşleri. */
function applyReviewedTokenAliases(value: string): string {
  return value.replace(
    /(^|[^\p{L}\p{N}])(kanad[ıi])(?=$|[^\p{L}\p{N}])/giu,
    (_match, prefix: string, token: string) => `${prefix}${replacementWithCase(token, 'kanat')}`,
  );
}

function stripBareTrailingSalesUnit(value: string, unit: MeasurementUnit): string {
  const token = unit === 'kg'
    ? '(?:kg|kilogram|kilo)'
    : unit === 'l'
      ? '(?:l|lt|liter|litre)'
      : null;
  if (!token) return value;

  // En az bir boşluk veya ayraç gerekir; böylece marka/kelime içindeki `l` ya
  // da `kg` parçası satış birimi sanılmaz. Sayıyla biten ön ek ise `1 L`,
  // `500 g`, `6x50 ml` gibi paket tanımıdır ve kesinlikle korunur.
  const match = new RegExp(
    `^(.*?)[\\s(/\\[\\]{}-]+${token}(?:\\s*[)\\]}])?\\s*[,.;:]*$`,
    'iu',
  ).exec(value);
  if (!match) return value;

  const prefix = match[1].trim();
  if (!prefix || /\d(?:[.,]\d+)?$/u.test(prefix)) return value;
  return cleanDisplayLabel(prefix);
}

/**
 * Ürün etiketini güvenli ve birim-duyarlı bir yerel kimlik adayına dönüştürür.
 *
 * - kg/L satılan ürünlerde yalnız çıplak son satış birimi temizlenir.
 * - Sayısal paket tanımları hiçbir ölçü türünde silinmez.
 * - Marka, aroma, kesim, yağ oranı ve diğer varyant token'ları korunur.
 * - Fuzzy/stem tabanlı semantik birleştirme yapılmaz.
 */
export function canonicalizeProductLabel(
  name: string | null | undefined,
  measurementUnit: MeasurementUnit | string | null | undefined,
): CanonicalProductLabel {
  const unit = sanitizeMeasurementUnit(measurementUnit);
  const cleanedOriginal = cleanDisplayLabel(name);
  const normalizedAlias = normalizeProductLookupKey(cleanedOriginal);
  const withoutSalesUnit = stripBareTrailingSalesUnit(cleanedOriginal, unit);
  const canonicalName = applyReviewedTokenAliases(withoutSalesUnit);

  return {
    canonicalName,
    canonicalKey: normalizeProductLookupKey(canonicalName),
    normalizedAlias,
    measurementUnit: unit,
  };
}

/**
 * Bütün ürün analizlerinin kullanacağı ortak grup anahtarı.
 * Kalıcı kimlik varsa isimden bağımsızdır; eski/null kayıtlar yalnız güvenli
 * deterministik etikete geri düşer. Ölçü birimi her iki yolda da anahtarın
 * zorunlu parçasıdır.
 */
export function productIdentityGroupKey({
  canonicalProductId,
  name,
  measurementUnit,
}: ProductIdentityGroupInput): string {
  const unit = sanitizeMeasurementUnit(measurementUnit);
  if (Number.isSafeInteger(canonicalProductId) && Number(canonicalProductId) > 0) {
    return `canonical:${canonicalProductId}::${unit}`;
  }

  const { canonicalKey } = canonicalizeProductLabel(name, unit);
  return canonicalKey ? `fallback:${canonicalKey}::${unit}` : '';
}
