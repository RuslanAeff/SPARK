// geminiService'in SAF ayrıştırma yardımcıları (ağ/anahtar yok). secureKeyStore
// mock'lanır → native expo-secure-store jest'te yüklenmez.
jest.mock('../secureKeyStore', () => ({
  getSecureApiKey: jest.fn(),
  setSecureApiKey: jest.fn(),
  hasSecureApiKey: jest.fn(),
  deleteSecureApiKey: jest.fn(),
}));

import {
  coerceParsedReceipt,
  tryJsonToReceipt,
  isUnsuitableForReceiptParsing,
  suggestProductMatch,
  parseReceipt,
  buildReceiptPrompt,
  validateParsedReceipt,
} from '../geminiService';
import { getSecureApiKey } from '../secureKeyStore';

const getSecureApiKeyMock = getSecureApiKey as jest.MockedFunction<typeof getSecureApiKey>;

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

  it('yerel binlik ve ondalık ayraçlı string tutarları doğru çözer', () => {
    const out = coerceParsedReceipt({
      items: [{ name: 'A', quantity: 1, unit_price: '1.234,56', total_price: '1 234,56' }],
      total: '1 234,56',
    })!;
    expect(out.items[0].unit_price).toBe(1234.56);
    expect(out.items[0].total_price).toBe(1234.56);
    expect(out.total).toBe(1234.56);
  });

  it('unit_price yoksa total/quantity ile türetir', () => {
    const out = coerceParsedReceipt({
      items: [{ name: 'A', quantity: 2, unit_price: 0, total_price: 10, suggested_category: 'Market' }],
    })!;
    expect(out.items[0].unit_price).toBe(5);
  });

  it('gram miktarını kg tabanına çevirip kilogram fiyatını türetir', () => {
    const out = coerceParsedReceipt({
      vendor_name: 'Market', date: '2026-08-21', total: 7.94, currency: 'PLN',
      items: [{ name: 'Çilek', quantity: 530, measurement_unit: 'g', unit_price: 0.015, total_price: 7.94 }],
    })!;
    expect(out.items[0].quantity).toBe(0.53);
    expect(out.items[0].measurement_unit).toBe('kg');
    expect(out.items[0].unit_price).toBeCloseTo(14.9811, 4);
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

  it('basılı adı ve adet ölçümünü değiştirmeden paket kimliğini korur', () => {
    const out = coerceParsedReceipt({
      items: [{
        name: 'Yoğurt 500 g',
        quantity: 1,
        measurement_unit: 'piece',
        unit_price: 4.5,
        total_price: 4.5,
        product_identity: {
          canonical_name: 'Yoğurt 500 g',
          brand: null,
          product_family: 'Yoğurt',
          variant: null,
          package_descriptor: '500 g',
          confidence: 0.92,
        },
      }],
    })!;

    expect(out.items[0].name).toBe('Yoğurt 500 g');
    expect(out.items[0].measurement_unit).toBe('piece');
    expect(out.items[0].product_identity).toEqual({
      canonical_name: 'Yoğurt 500 g',
      brand: null,
      product_family: 'Yoğurt',
      variant: null,
      package_descriptor: '500 g',
      confidence: 0.92,
    });
  });

  it('ürün kimliği alanlarını temizleyip sınırlar ve güveni 0..1 aralığında tutar', () => {
    const out = coerceParsedReceipt({
      items: [{
        name: 'A',
        quantity: 1,
        measurement_unit: 'piece',
        unit_price: 1,
        total_price: 1,
        product_identity: {
          canonical_name: `  ${'c'.repeat(220)}  `,
          brand: `Ma\u0000rka ${'b'.repeat(120)}`,
          product_family: '  Sütlü\n  Ürün  ',
          variant: '  Sade\t  ',
          package_descriptor: 'p'.repeat(100),
          confidence: 4,
        },
      }],
    })!;
    const identity = out.items[0].product_identity!;

    expect(identity.canonical_name).toHaveLength(180);
    expect(identity.brand).not.toContain('\u0000');
    expect(identity.brand!.length).toBeLessThanOrEqual(100);
    expect(identity.product_family).toBe('Sütlü Ürün');
    expect(identity.variant).toBe('Sade');
    expect(identity.package_descriptor).toHaveLength(80);
    expect(identity.confidence).toBe(1);
  });

  it('zorunlu kimlik alanları geçersizse öneri metadatasını yok sayar', () => {
    const out = coerceParsedReceipt({
      items: [
        {
          name: 'A', quantity: 1, unit_price: 1, total_price: 1,
          product_identity: { canonical_name: '', confidence: 0.9 },
        },
        {
          name: 'B', quantity: 1, unit_price: 1, total_price: 1,
          product_identity: { canonical_name: 'B', confidence: 'kesin' },
        },
      ],
    })!;

    expect(out.items[0].product_identity).toBeUndefined();
    expect(out.items[1].product_identity).toBeUndefined();
  });
});

