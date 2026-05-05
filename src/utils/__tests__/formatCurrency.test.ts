import { formatCurrency, formatCompactCurrency, parseAmount } from '../formatCurrency';

describe('formatCurrency', () => {
  it('PLN için Polonya formatı + zł sembolü', () => {
    // pl-PL grup ayırıcısı NBSP ( ); ondalık virgül.
    expect(formatCurrency(1500, 'PLN')).toBe('1 500,00 zł');
  });

  it('TRY için Türkçe format + ₺ sembolü', () => {
    expect(formatCurrency(1500, 'TRY')).toBe('1.500,00 ₺');
  });

  it('showDecimal=false ondalıkları gizler', () => {
    expect(formatCurrency(1500, 'PLN', false)).toBe('1 500 zł');
  });

  it('bilinmeyen para birimi fallback olarak code yazar', () => {
    expect(formatCurrency(100, 'XYZ')).toBe('100,00 XYZ');
  });
});

describe('formatCompactCurrency', () => {
  it('1M üstünü "M" ile kısaltır', () => {
    expect(formatCompactCurrency(2_500_000, 'PLN')).toBe('2.5M PLN');
  });

  it('1K-1M arası "K" ile kısaltır', () => {
    expect(formatCompactCurrency(15_000, 'PLN')).toBe('15.0K PLN');
  });

  it('1K altı normal format', () => {
    expect(formatCompactCurrency(500, 'PLN')).toBe('500,00 zł');
  });
});

describe('parseAmount', () => {
  it('virgülü noktaya çevirir', () => {
    expect(parseAmount('1500,50')).toBe(1500.5);
  });

  it('para sembolü ve boşlukları temizler', () => {
    expect(parseAmount('1 500,50 zł')).toBe(1500.5);
  });

  it('geçersiz girdi 0 döner', () => {
    expect(parseAmount('abc')).toBe(0);
  });
});
