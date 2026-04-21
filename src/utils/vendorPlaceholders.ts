import type { DisplayCurrency } from '../context/CurrencyContext';

/**
 * Görüntüleme para birimine göre örnek satıcı adları (uygulama dilinden bağımsız).
 * Ayarlar → Görüntüleme para birimi ile senkron.
 */
const VENDOR_EXAMPLES_BY_CURRENCY: Record<DisplayCurrency, string> = {
  PLN: 'Biedronka, Żabka',
  USD: 'Walmart, Target',
  EUR: 'Lidl, Carrefour',
  AZN: 'Bravo, Araz',
  TRY: 'Migros, BİM',
};

export function getVendorPlaceholderExamples(currency: DisplayCurrency): string {
  return VENDOR_EXAMPLES_BY_CURRENCY[currency] ?? VENDOR_EXAMPLES_BY_CURRENCY.PLN;
}