describe('çok dilli fiş sözleşmesi ve kalite kapısı', () => {
  it.each([
    ['tr', 'Turkish'],
    ['en', 'English'],
    ['az', 'Azerbaijani'],
    ['ru', 'Russian'],
  ] as const)('%s için çeviri dilini çelişkisiz ister', (language, languageName) => {
    const prompt = buildReceiptPrompt(language);
    expect(prompt).toContain(`\"translation_language\": \"${language}\"`);
    expect(prompt).toContain(`\"localized_name\": \"${languageName} translation`);
    expect(prompt).not.toContain('\"turkish_name\"');
    expect(prompt).toContain('category_key MUST be exactly one of');
  });

  it('boş model iskeletini geçerli fiş saymaz', () => {
    expect(tryJsonToReceipt(JSON.stringify({
      vendor_name: 'Market', date: '2026-08-23', items: [], total: 0, currency: 'PLN',
    }))).toBeNull();
  });

  it('eksik alanları sıfıra çevirip kayda hazır saymaz', () => {
    expect(tryJsonToReceipt(JSON.stringify({ items: [{}] }))).toBeNull();
  });

  it('pozitif kalem varken modelin döndürdüğü sahte sıfır toplamı reddeder', () => {
    expect(tryJsonToReceipt(JSON.stringify({
      vendor_name: 'Market', date: '2026-08-23', currency: 'PLN', total: 0,
      items: [{ name: 'Ekmek', quantity: 1, unit_price: 5, total_price: 5, category_key: 'market' }],
    }))).toBeNull();
  });

  it('brüt tutar ve tam indirim kanıtı olan gerçek sıfır fişi korur', () => {
    const receipt = tryJsonToReceipt(JSON.stringify({
      vendor_name: 'Market', date: '2026-08-23', currency: 'PLN', total: 0,
      items: [{
        name: 'Ekmek', quantity: 1, unit_price: 0, total_price: 0,
        line_discount: 10, list_line_total_before_discount: 10, category_key: 'market',
      }],
    }));
    expect(receipt).not.toBeNull();
    expect(validateParsedReceipt(receipt!).valid).toBe(true);
  });

  it('localized_name değerini geriye uyumlu alana taşır ve kategori anahtarını kanonikleştirir', () => {
    const receipt = tryJsonToReceipt(JSON.stringify({
      vendor_name: 'Sklep', date: '2026-08-23', translation_language: 'ru',
      currency: 'PLN', total: 6,
      items: [{
        name: 'Chleb', localized_name: 'Хлеб', quantity: 1,
        unit_price: 6, total_price: 6, category_key: 'market',
      }],
    }))!;
    expect(receipt.translation_language).toBe('ru');
    expect(receipt.items[0].turkish_name).toBe('Хлеб');
    expect(receipt.items[0].suggested_category).toBe('Market');
  });
});

