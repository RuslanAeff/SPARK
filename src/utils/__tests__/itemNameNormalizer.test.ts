import { normalizeItemKey, isSameItemName } from '../itemNameNormalizer';

describe('normalizeItemKey', () => {
  it('Lehçe diakritikleri kaldırır (Ó, Ś, Ł)', () => {
    expect(normalizeItemKey('Parówki Berlin')).toBe('parowki berlin');
    expect(normalizeItemKey('Łosoś')).toBe('losos');
  });

  it('Türkçe İ/ı doğru ASCII eşi', () => {
    expect(normalizeItemKey('İstanbul')).toBe('istanbul');
    expect(normalizeItemKey('ışık')).toBe('isik');
  });

  it('case-insensitive: aynı ürün farklı yazımlar', () => {
    expect(normalizeItemKey('PARÓWKI')).toBe(normalizeItemKey('Parówki'));
    expect(normalizeItemKey('parowki')).toBe(normalizeItemKey('PARÓWKI'));
  });

  it('çoklu boşlukları teke indirir', () => {
    expect(normalizeItemKey('  Süt   1L   ')).toBe('sut 1l');
  });

  it('null/undefined/boş için boş string', () => {
    expect(normalizeItemKey(null)).toBe('');
    expect(normalizeItemKey(undefined)).toBe('');
    expect(normalizeItemKey('')).toBe('');
  });
});

describe('isSameItemName', () => {
  it('aynı ürün farklı imlâ', () => {
    expect(isSameItemName('Parówki', 'PARÓWKI')).toBe(true);
  });

  it('boşlar asla eşleşmez', () => {
    expect(isSameItemName(null, null)).toBe(false);
    expect(isSameItemName('', '')).toBe(false);
  });

  it('farklı ürünler false', () => {
    expect(isSameItemName('Süt', 'Ekmek')).toBe(false);
  });
});
