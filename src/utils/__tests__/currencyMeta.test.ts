import {
  isDisplayCurrency,
  getCurrencySymbol,
  getCurrencyLocale,
  DEFAULT_LOCALE,
} from '../currencyMeta';

describe('isDisplayCurrency', () => {
  it('seçilebilir para birimleri için true döner', () => {
    expect(isDisplayCurrency('PLN')).toBe(true);
    expect(isDisplayCurrency('TRY')).toBe(true);
  });

  it('seçilemeyen/bilinmeyen kodlar için false döner', () => {
    expect(isDisplayCurrency('GBP')).toBe(false); // META'da var ama seçilemez
    expect(isDisplayCurrency('XYZ')).toBe(false);
  });
});

describe('getCurrencySymbol', () => {
  it('bilinen para biriminin sembolünü döner', () => {
    expect(getCurrencySymbol('TRY')).toBe('₺');
    expect(getCurrencySymbol('USD')).toBe('$');
    expect(getCurrencySymbol('PLN')).toBe('zł');
  });

  it('bilinmeyen para biriminde kodun kendisini döner', () => {
    expect(getCurrencySymbol('XYZ')).toBe('XYZ');
  });
});

describe('getCurrencyLocale', () => {
  it('bilinen para biriminin locale\'ini döner', () => {
    expect(getCurrencyLocale('TRY')).toBe('tr-TR');
    expect(getCurrencyLocale('EUR')).toBe('de-DE');
  });

  it('bilinmeyen para biriminde varsayılan locale döner', () => {
    expect(getCurrencyLocale('XYZ')).toBe(DEFAULT_LOCALE);
  });
});
