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

describe('shared number formatting (UI audit FN-06)', () => {
  const { formatAmountNumber, formatCompactAmount } = jest.requireActual('../formatCurrency');
  const { formatLineChartAxisValue } = jest.requireActual('../../components/LineChart');

  it('formats amounts with the currency locale instead of the device locale', () => {
    // pl-PL: dar boşluk grup ayırıcısı ve virgül ondalık.
    expect(formatAmountNumber(5000, 'PLN')).toMatch(/^5\s000,00$/);
    expect(formatAmountNumber(5000, 'USD')).toBe('5,000.00');
  });

  it('abbreviates thousands with the currency decimal separator', () => {
    expect(formatCompactAmount(1500, 'PLN')).toBe('1,5K');
    expect(formatCompactAmount(1500, 'USD')).toBe('1.5K');
    expect(formatCompactAmount(850, 'PLN')).toBe('850');
  });

  it('bar and line chart axes print the same value the same way', () => {
    // Çizgi grafiğin büyük adımlı ekseni ile çubuk grafik aynı biçimi üretir.
    expect(formatLineChartAxisValue(1500, 500, 'PLN')).toBe(formatCompactAmount(1500, 'PLN'));
    expect(formatLineChartAxisValue(800, 200, 'PLN')).toBe(formatCompactAmount(800, 'PLN'));
  });
});
