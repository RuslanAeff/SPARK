import { formatCurrency } from '../formatCurrency';

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
