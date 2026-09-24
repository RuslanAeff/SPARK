import {
  isKeyRejection,
  isRetiredModelId,
  isThinkingConfigRejection,
  parseGeminiVersion,
  pickCandidates,
  sortModelStrings,
  thinkingVariantsFor,
} from '../geminiModelSelection';

describe('parseGeminiVersion', () => {
  it('ana ve alt sürümü sayısal okur; 3.10 > 3.8 sıralaması bozulmaz', () => {
    expect(parseGeminiVersion('gemini-3.8-flash')).toEqual({ major: 3, minor: 8 });
    expect(parseGeminiVersion('gemini-3.10-flash')).toEqual({ major: 3, minor: 10 });
    expect(parseGeminiVersion('gemini-2.5-flash-lite')).toEqual({ major: 2, minor: 5 });
    expect(parseGeminiVersion('gemini-3-flash')).toEqual({ major: 3, minor: 0 });
  });

  it('sürümsüz takma adları ve Gemini dışı modelleri tanımaz', () => {
    expect(parseGeminiVersion('gemini-flash-latest')).toBeNull();
    expect(parseGeminiVersion('gemma-3-27b-it')).toBeNull();
  });
});

describe('isRetiredModelId', () => {
  it('kapatılan 1.x ve 2.0 kuşağını eler, 2.5 ve sonrasını tutar', () => {
    ['gemini-2.0-flash', 'gemini-2.0-flash-001', 'gemini-2.0-flash-lite', 'gemini-1.5-pro']
      .forEach((id) => expect(isRetiredModelId(id)).toBe(true));
    ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest']
      .forEach((id) => expect(isRetiredModelId(id)).toBe(false));
  });
});

describe('sortModelStrings', () => {
  it('Eylül 2026 listesinde en yeni stabil flash başa, preview ve Gemini dışı sona gelir', () => {
    const sorted = sortModelStrings([
      'v1beta:gemini-3.1-pro-preview',
      'v1beta:gemini-2.5-flash',
      'v1beta:gemma-3-27b-it',
      'v1beta:gemini-3.5-flash-lite',
      'v1beta:gemini-3.6-flash',
      'v1beta:gemini-2.5-pro',
      'v1beta:gemini-3.8-flash',
      'v1beta:gemini-flash-latest',
      'v1beta:gemini-3.7-flash',
    ]);
    expect(sorted).toEqual([
      'v1beta:gemini-3.8-flash',
      'v1beta:gemini-3.7-flash',
      'v1beta:gemini-3.6-flash',
      'v1beta:gemini-2.5-flash',
      'v1beta:gemini-flash-latest',
      'v1beta:gemini-3.5-flash-lite',
      'v1beta:gemini-2.5-pro',
      'v1beta:gemini-3.1-pro-preview',
      'v1beta:gemma-3-27b-it',
    ]);
  });
});

describe('pickCandidates', () => {
  it('flash havuzu dolduğunda tarama düşmesin diye ikinci adayı flash-lite yapar', () => {
    const sorted = sortModelStrings([
      'v1beta:gemini-3.8-flash', 'v1beta:gemini-3.7-flash', 'v1beta:gemini-3.6-flash',
      'v1beta:gemini-3.5-flash-lite', 'v1beta:gemini-2.5-pro',
    ]);
    expect(pickCandidates(sorted, 3)).toEqual([
      'v1beta:gemini-3.8-flash', 'v1beta:gemini-3.5-flash-lite', 'v1beta:gemini-3.7-flash',
    ]);
  });

  it('lite yoksa sıralı listeyi, flash yoksa lite ile başlayan listeyi korur', () => {
    expect(pickCandidates(['v:gemini-3.8-flash', 'v:gemini-3.7-flash', 'v:gemini-3.6-flash', 'v:gemini-2.5-pro'], 3))
      .toEqual(['v:gemini-3.8-flash', 'v:gemini-3.7-flash', 'v:gemini-3.6-flash']);
    expect(pickCandidates(['v:gemini-3.5-flash-lite', 'v:gemini-2.5-pro'], 3))
      .toEqual(['v:gemini-3.5-flash-lite', 'v:gemini-2.5-pro']);
  });
});

describe('thinkingVariantsFor', () => {
  it('Gemini 3 için thinkingBudget ve 3.7/3.8 Flash’ın reddettiği minimal göndermez', () => {
    const variants = thinkingVariantsFor('gemini-3.8-flash');
    expect(variants).toEqual([{ thinkingLevel: 'low' }, null]);
    expect(JSON.stringify(variants)).not.toContain('minimal');
    expect(JSON.stringify(variants)).not.toContain('thinkingBudget');
  });

  it('2.5 kuşağında eski davranışı korur, bilinmeyen modelde parametre göndermez', () => {
    expect(thinkingVariantsFor('gemini-2.5-flash')).toEqual([{ thinkingBudget: 0 }, null]);
    expect(thinkingVariantsFor('gemini-flash-latest')).toEqual([null]);
  });
});

describe('ret sınıflandırması', () => {
  it('düşünme parametresine itirazı model uyumsuzluğundan ayırır', () => {
    expect(isThinkingConfigRejection(400, '{"error":{"message":"thinking_budget is not supported"}}')).toBe(true);
    expect(isThinkingConfigRejection(400, '{"error":{"message":"Invalid image"}}')).toBe(false);
    expect(isThinkingConfigRejection(404, 'thinking')).toBe(false);
  });

  it('anahtar/proje reddini model reddinden ayırır', () => {
    expect(isKeyRejection(400, '{"error":{"details":[{"reason":"API_KEY_INVALID"}]}}')).toBe(true);
    expect(isKeyRejection(403, '{"error":{"details":[{"reason":"SERVICE_DISABLED"}]}}')).toBe(true);
    expect(isKeyRejection(401, '')).toBe(true);
    expect(isKeyRejection(403, '{"error":{"message":"model access denied"}}')).toBe(false);
    expect(isKeyRejection(400, '{"error":{"message":"thinking_budget is not supported"}}')).toBe(false);
  });
});
