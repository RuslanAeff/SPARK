import { isSupportedYmd } from './inputValidation';
import { toMinorUnits } from './moneyMath';

/** Shared by live purchase matching and untrusted backup validation. */
export function isVoucherDateRangeValid(issued: string, expires: string | null): boolean {
  return expires == null || expires >= issued;
}

/**
 * Alışveriş fişindeki AI çıktısı kupon son kullanma tarihi isteğe bağlı bir
 * ipucudur: biçimi veya aralığı yedek sözleşmesine uymuyorsa fişi reddetmek
 * yerine tarih bilinmiyor (NULL) kabul edilir. Aksi hâlde bozuk değer kalıcı
 * olur ve sonraki tüm yedekleri geri yüklenemez yapar (BUG-04, BUG-19).
 */
export function sanitizePurchaseVoucherExpiry(issued: string, expires: unknown): string | null {
  if (!isSupportedYmd(expires)) return null;
  return isVoucherDateRangeValid(issued, expires) ? expires : null;
}

export function matchesVoucherRedemption(
  voucher: { amount: number; currency: string; issued_date: string; expires_on: string | null },
  recovery: { amount: number; currency: string; date: string },
): boolean {
  return toMinorUnits(voucher.amount) === toMinorUnits(recovery.amount)
    && voucher.currency === recovery.currency
    && voucher.issued_date <= recovery.date
    && (voucher.expires_on == null || recovery.date <= voucher.expires_on);
}
