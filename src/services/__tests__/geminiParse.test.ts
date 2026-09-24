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
  resetGeminiModelState,
  saveApiKey,
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
    resetGeminiModelState();
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
    resetGeminiModelState();
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
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => String(input).endsWith('/models') ? ({
      ok: true,
      json: async () => ({
        models: [{ name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] }],
      }),
    } as Response) : ({
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

describe('Gemini model uyumluluğu (Eylül 2026)', () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn();
  const RECEIPT = JSON.stringify({
    vendor_name: 'Market', date: '2026-09-20', currency: 'PLN', total: 5,
    items: [{ name: 'Chleb', localized_name: 'Ekmek', quantity: 1, unit_price: 5, total_price: 5, category_key: 'market' }],
  });

  const models = (ids: string[]) => ({
    ok: true,
    json: async () => ({ models: ids.map((id) => ({ name: `models/${id}`, supportedGenerationMethods: ['generateContent'] })) }),
  }) as Response;
  const answer = (text: string, finishReason = 'STOP') => ({
    ok: true,
    json: async () => ({ candidates: [{ finishReason, content: { parts: [{ text }] } }] }),
  }) as Response;
  const failure = (status: number, body: string) => ({ ok: false, status, text: async () => body }) as Response;

  /** generateContent çağrılarını model + gönderilen düşünme ayarıyla kaydeder. */
  function generateCalls() {
    return fetchMock.mock.calls
      .filter(([url]) => String(url).includes(':generateContent'))
      .map(([url, init]) => ({
        model: /models\/([^:]+):/.exec(String(url))![1],
        generationConfig: JSON.parse(String((init as RequestInit).body)).generationConfig,
      }));
  }

  beforeEach(() => {
    jest.clearAllMocks();
    getSecureApiKeyMock.mockResolvedValue('test-api-key');
    (global as typeof globalThis).fetch = fetchMock as typeof fetch;
    resetGeminiModelState();
  });

  afterAll(() => {
    (global as typeof globalThis).fetch = originalFetch;
  });

  it('kapanmış 2.0 modelini atlar ve Gemini 3 flash’a thinkingBudget yerine thinkingLevel gönderir', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => (String(input).endsWith('/models')
      ? models(['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-3.8-flash'])
      : answer(RECEIPT)));

    const receipt = await parseReceipt('base64', 'tr');

    expect(receipt._modelUsed).toBe('gemini-3.8-flash (v1beta)');
    expect(generateCalls()).toEqual([{
      model: 'gemini-3.8-flash',
      generationConfig: expect.objectContaining({ thinkingConfig: { thinkingLevel: 'low' }, maxOutputTokens: 16384 }),
    }]);
  });

  it('cihaz logundaki durum: flash havuzu yoğunken ayrı havuzdaki flash-lite ile tarar', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/models')) {
        return models(['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite']);
      }
      return url.includes('flash-lite')
        ? answer(RECEIPT)
        : failure(503, '{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}');
    });

    const receipt = await parseReceipt('base64', 'tr');

    expect(receipt._modelUsed).toBe('gemini-3.5-flash-lite (v1beta)');
    // Aynı yoğun modelde bekleyip yeniden denemez; ikinci istek ayrı havuza gider.
    expect(generateCalls().map((call) => call.model)).toEqual(['gemini-3.8-flash', 'gemini-3.5-flash-lite']);
  });

  it('reddedilen düşünme ayarını başarısız taramadan sonra da hatırlar', async () => {
    const empty = JSON.stringify({ vendor_name: 'Market', date: '2026-09-20', items: [], total: 0 });
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/models')) return models(['gemini-3.8-flash', 'gemini-3.5-flash-lite']);
      const body = JSON.parse(String(init?.body));
      if (url.includes('3.8-flash:') && body.generationConfig.thinkingConfig) {
        return failure(400, '{"error":{"message":"Thinking level LOW is not supported for this model."}}');
      }
      return answer(empty);
    });

    await expect(parseReceipt('base64', 'tr')).rejects.toMatchObject({ code: 'RECEIPT_INVALID_RESULT' });
    fetchMock.mockClear();
    await expect(parseReceipt('base64', 'tr')).rejects.toMatchObject({ code: 'RECEIPT_INVALID_RESULT' });

    expect(generateCalls().map((call) => [call.model, call.generationConfig.thinkingConfig ?? null])).toEqual([
      ['gemini-3.8-flash', null],
      ['gemini-3.5-flash-lite', { thinkingLevel: 'low' }],
    ]);
  });

  it('tüm adaylar yoğunsa bekleyip yalnız bir kez son deneme yapar', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => (String(input).endsWith('/models')
      ? models(['gemini-3.8-flash', 'gemini-3.5-flash-lite'])
      : failure(503, '{"error":{"code":503,"status":"UNAVAILABLE"}}')));

    jest.useFakeTimers();
    try {
      const assertion = expect(parseReceipt('base64', 'tr')).rejects.toMatchObject({ code: 'AI_SERVER_BUSY' });
      await jest.advanceTimersByTimeAsync(3_000);
      await assertion;
    } finally {
      jest.useRealTimers();
    }
    expect(generateCalls().map((call) => call.model)).toEqual([
      'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash',
    ]);
  });

  it('hiçbir düşünme ayarı kabul edilmezse parametresiz dener', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/models')) return models(['gemini-3.8-flash']);
      const body = JSON.parse(String(init?.body));
      return body.generationConfig.thinkingConfig
        ? failure(400, '{"error":{"message":"Unknown name \"thinkingConfig\"","status":"INVALID_ARGUMENT"}}')
        : answer(RECEIPT);
    });

    await expect(parseReceipt('base64', 'tr')).resolves.toMatchObject({ vendor_name: 'Market' });
    expect(generateCalls()).toHaveLength(2);
    expect(generateCalls()[1].generationConfig).not.toHaveProperty('thinkingConfig');
  });

  it('anahtar reddini başka model denemeden tipli kodla bildirir', async () => {
    fetchMock.mockImplementation(async () => failure(400,
      '{"error":{"code":400,"message":"API key not valid.","details":[{"reason":"API_KEY_INVALID"}]}}'));

    await expect(parseReceipt('base64', 'tr')).rejects.toMatchObject({ code: 'AI_KEY_REJECTED' });
    expect(generateCalls()).toHaveLength(0);
  });

  it('tüm modellerin kotası doluysa en erken açılan süreyi bildirir', async () => {
    const quota = (seconds: number) => failure(429, JSON.stringify({ error: {
      code: 429, details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: `${seconds}s` }],
    } }));
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/models')) return models(['gemini-3.8-flash', 'gemini-3.6-flash']);
      return url.includes('3.8') ? quota(40) : quota(12);
    });

    await expect(parseReceipt('base64', 'tr')).rejects.toMatchObject({ code: 'AI_QUOTA', retryAfterSec: 12 });

    // Hemen tekrar denenirse kota dolu modellere istek atılıp kota daha çok yakılmaz.
    fetchMock.mockClear();
    const again = parseReceipt('base64', 'tr');
    await expect(again).rejects.toMatchObject({ code: 'AI_QUOTA' });
    await again.catch((error) => expect(error.retryAfterSec).toBeLessThanOrEqual(12));
    expect(generateCalls()).toHaveLength(0);
  });

  it('cihaz logundaki durum: yoğunluk + günlük kota birlikteyse yoğunluğu söyler ve kotası biten modeli gün boyu atlar', async () => {
    const now = Date.UTC(2026, 8, 24, 14, 45);
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
    try {
      const dailyQuota = failure(429, JSON.stringify({ error: {
        code: 429, message: 'You exceeded your current quota, please check your plan and billing details.',
        details: [
          { '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
            violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] },
          { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '40s' },
        ],
      } }));
      const busy = failure(503, '{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}');
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/models')) return models(['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite']);
        return url.includes('3.7-flash') ? dailyQuota : busy;
      });

      // Birinin kotası gün boyu dolu olsa da diğerleri yalnız geçici yoğun:
      // kullanıcıya "yarın" denmez.
      await expect(parseReceipt('base64', 'tr')).rejects.toMatchObject({ code: 'AI_SERVER_BUSY' });
      expect(generateCalls().map((call) => call.model)).toEqual([
        'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.7-flash',
      ]);

      // Yoğunluk dinlenmesi bitince (20 sn sonra) flash yeniden denenir ve açılmışsa
      // tarama başarılı olur; günlük kotası dolan 3.7 gün boyu hiç denenmez.
      nowSpy.mockReturnValue(now + 30_000);
      fetchMock.mockClear();
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => (String(input).includes('3.7-flash')
        ? dailyQuota
        : answer(RECEIPT)));
      await expect(parseReceipt('base64', 'tr')).resolves.toMatchObject({ _modelUsed: 'gemini-3.8-flash (v1beta)' });
      expect(generateCalls().map((call) => call.model)).toEqual(['gemini-3.8-flash']);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('tüm modellerin günlük kotası dolunca istek atmadan yenilenme anını bildirir', async () => {
    const now = Date.UTC(2026, 8, 24, 14, 45);
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
    try {
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => (String(input).endsWith('/models')
        ? models(['gemini-3.8-flash', 'gemini-3.5-flash-lite'])
        : failure(429, JSON.stringify({ error: { code: 429, details: [
          { '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
            violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] },
          { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '40s' },
        ] } }))));

      // Google'ın 40 sn'lik retryDelay'i yerine Pasifik gece yarısı: 25 Eylül 07:00 UTC.
      const expected = { code: 'AI_QUOTA_DAILY', resetsAt: Date.UTC(2026, 8, 25, 7) };
      await expect(parseReceipt('base64', 'tr')).rejects.toMatchObject(expected);

      fetchMock.mockClear();
      await expect(parseReceipt('base64', 'tr')).rejects.toMatchObject(expected);
      expect(generateCalls()).toHaveLength(0);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('ağa ulaşılamazsa bunu genel hata yerine AI_NETWORK olarak bildirir', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    await expect(parseReceipt('base64', 'tr')).rejects.toMatchObject({ code: 'AI_NETWORK' });
  });

  it('bir modelin okunamayan yanıt gövdesini ağ hatası saymaz; sıradaki modeli dener', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/models')) return models(['gemini-3.8-flash', 'gemini-3.6-flash']);
      if (url.includes('3.8')) {
        return { ok: true, json: async () => { throw new SyntaxError('Unexpected token <'); } } as unknown as Response;
      }
      return answer(RECEIPT);
    });

    await expect(parseReceipt('base64', 'tr')).resolves.toMatchObject({ _modelUsed: 'gemini-3.6-flash (v1beta)' });
  });

  it('çıktı sınırında kesilen yanıtı geçersiz fişten ayırır', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => (String(input).endsWith('/models')
      ? models(['gemini-3.8-flash'])
      : answer('{"vendor_name":"Mar', 'MAX_TOKENS')));

    await expect(parseReceipt('base64', 'tr')).rejects.toMatchObject({ code: 'AI_RESPONSE_TRUNCATED' });
  });

  it('ürün eşleştirme Gemini 3 için düşünme payı bırakan çıktı sınırıyla gönderilir', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => (String(input).endsWith('/models')
      ? models(['gemini-3.8-flash'])
      : answer(JSON.stringify({ same_product: false, confidence: 0.4, canonical_name: null, reason: null }))));

    await suggestProductMatch(
      { name: 'Süt 1L', measurementUnit: 'piece' },
      { name: 'Süt 2L', measurementUnit: 'piece' },
    );

    expect(generateCalls()[0].generationConfig).toMatchObject({
      maxOutputTokens: 2048,
      thinkingConfig: { thinkingLevel: 'low' },
    });
  });

  it('anahtar değişince önceki anahtarın model listesi kullanılmaz', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => (String(input).endsWith('/models')
      ? models(['gemini-3.8-flash'])
      : answer(RECEIPT)));
    await parseReceipt('base64', 'tr');
    await saveApiKey('new-key');
    fetchMock.mockClear();

    await parseReceipt('base64', 'tr');

    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/models'))).toHaveLength(1);
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
