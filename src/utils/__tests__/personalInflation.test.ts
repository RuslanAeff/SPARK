import {
  computePersonalInflation,
  type InflationItemRow,
} from '../personalInflation';

function row(
  key: string,
  unitPrice: number,
  quantity: number,
  name = key,
): InflationItemRow {
  return { key, name, unitPrice, quantity, totalPrice: unitPrice * quantity };
}

describe('computePersonalInflation', () => {
  it('fiyat etkisi ile davranış etkisini toplam değişimi tam açıklayacak şekilde ayırır', () => {
    // Baz: 10 ekmek × 5 + 2 süt × 10 = 70
    const base = [row('ekmek', 5, 10), row('sut', 10, 2)];
    // Fiyatlar: ekmek 5 → 6 (%20), süt 10 → 10 (sabit)
    // Miktar: ekmek 10 → 12 (davranış)
    const current = [row('ekmek', 6, 12), row('sut', 10, 2)];

    const result = computePersonalInflation(current, base);

    expect(result.status).toBe('ready');
    // Fiyat etkisi: (6−5)·10 = 10 → 70 üzerinden %14.3
    expect(result.priceEffectAmount).toBe(10);
    expect(result.inflationPct).toBe(14.3);
    // Davranış etkisi: (6·12 + 10·2) − (6·10 + 10·2) = 92 − 80 = 12
    expect(result.behaviorEffectAmount).toBe(12);
    // Üç sayı birbirini tutar: toplam = fiyat + davranış
    expect(result.totalChangePct).toBeCloseTo(
      result.inflationPct + result.behaviorEffectPct,
      1,
    );
    expect(result.baseValue).toBe(70);
    expect(result.currentValue).toBe(92);
    expect(result.basketSize).toBe(2);
  });

  it('miktar aynı kaldığında değişimin tamamını fiyata yazar', () => {
    const base = [row('kahve', 40, 3)];
    const current = [row('kahve', 50, 3)];

    const result = computePersonalInflation(current, base);

    expect(result.inflationPct).toBe(25);
    expect(result.behaviorEffectPct).toBe(0);
    expect(result.behaviorEffectAmount).toBe(0);
    expect(result.totalChangePct).toBe(25);
  });

  it('fiyat sabitken artışın tamamını davranışa yazar', () => {
    const base = [row('cikolata', 20, 1)];
    const current = [row('cikolata', 20, 4)];

    const result = computePersonalInflation(current, base);

    expect(result.inflationPct).toBe(0);
    expect(result.behaviorEffectPct).toBe(300);
    expect(result.totalChangePct).toBe(300);
  });

  it('birim fiyatta medyan kullanır; tek kampanyalı satır dönemi temsil etmez', () => {
    // Baz dönemde ürün hep 10; güncel dönemde 12, 12 ve bir kerelik 2 (kampanya).
    const base = [row('pirinc', 10, 1), row('pirinc', 10, 1), row('pirinc', 10, 1)];
    const current = [row('pirinc', 12, 1), row('pirinc', 12, 1), row('pirinc', 2, 1)];

    const result = computePersonalInflation(current, base);

    // Ortalama 8.67 olurdu (fiyat düşmüş görünürdü); medyan 12 → %20 artış.
    expect(result.inflationPct).toBe(20);
    expect(result.contributors[0]).toMatchObject({ key: 'pirinc', currentPrice: 12 });
  });

  it('yalnız iki dönemde de alınmış ürünleri sepete alır ve kapsamı bildirir', () => {
    // Baz harcaması: ortak 100 + yalnız-baz 100 = 200 → kapsam %50
    const base = [row('ortak', 10, 10), row('sadece_baz', 50, 2)];
    const current = [row('ortak', 11, 10), row('sadece_guncel', 30, 1)];

    const result = computePersonalInflation(current, base);

    expect(result.basketSize).toBe(1);
    expect(result.coveragePct).toBe(50);
    expect(result.contributors.map(c => c.key)).toEqual(['ortak']);
  });

  it('fiyat etkisine en çok katkı yapanı miktarla ağırlıklandırarak sıralar', () => {
    // Zeytinyağı %50 zamlanmış ama tek alınmış (katkı 30);
    // ekmek yalnız %10 zamlanmış ama 100 adet (katkı 50) → ekmek başta olmalı.
    const base = [row('yag', 60, 1), row('ekmek', 5, 100)];
    const current = [row('yag', 90, 1), row('ekmek', 5.5, 100)];

    const result = computePersonalInflation(current, base);

    expect(result.contributors.map(c => c.key)).toEqual(['ekmek', 'yag']);
    expect(result.contributors[0].contributionAmount).toBe(50);
    expect(result.contributors[1].priceChangePct).toBe(50);
  });

  it('katkı listesini istenen sayıyla sınırlar', () => {
    const base = [row('a', 10, 1), row('b', 10, 2), row('c', 10, 3), row('d', 10, 4)];
    const current = [row('a', 12, 1), row('b', 12, 2), row('c', 12, 3), row('d', 12, 4)];

    const result = computePersonalInflation(current, base, { maxContributors: 2 });

    expect(result.contributors).toHaveLength(2);
    expect(result.contributors.map(c => c.key)).toEqual(['d', 'c']);
  });

  it('ucuzlamayı da negatif enflasyon olarak raporlar', () => {
    const base = [row('domates', 20, 5)];
    const current = [row('domates', 15, 5)];

    const result = computePersonalInflation(current, base);

    expect(result.inflationPct).toBe(-25);
    expect(result.priceEffectAmount).toBe(-25);
  });

  it('ortak ürün yoksa sepet kurulamadığını söyler', () => {
    const result = computePersonalInflation(
      [row('yeni', 10, 1)],
      [row('eski', 10, 1)],
    );

    expect(result.status).toBe('insufficient_basket');
    expect(result.basketSize).toBe(0);
  });

  it('dönemlerden biri boşsa veri yok der', () => {
    expect(computePersonalInflation([], [row('a', 1, 1)]).status).toBe('no_data');
    expect(computePersonalInflation([row('a', 1, 1)], []).status).toBe('no_data');
  });

  it('bozuk satırları (sıfır/negatif/NaN fiyat ve miktar) yok sayar', () => {
    const base = [
      row('saglam', 10, 2),
      row('sifir_fiyat', 0, 5),
      { key: 'nan', name: 'nan', unitPrice: Number.NaN, quantity: 1, totalPrice: 0 },
      row('negatif', -5, 1),
    ];
    const current = [
      row('saglam', 12, 2),
      row('sifir_fiyat', 0, 5),
      { key: 'nan', name: 'nan', unitPrice: Number.NaN, quantity: 1, totalPrice: 0 },
      row('negatif', -5, 1),
    ];

    const result = computePersonalInflation(current, base);

    expect(result.status).toBe('ready');
    expect(result.basketSize).toBe(1);
    expect(result.inflationPct).toBe(20);
    // Bozuk satırlar kapsam paydasını da şişirmemeli.
    expect(result.coveragePct).toBe(100);
  });

  it('fiyat etkisini etiket fiyatı ve indirim olarak ikiye böler', () => {
    // Etiket 10 → 11 (+%10). Baz dönemde indirim yok; güncel dönemde 11 etiketli
    // ürün 6'ya alınmış (kampanya). Ödenen fiyat 10 → 6, yani −%40.
    const base = [
      { key: 'yumurta', name: 'Yumurta', unitPrice: 10, listUnitPrice: 10, quantity: 10, totalPrice: 100 },
    ];
    const current = [
      { key: 'yumurta', name: 'Yumurta', unitPrice: 6, listUnitPrice: 11, quantity: 10, totalPrice: 60 },
    ];

    const result = computePersonalInflation(current, base);

    expect(result.hasDiscountSignal).toBe(true);
    // Ödenen fiyat üzerinden enflasyon: (6−10)·10 = −40 → %−40
    expect(result.inflationPct).toBe(-40);
    // Raftaki fiyat aslında ARTMIŞ: (11−10)·10 = +10 → %+10
    expect(result.listPriceEffectAmount).toBe(10);
    expect(result.listPriceEffectPct).toBe(10);
    // Kazanç kampanyadan: indirim derinliği 0 → −5 birim, ·10 = −50
    expect(result.discountEffectAmount).toBe(-50);
    // İki parça toplamı tam olarak fiyat etkisini verir.
    expect(result.listPriceEffectAmount + result.discountEffectAmount).toBe(
      result.priceEffectAmount,
    );
  });

  it('indirim verisi yoksa sinyal vermez ve etiket etkisi fiyat etkisine eşittir', () => {
    const result = computePersonalInflation(
      [{ key: 'a', name: 'A', unitPrice: 12, quantity: 5, totalPrice: 60 }],
      [{ key: 'a', name: 'A', unitPrice: 10, quantity: 5, totalPrice: 50 }],
    );

    expect(result.hasDiscountSignal).toBe(false);
    expect(result.discountEffectAmount).toBe(0);
    expect(result.listPriceEffectAmount).toBe(result.priceEffectAmount);
  });

  it('etiket fiyatı ödenenden düşük gelirse veriyi düzeltir (negatif indirim olamaz)', () => {
    const result = computePersonalInflation(
      [{ key: 'a', name: 'A', unitPrice: 10, listUnitPrice: 4, quantity: 1, totalPrice: 10 }],
      [{ key: 'a', name: 'A', unitPrice: 10, listUnitPrice: 10, quantity: 1, totalPrice: 10 }],
    );

    expect(result.hasDiscountSignal).toBe(false);
    expect(result.discountEffectAmount).toBe(0);
  });
});
