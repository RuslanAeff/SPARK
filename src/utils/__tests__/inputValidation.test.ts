import {
  sanitizeAmount,
  sanitizeQuantity,
  sanitizeUnitPrice,
  sanitizeText,
  sanitizeDate,
  sanitizeIdArray,
  hasDangerousKeys,
  stripDangerousKeys,
  normalizeCanonicalUuid,
} from '../inputValidation';

describe('sanitizeAmount', () => {
  it('normal pozitif sayı korunur', () => {
    expect(sanitizeAmount(150.5)).toBe(150.5);
  });

  it('negatif → fallback', () => {
    expect(sanitizeAmount(-10, 0)).toBe(0);
  });

  it('NaN/Infinity → fallback', () => {
    expect(sanitizeAmount(NaN, 0)).toBe(0);
    expect(sanitizeAmount(Infinity, 0)).toBe(0);
  });

  it('aşırı büyük → 999_999_999 ile sınırlı', () => {
    expect(sanitizeAmount(1e20)).toBe(999_999_999);
  });

  it('string sayı parse edilir', () => {
    expect(sanitizeAmount('42.5')).toBe(42.5);
    expect(sanitizeAmount('55,93')).toBe(55.93);
  });

  it('parasal değeri iki ondalığa normalize eder', () => {
    expect(sanitizeAmount(55.00000000000003)).toBe(55);
    expect(sanitizeAmount(3.176)).toBe(3.18);
  });
});

describe('sanitizeQuantity', () => {
  it('0 ve negatif fallback', () => {
    expect(sanitizeQuantity(0)).toBe(1);
    expect(sanitizeQuantity(-5)).toBe(1);
  });

  it('pozitif normal değer', () => {
    expect(sanitizeQuantity(3)).toBe(3);
  });
});

describe('sanitizeUnitPrice', () => {
  it('iadeler için negatif değere izin verir', () => {
    expect(sanitizeUnitPrice(-12.5)).toBe(-12.5);
  });

  it('aşırı büyük → fallback', () => {
    expect(sanitizeUnitPrice(1e20, 0)).toBe(0);
  });

  it('birim fiyatı dört ondalık hassasiyette normalize eder', () => {
    expect(sanitizeUnitPrice(6.123456)).toBe(6.1235);
  });
});

describe('sanitizeText', () => {
  it('trim + uzunluk sınırı', () => {
    expect(sanitizeText('  hello  ')).toBe('hello');
    expect(sanitizeText('a'.repeat(600), 100)).toHaveLength(100);
  });

  it('kontrol karakterlerini siler', () => {
    expect(sanitizeText('a\x00b\x07c')).toBe('abc');
  });

  it('null/undefined → boş string', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(undefined)).toBe('');
  });
});

describe('sanitizeDate', () => {
  it('geçerli YYYY-MM-DD korunur', () => {
    expect(sanitizeDate('2026-05-15')).toBe('2026-05-15');
  });

  it('geçersiz format → null', () => {
    expect(sanitizeDate('15.05.2026')).toBeNull();
    expect(sanitizeDate('invalid')).toBeNull();
    expect(sanitizeDate(123)).toBeNull();
    expect(sanitizeDate('2026-02-30')).toBeNull();
  });

  it('makul olmayan yıl → null', () => {
    expect(sanitizeDate('1800-01-01')).toBeNull();
    expect(sanitizeDate('2200-01-01')).toBeNull();
  });
});

describe('sanitizeIdArray', () => {
  it('geçerli pozitif tamsayıları korur', () => {
    expect(sanitizeIdArray([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('negatif/0/ondalık/string atılır', () => {
    expect(sanitizeIdArray([1, -2, 0, 3.5, 'abc', 4])).toEqual([1, 4]);
  });

  it('boyut sınırı uygulanır', () => {
    const big = Array.from({ length: 1000 }, (_, i) => i + 1);
    expect(sanitizeIdArray(big, 10)).toHaveLength(10);
  });
});

describe('normalizeCanonicalUuid', () => {
  it('RFC UUID değerini lowercase kanonik biçime getirir', () => {
    expect(normalizeCanonicalUuid(' 123E4567-E89B-42D3-A456-426614174000 '))
      .toBe('123e4567-e89b-42d3-a456-426614174000');
  });

  it('version/variant sözleşmesine uymayan UUID benzeri değerleri reddeder', () => {
    expect(normalizeCanonicalUuid('00000000-0000-0000-0000-000000000000')).toBeNull();
    expect(normalizeCanonicalUuid('not-a-uuid')).toBeNull();
  });
});

describe('proto-pollution koruması', () => {
  // Not: `{ __proto__: x }` literal'i JS'te prototype'ı set eder, anahtar oluşturmaz.
  // Gerçek saldırı vektörü JSON.parse — bu, __proto__'yu **own property** yapar.
  it('hasDangerousKeys JSON üzerinden true döner', () => {
    const malicious = JSON.parse('{"__proto__":{"evil":1}}');
    expect(hasDangerousKeys(malicious)).toBe(true);
    const ctor = JSON.parse('{"constructor":{"prototype":{}}}');
    expect(hasDangerousKeys(ctor)).toBe(true);
    expect(hasDangerousKeys({ safe: 'value' })).toBe(false);
  });

  it('stripDangerousKeys recursive temizler', () => {
    const obj = JSON.parse('{"ok":1,"nested":{"__proto__":{"evil":1},"ok":2}}');
    stripDangerousKeys(obj);
    // Silinince obj.nested.__proto__ prototype chain'e düşer (Object.prototype) — evil yok
    expect((obj.nested as any).evil).toBeUndefined();
    expect(obj.nested.ok).toBe(2);
  });
});
