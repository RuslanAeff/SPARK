// S.P.A.R.K. — Currency Formatting
// Sembol ve locale tek kaynaktan gelir: src/utils/currencyMeta.ts (§7.8 / friend-review #5).
import { getCurrencySymbol, getCurrencyLocale } from './currencyMeta';

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: string, showDecimal: boolean): Intl.NumberFormat {
  const locale = getCurrencyLocale(currency);
  const key = `${locale}_${currency}_${showDecimal ? 2 : 0}`;
  let fmt = formatterCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, {
      minimumFractionDigits: showDecimal ? 2 : 0,
      maximumFractionDigits: showDecimal ? 2 : 0,
      useGrouping: true,
    });
    formatterCache.set(key, fmt);
  }
  return fmt;
}

export function formatCurrency(
  amount: number,
  currency: string = 'PLN',
  showDecimal: boolean = true
): string {
  const formatted = getFormatter(currency, showDecimal).format(amount);
  return `${formatted} ${getCurrencySymbol(currency)}`;
}

/**
 * Para birimi simgesi olmadan, para biriminin yerel ayarıyla biçimlenmiş tutar
 * (ör. PLN: "5 000,00"). Çeviri metni para birimi kodunu ayrıca yazıyorsa
 * kullanılır (UI denetimi FN-06: `toLocaleString()` cihaz diline göre yazıyordu).
 */
export function formatAmountNumber(amount: number, currency: string = 'PLN', showDecimal: boolean = true): string {
  return getFormatter(currency, showDecimal).format(amount);
}

/**
 * Grafik eksenleri için kısaltılmış tutar: 1000 ve üstü "1,5K", altı tam sayı.
 * Ondalık ayırıcı para biriminin yerel ayarından gelir; iki grafik aynı değeri
 * aynı biçimde yazar (FN-06).
 */
export function formatCompactAmount(
  value: number,
  currency: string = 'PLN',
  digits: { compact?: number; plain?: number } = {},
): string {
  const locale = getCurrencyLocale(currency);
  if (Math.abs(value) >= 1000) {
    const compact = digits.compact ?? 1;
    return `${new Intl.NumberFormat(locale, { minimumFractionDigits: compact, maximumFractionDigits: compact }).format(value / 1000)}K`;
  }
  const plain = digits.plain ?? 0;
  return new Intl.NumberFormat(locale, { minimumFractionDigits: plain, maximumFractionDigits: plain }).format(value);
}
