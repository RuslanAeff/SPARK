import { formatLocalClock, presentAiError } from '../aiErrorPresentation';
import { GeminiServiceError } from '../../services/geminiErrors';

describe('presentAiError', () => {
  it('anahtar sorunlarında birincil eylemi Ayarlar yapar', () => {
    expect(presentAiError(new GeminiServiceError('AI_KEY_REJECTED'))).toEqual({
      messageKey: 'ai_error_key_rejected', action: 'settings',
    });
    expect(presentAiError(new GeminiServiceError('AI_NO_KEY'))?.action).toBe('settings');
  });

  it('kota bekleme süresini mesaja taşır; süre yoksa genel kota mesajı kullanılır', () => {
    expect(presentAiError(new GeminiServiceError('AI_QUOTA', { retryAfterSec: 42.2 }))).toEqual({
      messageKey: 'ai_error_quota_wait', params: { seconds: '43' }, action: 'retry',
    });
    expect(presentAiError(new GeminiServiceError('AI_QUOTA'))?.messageKey).toBe('ai_error_quota');
  });

  it('günlük kotada saniye yerine kotanın yerel saatle yenilenme saatini gösterir', () => {
    const resetsAt = Date.UTC(2026, 8, 25, 7);
    expect(presentAiError(new GeminiServiceError('AI_QUOTA_DAILY', { resetsAt }))).toEqual({
      messageKey: 'ai_error_quota_daily', params: { time: formatLocalClock(resetsAt) }, action: 'retry',
    });
    expect(formatLocalClock(resetsAt)).toMatch(/^\d{2}:\d{2}$/);
    expect(presentAiError(new GeminiServiceError('AI_QUOTA_DAILY'))?.messageKey).toBe('ai_error_quota');
  });

  it('mevcut fiş sözleşmesini ve servis mock edilmiş düz Error kodlarını da tanır', () => {
    expect(presentAiError(new Error('RECEIPT_INVALID_RESULT'))?.messageKey).toBe('scan_invalid_result');
    expect(presentAiError(new Error('AI_NETWORK'))).toEqual({ messageKey: 'ai_error_network', action: 'retry' });
  });

  it('tanınmayan hatada null döner; çağıran genel mesajını kullanır', () => {
    expect(presentAiError(new Error('boom'))).toBeNull();
    expect(presentAiError('AI_QUOTA')).toBeNull();
    expect(presentAiError(new Error('toString'))).toBeNull();
  });
});
