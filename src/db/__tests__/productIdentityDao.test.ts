jest.mock('../database', () => ({ getDatabase: jest.fn() }));
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => '123e4567-e89b-42d3-a456-426614174000'),
}));

import { getDatabase } from '../database';
import {
  ProductIdentityDao,
  resolveCanonicalProductForItem,
} from '../productIdentityDao';

const getDatabaseMock = getDatabase as jest.MockedFunction<typeof getDatabase>;

function product(id: number, name: string, unit: 'piece' | 'kg' | 'l' = 'kg') {
  return {
    id,
    uid: `123e4567-e89b-42d3-a456-42661417400${id}`,
    canonical_name: name,
    canonical_key: name.toLocaleLowerCase('tr-TR'),
    measurement_unit: unit,
    brand: null,
    variant: null,
    package_descriptor: null,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
  };
}

describe('persistent product identity resolution', () => {
  const getFirstAsync = jest.fn();
  const getAllAsync = jest.fn();
  const runAsync = jest.fn();
  const withTransactionAsync = jest.fn(async (operation: () => Promise<void>) => operation());

  beforeEach(() => {
    jest.clearAllMocks();
    getFirstAsync.mockResolvedValue(null);
    getAllAsync.mockResolvedValue([]);
    runAsync.mockResolvedValue({ lastInsertRowId: 9, changes: 1 });
    getDatabaseMock.mockResolvedValue({
      getFirstAsync,
      getAllAsync,
      runAsync,
      withTransactionAsync,
    } as any);
  });

  it('kayıtlı aliası ağ veya yeni ürün oluşturmadan kullanır', async () => {
    getFirstAsync.mockResolvedValueOnce(product(4, 'Tavuk Kanat'));

    await expect(resolveCanonicalProductForItem({
      name: 'Tavuk Kanadı kg',
      measurementUnit: 'kg',
    })).resolves.toMatchObject({
      canonicalProductId: 4,
      source: 'alias',
      measurementUnit: 'kg',
    });

    expect(getAllAsync).not.toHaveBeenCalled();
    expect(runAsync).not.toHaveBeenCalled();
  });

  it('tek deterministik adayda aliası öğrenir', async () => {
    getFirstAsync
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ canonical_product_id: 5 });
    getAllAsync.mockResolvedValueOnce([product(5, 'Tavuk Baget')]);

    await expect(resolveCanonicalProductForItem({
      name: 'TAVUK BAGET KG',
      measurementUnit: 'kg',
    })).resolves.toMatchObject({ canonicalProductId: 5, source: 'deterministic' });

    expect(runAsync).toHaveBeenCalledTimes(1);
    expect(String(runAsync.mock.calls[0][0])).toContain('INSERT OR IGNORE INTO product_aliases');
    expect(runAsync.mock.calls[0][1]).toEqual(expect.arrayContaining([5, 'tavuk baget kg', 'kg']));
  });

  it('güçlü AI metadatasında marka çelişirse tek adayı bile sessizce bağlamaz', async () => {
    const existing = { ...product(5, 'Tavuk Baget'), brand: 'Marka A' };
    const created = { ...product(9, 'Tavuk Baget'), brand: 'Marka B' };
    getFirstAsync
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(created)
      .mockResolvedValueOnce({ canonical_product_id: 9 });
    getAllAsync.mockResolvedValueOnce([existing]);

    await expect(resolveCanonicalProductForItem({
      name: 'Tavuk Baget kg',
      measurementUnit: 'kg',
      hint: {
        canonical_name: 'Tavuk Baget',
        brand: 'Marka B',
        confidence: 0.95,
      },
    })).resolves.toMatchObject({ canonicalProductId: 9, source: 'new' });

    expect(String(runAsync.mock.calls[0][0])).toContain('INSERT INTO canonical_products');
    expect(runAsync.mock.calls[0][1]).toEqual(expect.arrayContaining(['Marka B']));
  });

  it('düşük güvenli AI metnini görünen kanonik ad veya metadata olarak kullanmaz', async () => {
    const created = product(9, 'Tavuk Baget');
    getFirstAsync
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(created)
      .mockResolvedValueOnce({ canonical_product_id: 9 });
    getAllAsync.mockResolvedValueOnce([]);

    await resolveCanonicalProductForItem({
      name: 'Tavuk Baget kg',
      measurementUnit: 'kg',
      hint: {
        canonical_name: 'Yanlış AI Başlığı',
        brand: 'Şüpheli Marka',
        confidence: 0.4,
      },
    });

    const params = runAsync.mock.calls[0][1];
    expect(params?.[1]).toBe('Tavuk Baget');
    expect(params?.[4]).toBeNull();
  });

  it('aynı anahtarda birden çok aday varsa zorla birleştirmek yerine yeni ürün açar', async () => {
    const created = product(9, 'Tavuk Baget');
    getFirstAsync
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(created)
      .mockResolvedValueOnce({ canonical_product_id: 9 });
    getAllAsync.mockResolvedValueOnce([
      product(2, 'Tavuk Baget'),
      product(3, 'Tavuk Baget'),
    ]);

    await expect(resolveCanonicalProductForItem({
      name: 'Tavuk Baget kg',
      measurementUnit: 'kg',
    })).resolves.toMatchObject({ canonicalProductId: 9, source: 'new' });

    expect(String(runAsync.mock.calls[0][0])).toContain('INSERT INTO canonical_products');
    expect(String(runAsync.mock.calls[1][0])).toContain('INSERT OR IGNORE INTO product_aliases');
  });

  it('alias yarışta başka ürüne bağlanmışsa sessizce yanlış kimlik döndürmez', async () => {
    getFirstAsync
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ canonical_product_id: 99 });
    getAllAsync.mockResolvedValueOnce([product(5, 'Tavuk Baget')]);

    await expect(resolveCanonicalProductForItem({
      name: 'Tavuk Baget kg',
      measurementUnit: 'kg',
    })).rejects.toThrow('PRODUCT_ALIAS_CONFLICT');
  });

  it('ürün özetlerini alias ve gözlemleri çarpmadan ayrı rollup sorgularından okur', async () => {
    const summary = {
      ...product(1, 'Tavuk Baget', 'kg'),
      alias_count: 2,
      observation_count: 3,
      latest_date: '2026-08-20',
      alias_search_text: 'tavuk baget,tavuk baget kg',
      raw_search_text: 'TAVUK BAGET KG,Tavuk Baget',
      translated_search_text: 'Tavuk Baget',
      user_label_search_text: 'Kasap baget',
    };
    getAllAsync.mockResolvedValueOnce([summary]);

    await expect(ProductIdentityDao.getProductSummaries()).resolves.toEqual([summary]);

    const sql = String(getAllAsync.mock.calls[0][0]).replace(/\s+/g, ' ');
    expect(sql).toContain('WITH alias_summary AS');
    expect(sql).toContain('observation_summary AS');
    expect(sql).toContain('GROUP_CONCAT(DISTINCT NULLIF(TRIM(i.name)');
    expect(sql).toContain('NULLIF(TRIM(i.turkish_name)');
    expect(sql).toContain('NULLIF(TRIM(i.user_label)');
    expect(sql).toContain('LEFT JOIN alias_summary a');
    expect(sql).toContain('LEFT JOIN observation_summary o');
    expect(sql).not.toContain('LEFT JOIN product_aliases a ON');
    expect(sql).toContain(
      'ORDER BY observation_count DESC, p.canonical_name COLLATE NOCASE ASC, p.id ASC',
    );
  });

  it('alias gözlem sayılarını tek geçişte toplar ve son ham adı örnekler', async () => {
    getAllAsync
      .mockResolvedValueOnce([
        {
          id: 1,
          canonical_product_id: 4,
          normalized_alias: 'tavuk kanadi kg',
          measurement_unit: 'kg',
          source: 'deterministic',
          confidence: null,
          created_at: '2026-08-01T00:00:00.000Z',
        },
        {
          id: 2,
          canonical_product_id: 4,
          normalized_alias: 'tavuk kanat',
          measurement_unit: 'kg',
          source: 'user',
          confidence: 1,
          created_at: '2026-08-02T00:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        { name: 'Tavuk Kanadı kg', measurement_unit: 'kg' },
        { name: 'TAVUK KANADI KG', measurement_unit: 'kg' },
        { name: 'Tavuk Kanat', measurement_unit: 'kg' },
      ]);

    await expect(ProductIdentityDao.getAliases(4)).resolves.toEqual([
      expect.objectContaining({
        id: 1,
        observation_count: 2,
        example_name: 'TAVUK KANADI KG',
      }),
      expect.objectContaining({
        id: 2,
        observation_count: 1,
        example_name: 'Tavuk Kanat',
      }),
    ]);
  });

  it('insan onaylı merge aliasları ve gözlemleri taşır, fiş satırlarını silmez', async () => {
    getFirstAsync
      .mockResolvedValueOnce(product(1, 'Tavuk Kanadı', 'kg'))
      .mockResolvedValueOnce(product(2, 'Tavuk Kanat', 'kg'));

    await ProductIdentityDao.mergeProducts(1, 2);

    const sql = runAsync.mock.calls.map(call => String(call[0]).replace(/\s+/g, ' '));
    expect(sql.some(statement => statement.includes('UPDATE product_aliases'))).toBe(true);
    expect(sql.some(statement => statement.includes('UPDATE expense_items SET canonical_product_id'))).toBe(true);
    expect(sql.some(statement => statement.includes('DELETE FROM canonical_products'))).toBe(true);
    expect(sql.some(statement => statement.includes('DELETE FROM expense_items'))).toBe(false);
  });

  it('farklı ölçü serilerini kullanıcı seçse bile birleştirmez', async () => {
    getFirstAsync
      .mockResolvedValueOnce(product(1, 'Süt 1 L', 'piece'))
      .mockResolvedValueOnce(product(2, 'Süt', 'l'));

    await expect(ProductIdentityDao.mergeProducts(1, 2)).rejects.toThrow(
      'PRODUCT_UNIT_MISMATCH',
    );
    expect(runAsync).not.toHaveBeenCalled();
  });

  it('alias ayırmada yalnız eşleşen geçmiş bağlantılarını taşır', async () => {
    const alias = {
      id: 7,
      canonical_product_id: 1,
      normalized_alias: 'tavuk kanadi kg',
      measurement_unit: 'kg',
      source: 'deterministic',
      confidence: null,
      created_at: '2026-08-01T00:00:00.000Z',
    };
    getFirstAsync
      .mockResolvedValueOnce(alias)
      .mockResolvedValueOnce(product(1, 'Tavuk Kanat', 'kg'))
      .mockResolvedValueOnce(product(9, 'Tavuk Kanat', 'kg'));
    getAllAsync.mockResolvedValueOnce([
      { id: 11, name: 'Tavuk Kanadı kg', measurement_unit: 'kg' },
      { id: 12, name: 'Tavuk Kanat', measurement_unit: 'kg' },
    ]);
    runAsync.mockResolvedValueOnce({ lastInsertRowId: 9, changes: 1 });

    await expect(ProductIdentityDao.splitAlias(7)).resolves.toBe(9);

    const itemLinkCall = runAsync.mock.calls.find(call => (
      String(call[0]).includes('UPDATE expense_items SET canonical_product_id')
    ));
    expect(itemLinkCall?.[1]).toEqual([9, 11]);
    expect(runAsync.mock.calls.some(call => String(call[0]).includes('DELETE FROM expense_items'))).toBe(false);
  });
});
