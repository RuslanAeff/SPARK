// geminiService'in SAF ayrıştırma yardımcıları (ağ/anahtar yok). secureKeyStore
// mock'lanır → native expo-secure-store jest'te yüklenmez.
jest.mock('../secureKeyStore', () => ({
  getSecureApiKey: jest.fn(),
  setSecureApiKey: jest.fn(),
  hasSecureApiKey: jest.fn(),
}));

import { coerceParsedReceipt, tryJsonToReceipt, isUnsuitableForReceiptParsing } from '../geminiService';

describe('isUnsuitableForReceiptParsing', () => {
  it('görüntü/ses/gömme üreten modelleri eler', () => {
    ['gemini-3.1-flash-image', 'imagen-3.0', 'gemini-2.5-flash-tts', 'gemini-live-2.5-flash', 'text-embedding-004', 'veo-2.0']
      .forEach((id) => expect(isUnsuitableForReceiptParsing(id)).toBe(true));
  });

  it('metin (fiş) modellerini tutar', () => {
    ['gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-2.0-flash-001', 'gemini-1.5-pro']
      .forEach((id) => expect(isUnsuitableForReceiptParsing(id)).toBe(false));
  });
});

describe('coerceParsedReceipt', () => {
  it('items dizi değilse null döner', () => {
    expect(coerceParsedReceipt({ vendor_name: 'x' })).toBeNull();
    expect(coerceParsedReceipt({ items: 'nope' as any })).toBeNull();
  });

  it('string sayıları (virgüllü) sayıya çevirir', () => {
    const out = coerceParsedReceipt({
      items: [{ name: 'A', quantity: '2', unit_price: '2,79', total_price: '5,58', suggested_category: 'Market' }],
    })!;
    expect(out.items[0].quantity).toBe(2);
    expect(out.items[0].unit_price).toBe(2.79);
    expect(out.items[0].total_price).toBe(5.58);
  });

  it('unit_price yoksa total/quantity ile türetir', () => {
    const out = coerceParsedReceipt({
      items: [{ name: 'A', quantity: 2, unit_price: 0, total_price: 10, suggested_category: 'Market' }],
    })!;
    expect(out.items[0].unit_price).toBe(5);
  });

  it('#4: kalem sayısını 500 ile sınırlar', () => {
    const many = Array.from({ length: 600 }, () => ({
      name: 'x', quantity: 1, unit_price: 1, total_price: 1, suggested_category: 'Market',
    }));
    const out = coerceParsedReceipt({ items: many, total: 600 })!;
    expect(out.items).toHaveLength(500);
  });

  it('eksik alanlar için varsayılanları uygular', () => {
    const out = coerceParsedReceipt({
      items: [{ name: 'A', quantity: 1, unit_price: 3, total_price: 3 }],
    })!;
    expect(out.vendor_name).toBe('Bilinmiyor');
    expect(out.currency).toBe('PLN');
  });

  it('line_discount yalnızca pozitifse korunur', () => {
    const withDisc = coerceParsedReceipt({
      items: [{ name: 'A', quantity: 1, unit_price: 5, total_price: 5, line_discount: 1.41, suggested_category: 'Market' }],
    })!;
    expect(withDisc.items[0].line_discount).toBe(1.41);

    const zeroDisc = coerceParsedReceipt({
      items: [{ name: 'A', quantity: 1, unit_price: 5, total_price: 5, line_discount: 0, suggested_category: 'Market' }],
    })!;
    expect(zeroDisc.items[0].line_discount).toBeUndefined();
  });

  it('AI parasal alanlarını kuruşa normalize eder', () => {
    const out = coerceParsedReceipt({
      items: [{
        name: 'A', quantity: 1, unit_price: 6.319999999999999,
        total_price: 6.319999999999999, line_discount: 3.170000000000001,
        list_line_total_before_discount: 9.490000000000002,
        suggested_category: 'Market',
      }],
      total: 55.93000000000001,
    })!;
    expect(out.items[0].total_price).toBe(6.32);
    expect(out.items[0].line_discount).toBe(3.17);
    expect(out.items[0].list_line_total_before_discount).toBe(9.49);
    expect(out.total).toBe(55.93);
  });

  it('tamamen indirimli geçerli sıfır satır toplamını korur', () => {
    const out = coerceParsedReceipt({
      items: [{
        name: 'A', quantity: 1, unit_price: 10, total_price: 0,
        line_discount: 10, list_line_total_before_discount: 10,
        suggested_category: 'Market',
      }],
      total: 0,
    })!;
    expect(out.items[0].total_price).toBe(0);
    expect(out.total).toBe(0);
  });

  it('total verilmezse kalem toplamından hesaplar', () => {
    const out = coerceParsedReceipt({
      items: [
        { name: 'A', quantity: 1, unit_price: 3, total_price: 3, suggested_category: 'Market' },
        { name: 'B', quantity: 1, unit_price: 4, total_price: 4, suggested_category: 'Market' },
      ],
    })!;
    expect(out.total).toBe(7);
  });
});

describe('tryJsonToReceipt (uçtan uca onarım + birleştirme)', () => {
  it('markdown fence + sondaki virgül + indirim satırını çözer ve birleştirir', () => {
    const raw =
      '```json\n' +
      '{"vendor_name":"Shop","date":"2026-06-21","items":[' +
      '{"name":"Ekmek","quantity":1,"unit_price":6.99,"total_price":6.99,"suggested_category":"Market"},' +
      '{"name":"Discount","quantity":1,"unit_price":-1.41,"total_price":-1.41,"suggested_category":"İndirim"},' +
      '],"total":6.99,"currency":"PLN"}\n' +
      '```';
    const out = tryJsonToReceipt(raw)!;
    expect(out).not.toBeNull();
    expect(out.vendor_name).toBe('Shop');
    expect(out.items).toHaveLength(1);
    expect(out.items[0].total_price).toBe(5.58);
    expect(out.total).toBe(6.99);
  });

  it('geçersiz girdide null döner', () => {
    expect(tryJsonToReceipt('bu kesinlikle json değil')).toBeNull();
  });
});
