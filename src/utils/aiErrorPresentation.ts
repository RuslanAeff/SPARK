// S.P.A.R.K. — Gemini hata kodunu kullanıcıya dönük mesaj ve eyleme çevirir.
//
// Servis modülü bilinçli olarak içe aktarılmaz (yalnız tip): ekran testleri
// servisi mock'larken de bu eşleme gerçek hâliyle çalışır. Kod `error.message`
// üzerinden okunur; `retryAfterSec` varsa kota mesajına, `resetsAt` varsa günlük
// kotanın yerel saatle açılış zamanı olarak mesaja eklenir.
import type { GeminiErrorCode } from '../services/geminiErrors';

export interface AiErrorPresentation {
  messageKey: string;
  params?: Record<string, string>;
  /** Birincil eylem: anahtar sorunlarında Ayarlar, diğerlerinde tekrar deneme. */
  action: 'settings' | 'retry';
}

/** Cihazın yerel saatiyle 24 saatlik "09:00" (dile göre değişmeyen biçim). */
export function formatLocalClock(epochMs: number): string {
  const date = new Date(epochMs);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

const MESSAGE_KEYS: Record<Exclude<GeminiErrorCode, 'AI_QUOTA' | 'AI_QUOTA_DAILY'>, string> = {
  AI_NO_KEY: 'no_api_key_msg',
  AI_KEY_REJECTED: 'ai_error_key_rejected',
  AI_MODEL_UNAVAILABLE: 'ai_error_model_unavailable',
  AI_SERVER_BUSY: 'ai_error_busy',
  AI_NETWORK: 'ai_error_network',
  AI_TIMEOUT: 'ai_error_timeout',
  AI_RESPONSE_TRUNCATED: 'ai_error_truncated',
  AI_INVALID_RESPONSE: 'ai_error_invalid_response',
  RECEIPT_INVALID_RESULT: 'scan_invalid_result',
};

/** Tanınmayan hata için null döner; çağıran kendi genel mesajını kullanır. */
export function presentAiError(error: unknown): AiErrorPresentation | null {
  const code = error instanceof Error ? error.message : '';
  if (code === 'AI_QUOTA') {
    const seconds = (error as { retryAfterSec?: unknown }).retryAfterSec;
    return typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0
      ? { messageKey: 'ai_error_quota_wait', params: { seconds: String(Math.ceil(seconds)) }, action: 'retry' }
      : { messageKey: 'ai_error_quota', action: 'retry' };
  }
  if (code === 'AI_QUOTA_DAILY') {
    // Günlük kotada "N sn sonra dene" yanıltıcıdır; yenilenme saati söylenir.
    const resetsAt = (error as { resetsAt?: unknown }).resetsAt;
    return typeof resetsAt === 'number' && Number.isFinite(resetsAt)
      ? { messageKey: 'ai_error_quota_daily', params: { time: formatLocalClock(resetsAt) }, action: 'retry' }
      : { messageKey: 'ai_error_quota', action: 'retry' };
  }
  if (!Object.prototype.hasOwnProperty.call(MESSAGE_KEYS, code)) return null;
  const messageKey = MESSAGE_KEYS[code as keyof typeof MESSAGE_KEYS];
  const action = code === 'AI_NO_KEY' || code === 'AI_KEY_REJECTED' ? 'settings' : 'retry';
  return { messageKey, action };
}
