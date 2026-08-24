import {
  canonicalizeProductLabel,
  productIdentityGroupKey,
} from '../productIdentity';

describe('canonicalizeProductLabel', () => {
  it.each([
    ['Tavuk Baget', 'Tavuk Baget kg'],
    ['Tavuk Baget', 'TAVUK BAGET KG'],
    ['Tavuk Baget', 'Tavuk Baget (kilogram)'],
    ['Tavuk Baget', 'Tavuk Baget - kilo'],
  ])('kg bazlı çıplak satış birimini temizler: %s / %s', (plain, suffixed) => {
    const first = canonicalizeProductLabel(plain, 'kg');
    const second = canonicalizeProductLabel(suffixed, 'kg');

    expect(second.canonicalName.toLocaleLowerCase('tr-TR')).toBe('tavuk baget');
    expect(second.canonicalKey).toBe(first.canonicalKey);
    expect(second.normalizedAlias).not.toBe(first.normalizedAlias);
  });

  it('litre bazlı çıplak satış birimini temizler', () => {
    expect(canonicalizeProductLabel('Zeytinyağı litre', 'l')).toMatchObject({
      canonicalName: 'Zeytinyağı',
      canonicalKey: 'zeytinyagi',
      measurementUnit: 'l',
    });
    expect(canonicalizeProductLabel('Zeytinyağı LT', 'l').canonicalKey).toBe('zeytinyagi');
  });

  it('kanat/kanadı açık ve güvenli token eşini uygular', () => {
    const plain = canonicalizeProductLabel('Tavuk Kanat', 'kg');
    const inflected = canonicalizeProductLabel('Tavuk Kanadı kg', 'kg');
    const ascii = canonicalizeProductLabel('TAVUK KANADI KG', 'kg');

    expect(inflected.canonicalName).toBe('Tavuk Kanat');
    expect(inflected.canonicalKey).toBe(plain.canonicalKey);
    expect(ascii.canonicalKey).toBe(plain.canonicalKey);
  });

  it('farklı tavuk kesim ve varyantlarını otomatik birleştirmez', () => {
    const keys = [
      'Tavuk Baget',
      'Tavuk Kanadı',
      'Tavuk But',
      'Taze Tavuk Budu',
    ].map(name => canonicalizeProductLabel(name, 'kg').canonicalKey);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each([
    ['Yoğurt 500 g', 'piece', 'yogurt 500g'],
    ['Süt 1 L', 'piece', 'sut 1l'],
    ['Dondurma 6x50 ml', 'piece', 'dondurma 6x50ml'],
    ['Dondurma 6 × 50 ml', 'piece', 'dondurma 6x50ml'],
    ['Su 1 L', 'l', 'su 1l'],
    ['Pirinç 2 kg', 'kg', 'pirinc 2kg'],
  ])('sayısal paket tanımını korur: %s', (name, unit, expectedKey) => {
    expect(canonicalizeProductLabel(name, unit).canonicalKey).toBe(expectedKey);
  });

  it('paket boyutlarını adet ürünlerinde ayrı kimlikler olarak korur', () => {
    const small = canonicalizeProductLabel('Yoğurt 500 g', 'piece');
    const large = canonicalizeProductLabel('Yoğurt 1 kg', 'piece');

    expect(small.canonicalKey).not.toBe(large.canonicalKey);
  });

  it('marka, aroma, yağ oranı ve diğer varyantları korur', () => {
    const fullFat = canonicalizeProductLabel('Marka Süt %3,2 Çilek 1L', 'piece');
    const light = canonicalizeProductLabel('Marka Süt %1,5 Vanilya 1L', 'piece');

    expect(fullFat.canonicalKey).toContain('marka');
    expect(fullFat.canonicalKey).toContain('%3.2');
    expect(fullFat.canonicalKey).toContain('cilek');
    expect(fullFat.canonicalKey).not.toBe(light.canonicalKey);
  });

  it('yakın yazımları fuzzy eşleşmeyle kendiliğinden birleştirmez', () => {
    expect(canonicalizeProductLabel('Tavuk Baget', 'kg').canonicalKey)
      .not.toBe(canonicalizeProductLabel('Tavuk Baged', 'kg').canonicalKey);
  });

  it('g/ml girdi birimlerini kanonik kg/L türüne indirger', () => {
    expect(canonicalizeProductLabel('Çilek 530 g', 'g')).toMatchObject({
      canonicalKey: 'cilek 530g',
      measurementUnit: 'kg',
    });
    expect(canonicalizeProductLabel('İçecek 750 ml', 'ml')).toMatchObject({
      canonicalKey: 'icecek 750ml',
      measurementUnit: 'l',
    });
  });
});

describe('productIdentityGroupKey', () => {
  it('kalıcı canonical kimliği addan önce kullanır', () => {
    expect(productIdentityGroupKey({
      canonicalProductId: 42,
      name: 'Tavuk Baget',
      measurementUnit: 'kg',
    })).toBe(productIdentityGroupKey({
      canonicalProductId: 42,
      name: 'Chicken Drumsticks',
      measurementUnit: 'kg',
    }));
  });

  it('kalıcı kimlikte bile farklı ölçü türlerini ayırır', () => {
    const piece = productIdentityGroupKey({
      canonicalProductId: 42,
      name: 'Domates',
      measurementUnit: 'piece',
    });
    const kg = productIdentityGroupKey({
      canonicalProductId: 42,
      name: 'Domates',
      measurementUnit: 'kg',
    });

    expect(piece).not.toBe(kg);
  });

  it('eski kayıtta güvenli canonical anahtar ve birime geri düşer', () => {
    expect(productIdentityGroupKey({
      canonicalProductId: null,
      name: 'Tavuk Kanadı kg',
      measurementUnit: 'kg',
    })).toBe(productIdentityGroupKey({
      name: 'Tavuk Kanat',
      measurementUnit: 'kg',
    }));
  });

  it('adı boş eski kaydı ortak bir gruba toplamaz', () => {
    expect(productIdentityGroupKey({ name: '  ', measurementUnit: 'piece' })).toBe('');
  });
});
