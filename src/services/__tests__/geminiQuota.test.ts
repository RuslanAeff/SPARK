import { classifyQuotaFailure, nextPacificMidnight, parseRetryDelay } from '../geminiQuota';

const quotaBody = (quotaId: string, retryDelay = '43s') => JSON.stringify({
  error: {
    code: 429,
    message: 'You exceeded your current quota, please check your plan and billing details.',
    status: 'RESOURCE_EXHAUSTED',
    details: [
      {
        '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
        violations: [{
          quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests',
          quotaId,
          quotaDimensions: { location: 'global', model: 'gemini-3.7-flash' },
        }],
      },
      { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay },
    ],
  },
});

describe('classifyQuotaFailure', () => {
  it('günlük ve dakikalık sınırı quotaId alanından ayırır', () => {
    expect(classifyQuotaFailure(quotaBody('GenerateRequestsPerDayPerProjectPerModel-FreeTier'))).toBe('daily');
    expect(classifyQuotaFailure(quotaBody('GenerateRequestsPerMinutePerProjectPerModel-FreeTier'))).toBe('minute');
    expect(classifyQuotaFailure(quotaBody('GenerateContentInputTokensPerModelPerMinute-FreeTier'))).toBe('minute');
  });

  it('günlük ve dakikalık ihlal birlikteyse daha uzun olan günlük sayılır', () => {
    const body = JSON.parse(quotaBody('GenerateRequestsPerMinutePerProjectPerModel-FreeTier'));
    body.error.details[0].violations.push({ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' });
    expect(classifyQuotaFailure(JSON.stringify(body))).toBe('daily');
  });

  it('yapılandırılmış alan yoksa gövde metnine bakar, hiçbir ipucu yoksa bilinmiyor der', () => {
    expect(classifyQuotaFailure('quota GenerateRequestsPerDayPerProjectPerModel exceeded')).toBe('daily');
    expect(classifyQuotaFailure('{"error":{"code":429,"message":"Resource exhausted"}}')).toBe('unknown');
  });
});

describe('parseRetryDelay', () => {
  it('RetryInfo süresini milisaniyeye çevirir, kesirli saniyeyi yukarı yuvarlar', () => {
    expect(parseRetryDelay(quotaBody('x', '43s'))).toBe(43_000);
    expect(parseRetryDelay(quotaBody('x', '12.4s'))).toBe(12_400);
    expect(parseRetryDelay('not json')).toBeNull();
    expect(parseRetryDelay('{"error":{}}')).toBeNull();
  });
});

describe('nextPacificMidnight', () => {
  it('yaz saatinde (PDT, UTC-7) sonraki gece yarısını verir: Varşova 09:00', () => {
    // 24 Eylül 2026 12:00 UTC = Pasifik 05:00 → 25 Eylül 00:00 PDT = 07:00 UTC.
    expect(new Date(nextPacificMidnight(Date.UTC(2026, 8, 24, 12))).toISOString()).toBe('2026-09-25T07:00:00.000Z');
  });

  it('kış saatinde (PST, UTC-8) bir saat kayar', () => {
    expect(new Date(nextPacificMidnight(Date.UTC(2026, 11, 10, 12))).toISOString()).toBe('2026-12-11T08:00:00.000Z');
  });

  it('Pasifik gece yarısından hemen önce aynı UTC gününe düşebilir', () => {
    // 24 Eylül 06:30 UTC = Pasifik 23 Eylül 23:30 → yarım saat sonra sıfırlanır.
    expect(new Date(nextPacificMidnight(Date.UTC(2026, 8, 24, 6, 30))).toISOString()).toBe('2026-09-24T07:00:00.000Z');
  });

  it('yaz saatinin bittiği gün (1 Kasım 2026) doğru farkı kullanır', () => {
    // 1 Kasım 12:00 UTC = 04:00 PST (değişim 09:00 UTC'de oldu) → 2 Kasım 00:00 PST.
    expect(new Date(nextPacificMidnight(Date.UTC(2026, 10, 1, 12))).toISOString()).toBe('2026-11-02T08:00:00.000Z');
    // 1 Kasım 06:00 UTC = 31 Ekim 23:00 PDT → 1 Kasım 00:00 PDT = 07:00 UTC.
    expect(new Date(nextPacificMidnight(Date.UTC(2026, 10, 1, 6))).toISOString()).toBe('2026-11-01T07:00:00.000Z');
  });

  it('yaz saatinin başladığı gün (8 Mart 2026) doğru farkı kullanır', () => {
    // 8 Mart 12:00 UTC = 05:00 PDT → 9 Mart 00:00 PDT = 07:00 UTC.
    expect(new Date(nextPacificMidnight(Date.UTC(2026, 2, 8, 12))).toISOString()).toBe('2026-03-09T07:00:00.000Z');
    // 8 Mart 07:30 UTC = 7 Mart 23:30 PST → 8 Mart 00:00 PST = 08:00 UTC.
    expect(new Date(nextPacificMidnight(Date.UTC(2026, 2, 8, 7, 30))).toISOString()).toBe('2026-03-08T08:00:00.000Z');
  });
});
