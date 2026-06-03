// S.P.A.R.K. — Para birimi meta verisi (TEK KAYNAK)
//
// Sembol, görüntü adı, kısa etiket ve formatlama locale'i SADECE burada tanımlanır.
// `formatCurrency.ts` (formatlama) ve `CurrencyContext.tsx` (görüntü para birimi seçimi)
// bu modülü kullanır — sembol/locale ikinci bir yerde tekrar yazılmaz.
//
// Bağımlılık yok (leaf modül): React/DB import etmez, böylece saf util ve testler
// bu dosyayı db mock'u olmadan kullanabilir.

/** Kullanıcının görüntü para birimi olarak seçebileceği kapalı küme (picker'lar bunu döner). */
export const DISPLAY_CURRENCIES = ['PLN', 'USD', 'EUR', 'AZN', 'TRY'] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

export interface CurrencyMeta {
  /** Tutar sonrası gösterilen sembol (ör. ₺, $, zł). */
  symbol: string;
  /** Seçicide gösterilen tam ad (TR). */
  label: string;
  /** Seçicide gösterilen kısa kod (ör. TRY → "TL"). */
  shortLabel: string;
  /** `Intl.NumberFormat` için locale (grup ayırıcı + ondalık kuralı). */
  locale: string;
}

/**
 * Tüm `DISPLAY_CURRENCIES` garanti vardır (intersection'ın ilk yarısı bunu derleme
 * zamanında zorunlu kılar). İkinci yarı (`Record<string, …>`) DB'de görünebilecek ama
 * seçilemeyen para birimlerine (ör. GBP) izin verir — bu kodlar picker'lara sızmaz çünkü
 * UI yalnız `DISPLAY_CURRENCIES`'i map'ler.
 */
export const CURRENCY_META: Record<DisplayCurrency, CurrencyMeta> &
  Record<string, CurrencyMeta> = {
  PLN: { symbol: 'zł', label: 'Polonya Zlotisi', shortLabel: 'PLN', locale: 'pl-PL' },
  USD: { symbol: '$', label: 'ABD Doları', shortLabel: 'USD', locale: 'en-US' },
  EUR: { symbol: '€', label: 'Euro', shortLabel: 'EUR', locale: 'de-DE' },
  AZN: { symbol: '₼', label: 'Azerbaycan Manatı', shortLabel: 'AZN', locale: 'az-AZ' },
  TRY: { symbol: '₺', label: 'Türk Lirası', shortLabel: 'TL', locale: 'tr-TR' },
  // Seçilemez ama harcamalarda görünebilir → formatlama için sembol + locale tanımlı.
  GBP: { symbol: '£', label: 'İngiliz Sterlini', shortLabel: 'GBP', locale: 'en-GB' },
};

/** Bilinmeyen para birimi için formatlama locale'i. */
export const DEFAULT_LOCALE = 'pl-PL';

export function isDisplayCurrency(v: string): v is DisplayCurrency {
  return (DISPLAY_CURRENCIES as readonly string[]).includes(v);
}

/** Sembol; bilinmiyorsa kodun kendisi döner (ör. "XYZ" → "XYZ"). */
export function getCurrencySymbol(currency: string): string {
  return CURRENCY_META[currency]?.symbol ?? currency;
}

/** Formatlama locale'i; bilinmiyorsa `DEFAULT_LOCALE`. */
export function getCurrencyLocale(currency: string): string {
  return CURRENCY_META[currency]?.locale ?? DEFAULT_LOCALE;
}
