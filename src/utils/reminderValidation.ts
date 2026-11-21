// S.P.A.R.K. — Hatırlatma alanı doğrulayıcıları (UI denetimi CQ-07)
//
// Bildirim kuralları, yerel zamanlayıcı ve iki DAO aynı "SS:dd" desenini ve
// aynı alan doğrulayıcılarını ayrı ayrı tanımlıyordu; birinde yapılan düzeltme
// diğerlerine ulaşmıyordu. Tek kaynak burasıdır.

/** 24 saatlik "SS:dd" (00:00–23:59). */
export const HH_MM_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

/** Düzenli ödeme tekrar birimleri. */
export const SUPPORTED_RECURRENCE_UNITS: ReadonlySet<string> = new Set(['day', 'week', 'month', 'year']);

/** Kaç gün önce hatırlatılacağı: 0–365 arası tam sayı. */
export function isValidLeadDays(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 365;
}

export function isValidReminderTime(value: unknown): value is string {
  return typeof value === 'string' && HH_MM_PATTERN.test(value);
}

/** Boş olmayan, en çok 10 karakter, baş/son boşluksuz para birimi kodu. */
export function isValidCurrency(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 10
    && value.trim() === value;
}
