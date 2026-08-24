import type { MeasurementUnit } from '../measurementUnit';
import {
  buildProductMatchCandidates,
  filterAndSortProductMatches,
  getProductMatchTimeBucket,
  groupProductsByActivity,
  type ProductMatchViewProduct,
} from '../productMatchDiscovery';

function product(
  id: number,
  canonicalName: string,
  unit: MeasurementUnit = 'kg',
  overrides: Partial<ProductMatchViewProduct> = {},
): ProductMatchViewProduct {
  return {
    id,
    canonical_name: canonicalName,
    canonical_key: canonicalName.toLocaleLowerCase('tr-TR'),
    measurement_unit: unit,
    observation_count: id,
    latest_date: '2026-08-20',
    alias_search_text: null,
    raw_search_text: null,
    translated_search_text: null,
    user_label_search_text: null,
    ...overrides,
  };
}

function candidateIds(products: readonly ProductMatchViewProduct[]): string[] {
  return buildProductMatchCandidates(products, 100)
    .map(candidate => [candidate.left.id, candidate.right.id].sort((a, b) => a - b).join(':'));
}

describe('buildProductMatchCandidates', () => {
  it('satış birimi eki dışında aynı kg ürünlerini inceleme adayı yapar', () => {
    const products = [
      product(1, 'Tavuk Baget'),
      product(2, 'TAVUK BAGET KG'),
    ];

    const candidates = buildProductMatchCandidates(products);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      left: { id: 1 },
      right: { id: 2 },
      score: 1,
    });
  });

  it('gözden geçirilmiş kanat/kanadı eşini ve çevrilmiş/ham sinyalleri destekler', () => {
    const products = [
      product(1, 'Tavuk Kanat', 'kg', { raw_search_text: 'Skrzydełka luz' }),
      product(2, 'Kurczak skrzydło', 'kg', {
        translated_search_text: 'Tavuk Kanadı kg',
        user_label_search_text: 'Tavuk Kanat',
      }),
    ];

    expect(candidateIds(products)).toEqual(['1:2']);
  });

  it('yalnız genel tavuk kelimesi ortak diye farklı kesimleri aday yapmaz', () => {
    expect(candidateIds([
      product(1, 'Tavuk Baget'),
      product(2, 'Tavuk Kanat'),
      product(3, 'Taze Tavuk Budu'),
    ])).toEqual([]);
  });

  it('aynı adın piece ve kg kayıtlarını hiçbir koşulda eşleştirmez', () => {
    expect(candidateIds([
      product(1, 'Tavuk Baget', 'piece'),
      product(2, 'Tavuk Baget', 'kg'),
    ])).toEqual([]);
  });

  it('yalnız paket ölçüsü ortak diye ilgisiz ürünleri aday yapmaz', () => {
    expect(candidateIds([
      product(1, 'Yoğurt 500 g', 'piece'),
      product(2, 'Ekmek 500 g', 'piece'),
      product(3, 'Tost 500 g', 'piece'),
    ])).toEqual([]);
  });

  it('ortak marka metnini tek başına ürün benzerliği saymaz', () => {
    expect(candidateIds([
      product(1, 'Marka Süt', 'piece', { brand: 'Aynı Marka' }),
      product(2, 'Marka Bisküvi', 'piece', { brand: 'Aynı Marka' }),
    ])).toEqual([]);
  });

  it('aynı kimliğin yanlışlıkla iki kez verilmesini kendi kendisiyle eşleştirmez', () => {
    expect(candidateIds([
      product(1, 'Tavuk Baget'),
      product(1, 'Tavuk Baget kg'),
    ])).toEqual([]);
  });

  it('çelişen paket büyüklüklerini aynı ürün adı ortak olsa bile aday yapmaz', () => {
    expect(candidateIds([
      product(1, 'Yoğurt 500 g', 'piece'),
      product(2, 'Yoğurt 1 kg', 'piece'),
    ])).toEqual([]);
  });

  it('tekrar eden çift üretmez, limiti aşmaz ve kaynak diziyi değiştirmez', () => {
    const products = Array.from({ length: 2_000 }, (_, index) => (
      product(index + 1, `Ürün ${index + 1}`, 'piece', {
        alias_search_text: `Benzersiz etiket ${index + 1}`,
      })
    ));
    products.push(product(2_001, 'Tavuk Baget kg'));
    products.push(product(2_002, 'Tavuk Baget'));
    const originalIds = products.map(item => item.id);

    const candidates = buildProductMatchCandidates(products, 5);

    expect(candidates).toHaveLength(1);
    expect(new Set(candidateIds(products)).size).toBe(candidateIds(products).length);
    expect(candidates.length).toBeLessThanOrEqual(5);
    expect(products.map(item => item.id)).toEqual(originalIds);
  });
});

