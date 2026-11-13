import { isReceiptDateTooFarAhead, latestAllowedReceiptDate, MAX_RECEIPT_FUTURE_DAYS } from '../receiptDateRules';

describe('receipt future date limit (BUG-17)', () => {
  it('allows up to two days ahead and rejects anything later', () => {
    expect(MAX_RECEIPT_FUTURE_DAYS).toBe(2);
    expect(latestAllowedReceiptDate('2026-12-30')).toBe('2027-01-01');
    expect(isReceiptDateTooFarAhead('2026-11-14', '2026-11-12')).toBe(false);
    expect(isReceiptDateTooFarAhead('2026-11-15', '2026-11-12')).toBe(true);
    expect(isReceiptDateTooFarAhead('2062-11-12', '2026-11-12')).toBe(true);
    expect(isReceiptDateTooFarAhead('2026-01-01', '2026-11-12')).toBe(false);
  });
});
