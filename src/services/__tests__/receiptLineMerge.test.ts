import {
  isDiscountLineItem,
  mergeDiscountLinesIntoItems,
  finalizeParsedReceipt,
} from '../receiptLineMerge';
import type { ParsedItem, ParsedReceipt } from '../geminiService';

const item = (over: Partial<ParsedItem>): ParsedItem => ({
  name: 'Ürün',
  quantity: 1,
  unit_price: 1,
  total_price: 1,
  suggested_category: 'Market',
  ...over,
});

describe('isDiscountLineItem', () => {
  it('negatif tutarlı satırı indirim sayar', () => {
    expect(isDiscountLineItem(item({ total_price: -1.41, unit_price: -1.41 }))).toBe(true);
  });

  it('kategori "indirim" içeriyorsa indirim sayar', () => {
    expect(isDiscountLineItem(item({ suggested_category: 'indirim', total_price: 1 }))).toBe(true);
  });

  // Türkçe büyük 'İ' düzeltmesi (normForMatch U+0307 birleşik noktayı temizler):
  // 'İndirim' kategorisi artık doğru şekilde indirim sayılır.
  it('Türkçe büyük İ kategorisi (İndirim) de indirim sayılır', () => {
    expect(isDiscountLineItem(item({ suggested_category: 'İndirim', total_price: 1, unit_price: 1 }))).toBe(true);
    expect(isDiscountLineItem(item({ suggested_category: 'İNDİRİM', total_price: 1, unit_price: 1 }))).toBe(true);
  });

  it('isimde indirim anahtar kelimesi varsa indirim sayar (çok dilli)', () => {
    expect(isDiscountLineItem(item({ name: 'Rabat' }))).toBe(true);
    expect(isDiscountLineItem(item({ name: 'DISCOUNT' }))).toBe(true);
    expect(isDiscountLineItem(item({ name: 'Promocja' }))).toBe(true);
  });

  it('normal ürünü indirim saymaz', () => {
    expect(isDiscountLineItem(item({ name: 'Ekmek', total_price: 5, unit_price: 5 }))).toBe(false);
  });
});

describe('mergeDiscountLinesIntoItems', () => {
  it('negatif indirim satırını önceki ürüne yedirir', () => {
    const out = mergeDiscountLinesIntoItems([
      item({ name: 'Ekmek', total_price: 6.99, unit_price: 6.99 }),
      item({ name: 'Discount', total_price: -1.41, unit_price: -1.41, suggested_category: 'İndirim' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].total_price).toBe(5.58);
    expect(out[0].line_discount).toBe(1.41);
    expect(out[0].list_line_total_before_discount).toBe(6.99);
    expect(out[0].unit_price).toBe(5.58);
  });

  it('baştaki indirim satırını (öncesinde ürün yokken) atar', () => {
    const out = mergeDiscountLinesIntoItems([
      item({ name: 'Discount', total_price: -1, unit_price: -1, suggested_category: 'İndirim' }),
    ]);
    expect(out).toHaveLength(0);
  });

  it('normal ürünleri olduğu gibi geçirir', () => {
    const out = mergeDiscountLinesIntoItems([
      item({ name: 'A', total_price: 3, unit_price: 3 }),
      item({ name: 'B', total_price: 4, unit_price: 4 }),
    ]);
    expect(out).toHaveLength(2);
    expect(out.map(i => i.name)).toEqual(['A', 'B']);
  });

  it('boş/null girdide boş dizi döner', () => {
    expect(mergeDiscountLinesIntoItems([])).toEqual([]);
    expect(mergeDiscountLinesIntoItems(undefined as any)).toEqual([]);
  });
});

describe('finalizeParsedReceipt', () => {
  const receipt = (over: Partial<ParsedReceipt>): ParsedReceipt => ({
    vendor_name: 'Mağaza',
    date: '2026-06-21',
    items: [],
    total: 0,
    currency: 'PLN',
    ...over,
  });

  it('yazılı total kalemler toplamıyla uyumsuzsa toplamı düzeltir', () => {
    const out = finalizeParsedReceipt(receipt({
      items: [item({ name: 'A', total_price: 3, unit_price: 3 }), item({ name: 'B', total_price: 4, unit_price: 4 })],
      total: 999,
    }));
    expect(out.total).toBe(7);
  });

  it('uyumlu total değeri korunur', () => {
    const out = finalizeParsedReceipt(receipt({
      items: [item({ name: 'A', total_price: 3, unit_price: 3 }), item({ name: 'B', total_price: 4, unit_price: 4 })],
      total: 7,
    }));
    expect(out.total).toBe(7);
  });

  it('indirim satırı birleştirilir ve total nete hizalanır', () => {
    const out = finalizeParsedReceipt(receipt({
      items: [
        item({ name: 'Ekmek', total_price: 6.99, unit_price: 6.99 }),
        item({ name: 'Discount', total_price: -1.41, unit_price: -1.41, suggested_category: 'İndirim' }),
      ],
      total: 6.99,
    }));
    expect(out.items).toHaveLength(1);
    expect(out.total).toBe(5.58);
  });

  it('kalem yoksa yazılı total korunur', () => {
    const out = finalizeParsedReceipt(receipt({ items: [], total: 50 }));
    expect(out.items).toHaveLength(0);
    expect(out.total).toBe(50);
  });
});