describe('zaman bölümleri', () => {
  const today = '2026-08-23';

  it.each([
    ['2026-08-23', 'recent30'],
    ['2026-07-24', 'recent30'],
    ['2026-07-23', 'recent90'],
    ['2026-05-25', 'recent90'],
    ['2026-05-24', 'recent365'],
    ['2025-08-23', 'recent365'],
    ['2025-08-22', 'older'],
    [null, 'unknown'],
    ['geçersiz', 'unknown'],
    ['2026-02-30', 'unknown'],
    ['2026-08-24', 'unknown'],
  ])('%s tarihi %s bölümüne gider', (date, expected) => {
    expect(getProductMatchTimeBucket(date, today)).toBe(expected);
  });

  it('grupları sabit zaman sırasıyla üretir ve boş grupları çıkarır', () => {
    const products = [
      product(5, 'Geçmişsiz', 'piece', { latest_date: null }),
      product(1, 'Yeni', 'piece', { latest_date: '2026-08-20' }),
      product(4, 'Çok eski', 'piece', { latest_date: '2024-01-01' }),
      product(3, 'Bu yıl', 'piece', { latest_date: '2026-01-01' }),
      product(2, 'Bu çeyrek', 'piece', { latest_date: '2026-07-01' }),
    ];
    const originalIds = products.map(item => item.id);

    const sections = groupProductsByActivity(products, today);

    expect(sections.map(section => section.key)).toEqual([
      'recent30', 'recent90', 'recent365', 'older', 'unknown',
    ]);
    expect(sections.map(section => section.data.map(item => item.id))).toEqual([
      [1], [2], [3], [4], [5],
    ]);
    expect(products.map(item => item.id)).toEqual(originalIds);
  });
});

describe('filterAndSortProductMatches', () => {
  const today = '2026-08-23';
  const products = [
    product(1, 'Tavuk Baget', 'kg', {
      observation_count: 4,
      latest_date: '2026-08-22',
      raw_search_text: 'Pałki kurczaka',
    }),
    product(2, 'Süt 1 L', 'piece', {
      observation_count: 20,
      latest_date: '2026-06-01',
      translated_search_text: 'Tam yağlı süt',
    }),
    product(3, 'Ekmek 500 g', 'piece', {
      observation_count: 7,
      latest_date: '2025-01-01',
      user_label_search_text: 'Kahvaltılık ekmek',
    }),
    product(4, 'Gelecek', 'kg', {
      observation_count: 100,
      latest_date: '2026-08-24',
    }),
    product(5, 'Belirsiz', 'piece', {
      observation_count: 1,
      latest_date: null,
    }),
  ];

  it('canonical/alias/raw/translated/user label alanlarında aksansız arar', () => {
    expect(filterAndSortProductMatches(products, { search: 'palki', today }).map(item => item.id))
      .toEqual([1]);
    expect(filterAndSortProductMatches(products, { search: 'yağlı', today }).map(item => item.id))
      .toEqual([2]);
    expect(filterAndSortProductMatches(products, { search: 'kahvaltilik', today }).map(item => item.id))
      .toEqual([3]);
  });

  it('birim ve seçili ürün birimi kısıtlarını birlikte uygular', () => {
    expect(filterAndSortProductMatches(products, {
      unit: 'kg',
      anchorUnit: 'kg',
      today,
    }).map(item => item.id)).toEqual([1, 4]);
    expect(filterAndSortProductMatches(products, {
      unit: 'piece',
      anchorUnit: 'kg',
      today,
    })).toEqual([]);
  });

  it('30/90/365 filtrelerini birikimli, older ve none durumlarını ayrı uygular', () => {
    expect(filterAndSortProductMatches(products, { time: '30', today }).map(item => item.id))
      .toEqual([1]);
    expect(filterAndSortProductMatches(products, { time: '90', today }).map(item => item.id))
      .toEqual([1, 2]);
    expect(filterAndSortProductMatches(products, { time: '365', today }).map(item => item.id))
      .toEqual([1, 2]);
    expect(filterAndSortProductMatches(products, { time: 'older', today }).map(item => item.id))
      .toEqual([3]);
    expect(filterAndSortProductMatches(products, { time: 'none', today }).map(item => item.id))
      .toEqual([5, 4]);
  });

  it('recent, frequent ve name sıralamalarını deterministik uygular', () => {
    expect(filterAndSortProductMatches(products, { sort: 'recent', today }).map(item => item.id))
      .toEqual([1, 2, 3, 5, 4]);
    expect(filterAndSortProductMatches(products, { sort: 'frequent', today }).map(item => item.id))
      .toEqual([4, 2, 3, 1, 5]);
    expect(filterAndSortProductMatches(products, { sort: 'name', today }).map(item => item.id))
      .toEqual([5, 3, 4, 2, 1]);
  });

  it('kaynak diziyi mutate etmez', () => {
    const originalIds = products.map(item => item.id);
    filterAndSortProductMatches(products, { sort: 'name', time: 'all', today });
    expect(products.map(item => item.id)).toEqual(originalIds);
  });
});
