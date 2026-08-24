import {
  canonicalReceiptCategoryName,
  normalizeReceiptCategoryKey,
} from '../receiptCategory';

describe('receiptCategory', () => {
  it.each([
    ['market', undefined, 'market'],
    [undefined, 'Grocery', 'market'],
    [undefined, 'Ərzaq', 'market'],
    [undefined, 'Продукты', 'market'],
    [undefined, 'Dərman', 'medicine'],
    [undefined, 'Лекарство', 'medicine'],
    [undefined, 'Общественный транспорт', 'public_transport'],
  ] as const)('anahtar=%s, eski=%s → %s', (key, legacy, expected) => {
    expect(normalizeReceiptCategoryKey(key, legacy)).toBe(expected);
  });

  it('bilinmeyen veya çevrilmiş serbest metni güvenli Diğer kategorisine düşürür', () => {
    expect(normalizeReceiptCategoryKey('tamamen-uydurma', '???')).toBe('other');
    expect(canonicalReceiptCategoryName('tamamen-uydurma')).toBe('Diğer');
  });

  it('kanonik DB adını dil bağımsız anahtardan üretir', () => {
    expect(canonicalReceiptCategoryName('medical_supplies')).toBe('Medikal Ürün & Cihaz');
    expect(canonicalReceiptCategoryName('rent')).toBe('Ev Kirası');
  });
});
