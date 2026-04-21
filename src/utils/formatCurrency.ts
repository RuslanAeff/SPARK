// S.P.A.R.K. — Currency Formatting

const SYMBOLS: Record<string, string> = {
  PLN: 'zł',
  USD: '$',
  EUR: '€',
  TRY: '₺',
  AZN: '₼',
  GBP: '£',
};

function localeForCurrency(currency: string): string {
  switch (currency) {
    case 'USD':
      return 'en-US';
    case 'EUR':
      return 'de-DE';
    case 'TRY':
      return 'tr-TR';
    case 'AZN':
      return 'az-AZ';
    case 'PLN':
    default:
      return 'pl-PL';
  }
}

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: string, showDecimal: boolean): Intl.NumberFormat {
  const locale = localeForCurrency(currency);
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
  return `${formatted} ${SYMBOLS[currency] || currency}`;
}

export function formatCompactCurrency(amount: number, currency: string = 'PLN'): string {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M ${currency}`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K ${currency}`;
  }
  return formatCurrency(amount, currency);
}

export function parseAmount(text: string): number {
  const cleaned = text.replace(/[^\d.,\-]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}
