import { buildPriceChanges } from '../priceWatch';

describe('buildPriceChanges', () => {
  it('aynı gün tekrarlarını ağırlıklı tek gözleme indirger ve günler arası değişimi hesaplar', () => {
    const result = buildPriceChanges([
      { name: 'Çilek', turkish_name: null, date: '2026-08-01', quantity: 0.5, total_price: 5, unit_price: 10, measurement_unit: 'kg' },
      { name: 'ÇİLEK', turkish_name: 'Çilek', date: '2026-08-01', quantity: 1, total_price: 10, unit_price: 10, measurement_unit: 'kg' },
      { name: 'cilek', turkish_name: 'Çilek', date: '2026-08-10', quantity: 0.5, total_price: 6, unit_price: 12, measurement_unit: 'kg' },
    ]);

    expect(result).toEqual([expect.objectContaining({
      firstPrice: 10,
      lastPrice: 12,
      changePct: 20,
      purchaseCount: 3,
      measurementUnit: 'kg',
    })]);
  });

  it('aynı isimli adet ve kilogram kayıtlarını birbirine karıştırmaz', () => {
    const result = buildPriceChanges([
      { name: 'Domates', turkish_name: null, date: '2026-08-01', quantity: 1, total_price: 2, unit_price: 2, measurement_unit: 'piece' },
      { name: 'Domates', turkish_name: null, date: '2026-08-10', quantity: 1, total_price: 3, unit_price: 3, measurement_unit: 'piece' },
      { name: 'Domates', turkish_name: null, date: '2026-08-01', quantity: 0.5, total_price: 5, unit_price: 10, measurement_unit: 'kg' },
      { name: 'Domates', turkish_name: null, date: '2026-08-10', quantity: 0.5, total_price: 4, unit_price: 8, measurement_unit: 'kg' },
    ]);

    expect(result).toHaveLength(2);
    expect(result.map(row => row.measurementUnit).sort()).toEqual(['kg', 'piece']);
  });

  it('tek gün gözlemini fiyat değişimi diye sunmaz', () => {
    expect(buildPriceChanges([
      { name: 'Elma', turkish_name: null, date: '2026-08-01', quantity: 1, total_price: 2, unit_price: 2, measurement_unit: 'kg' },
      { name: 'Elma', turkish_name: null, date: '2026-08-01', quantity: 1, total_price: 3, unit_price: 3, measurement_unit: 'kg' },
    ])).toEqual([]);
  });

  it('kg bazlı çıplak satış birimi ekini güvenli fallback kimliğinde birleştirir', () => {
    const result = buildPriceChanges([
      { name: 'Tavuk Baget', turkish_name: null, date: '2026-08-01', quantity: 1, total_price: 10, unit_price: 10, measurement_unit: 'kg' },
      { name: 'TAVUK BAGET KG', turkish_name: null, date: '2026-08-10', quantity: 1, total_price: 12, unit_price: 12, measurement_unit: 'kg' },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      firstPrice: 10,
      lastPrice: 12,
      canonicalProductId: null,
      canonicalName: 'TAVUK BAGET',
      measurementUnit: 'kg',
    });
  });

  it('kanat/kanadı eşini birleştirir fakat baget ve budu varyantlarını ayırır', () => {
    const result = buildPriceChanges([
      { name: 'Tavuk Kanat', turkish_name: null, date: '2026-08-01', quantity: 1, total_price: 10, unit_price: 10, measurement_unit: 'kg' },
      { name: 'Tavuk Kanadı kg', turkish_name: null, date: '2026-08-10', quantity: 1, total_price: 12, unit_price: 12, measurement_unit: 'kg' },
      { name: 'Tavuk Baget', turkish_name: null, date: '2026-08-01', quantity: 1, total_price: 20, unit_price: 20, measurement_unit: 'kg' },
      { name: 'Tavuk Baget kg', turkish_name: null, date: '2026-08-10', quantity: 1, total_price: 22, unit_price: 22, measurement_unit: 'kg' },
      { name: 'Taze Tavuk Budu', turkish_name: null, date: '2026-08-01', quantity: 1, total_price: 30, unit_price: 30, measurement_unit: 'kg' },
      { name: 'Taze Tavuk Budu kg', turkish_name: null, date: '2026-08-10', quantity: 1, total_price: 33, unit_price: 33, measurement_unit: 'kg' },
    ]);

    expect(result).toHaveLength(3);
    expect(new Set(result.map(row => row.productIdentityKey)).size).toBe(3);
  });

  it('kalıcı canonical kimlikle farklı dil ve OCR adlarını aynı seride toplar', () => {
    const result = buildPriceChanges([
      {
        name: 'KURCZAK SKRZYDLO KG', turkish_name: 'Tavuk Kanadı', canonical_product_id: 7,
        canonical_name: 'Tavuk Kanat', date: '2026-08-01', quantity: 1, total_price: 10,
        unit_price: 10, measurement_unit: 'kg',
      },
      {
        name: 'Chicken Wings', turkish_name: 'Tavuk Kanat', canonical_product_id: 7,
        canonical_name: 'Tavuk Kanat', date: '2026-08-10', quantity: 1, total_price: 15,
        unit_price: 15, measurement_unit: 'kg',
      },
    ]);

    expect(result).toEqual([expect.objectContaining({
      canonicalProductId: 7,
      canonicalName: 'Tavuk Kanat',
      productIdentityKey: 'canonical:7::kg',
      changePct: 50,
      purchaseCount: 2,
    })]);
  });

  it('aynı canonical kimlik hatalı verilse bile adet ve kg serilerini karıştırmaz', () => {
    const result = buildPriceChanges([
      { name: 'Domates', turkish_name: null, canonical_product_id: 9, date: '2026-08-01', quantity: 1, total_price: 2, unit_price: 2, measurement_unit: 'piece' },
      { name: 'Domates', turkish_name: null, canonical_product_id: 9, date: '2026-08-10', quantity: 1, total_price: 3, unit_price: 3, measurement_unit: 'piece' },
      { name: 'Domates', turkish_name: null, canonical_product_id: 9, date: '2026-08-01', quantity: 1, total_price: 10, unit_price: 10, measurement_unit: 'kg' },
      { name: 'Domates', turkish_name: null, canonical_product_id: 9, date: '2026-08-10', quantity: 1, total_price: 8, unit_price: 8, measurement_unit: 'kg' },
    ]);

    expect(result).toHaveLength(2);
    expect(result.map(row => row.productIdentityKey).sort()).toEqual([
      'canonical:9::kg',
      'canonical:9::piece',
    ]);
  });

  it('adet satılan farklı paket boyutlarını aynı fiyat serisine almaz', () => {
    const result = buildPriceChanges([
      { name: 'Yoğurt 500 g', turkish_name: null, date: '2026-08-01', quantity: 1, total_price: 5, unit_price: 5, measurement_unit: 'piece' },
      { name: 'Yoğurt 500g', turkish_name: null, date: '2026-08-10', quantity: 1, total_price: 6, unit_price: 6, measurement_unit: 'piece' },
      { name: 'Yoğurt 1 kg', turkish_name: null, date: '2026-08-01', quantity: 1, total_price: 8, unit_price: 8, measurement_unit: 'piece' },
      { name: 'Yoğurt 1kg', turkish_name: null, date: '2026-08-10', quantity: 1, total_price: 10, unit_price: 10, measurement_unit: 'piece' },
    ]);

    expect(result).toHaveLength(2);
    expect(new Set(result.map(row => row.productIdentityKey)).size).toBe(2);
  });
});
