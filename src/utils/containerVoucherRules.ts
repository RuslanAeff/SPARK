import { toMinorUnits } from './moneyMath';

/** Shared by live purchase matching and untrusted backup validation. */
export function isVoucherDateRangeValid(issued: string, expires: string | null): boolean {
  return expires == null || expires >= issued;
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