describe('parseReceipt model kalite fallback', () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    getSecureApiKeyMock.mockResolvedValue('test-api-key');
    (global as typeof globalThis).fetch = fetchMock as typeof fetch;
  });

  afterAll(() => {
    (global as typeof globalThis).fetch = originalFetch;
  });

  it('ilk model boş fiş döndürürse sonraki modelin geçerli sonucunu kullanır', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/models')) {
        return {
          ok: true,
          json: async () => ({
            models: [
              { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
              { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
            ],
          }),
        } as Response;
      }
      const content = url.includes('gemini-2.5-flash:generateContent')
        ? JSON.stringify({ vendor_name: 'Market', date: '2026-08-23', items: [], total: 0 })
        : JSON.stringify({
          vendor_name: 'Market', date: '2026-08-23', translation_language: 'az',
          currency: 'PLN', total: 5,
          items: [{
            name: 'Chleb', localized_name: 'Çörək', quantity: 1,
            unit_price: 5, total_price: 5, category_key: 'market',
          }],
        });
      return {
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: content }] } }] }),
      } as Response;
    });

    const receipt = await parseReceipt('base64', 'az');

    expect(receipt.items[0].turkish_name).toBe('Çörək');
    expect(receipt.translation_language).toBe('az');
    expect(receipt._modelUsed).toContain('gemini-2.5-pro');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('suggestProductMatch', () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    getSecureApiKeyMock.mockResolvedValue('test-api-key');
    (global as typeof globalThis).fetch = fetchMock as typeof fetch;
  });

  afterAll(() => {
    (global as typeof globalThis).fetch = originalFetch;
  });

  it('farklı ölçüm birimlerini SecureStore veya ağ çağrısından önce reddeder', async () => {
    await expect(suggestProductMatch(
      { name: 'Tavuk Baget', measurementUnit: 'kg' },
      { name: 'Tavuk Baget', measurementUnit: 'piece' },
    )).rejects.toThrow('PRODUCT_MATCH_UNIT_MISMATCH');

    expect(getSecureApiKeyMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('yalnız sınırlı aday metni gönderip yapılandırılmış öneriyi doğrular', async () => {
    let generateBody: Record<string, any> | undefined;
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/models')) {
        return {
          ok: true,
          json: async () => ({
            models: [{
              name: 'models/gemini-2.5-flash',
              supportedGenerationMethods: ['generateContent'],
            }],
          }),
        } as Response;
      }
      generateBody = JSON.parse(String(init?.body));
      return {
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  same_product: true,
                  confidence: 0.97,
                  canonical_name: 'Tavuk Baget',
                  reason: 'Satış birimi ve ürün varyantı aynı.',
                }),
              }],
            },
          }],
        }),
      } as Response;
    });

    const result = await suggestProductMatch(
      {
        name: `Tavuk Baget kg ${'x'.repeat(300)}`,
        measurementUnit: 'kg',
        canonicalName: 'Tavuk Baget',
        productFamily: 'Tavuk',
        variant: 'Baget',
      },
      { name: 'TAVUK BAGET', measurementUnit: 'kg' },
    );

    expect(result).toEqual({
      sameProduct: true,
      confidence: 0.97,
      canonicalName: 'Tavuk Baget',
      reason: 'Satış birimi ve ürün varyantı aynı.',
    });
    expect(generateBody?.contents[0].parts).toHaveLength(1);
    expect(generateBody?.contents[0].parts[0]).not.toHaveProperty('inline_data');
    const prompt = generateBody?.contents[0].parts[0].text as string;
    const candidateData = JSON.parse(prompt.split('candidate_data=')[1]);
    expect(candidateData.left.name).toHaveLength(240);
    expect(candidateData.left.measurement_unit).toBe('kg');
    expect(candidateData.right.measurement_unit).toBe('kg');
  });

  it('şema dışı veya sınır dışı AI yanıtını kabul etmez', async () => {
    fetchMock.mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                same_product: 'yes',
                confidence: 1.2,
                canonical_name: 'Tavuk Baget',
                reason: null,
              }),
            }],
          },
        }],
      }),
    } as Response));

    await expect(suggestProductMatch(
      { name: 'Tavuk Baget kg', measurementUnit: 'kg' },
      { name: 'Tavuk Baget', measurementUnit: 'kg' },
    )).rejects.toThrow('INVALID_PRODUCT_MATCH_RESPONSE');
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
