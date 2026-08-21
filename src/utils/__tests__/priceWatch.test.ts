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
});
