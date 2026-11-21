// CQ-07: Hatırlatma doğrulayıcıları tek kaynaktan; sınır değerleri sabitlenir.
import {
  HH_MM_PATTERN,
  SUPPORTED_RECURRENCE_UNITS,
  isValidCurrency,
  isValidLeadDays,
  isValidReminderTime,
} from '../reminderValidation';
import { parseAmountInputOrZero } from '../moneyMath';

describe('reminderValidation', () => {
  it('accepts lead days 0..365 integers only', () => {
    expect([0, 1, 365].every(isValidLeadDays)).toBe(true);
    expect([-1, 366, 1.5, '3', null, NaN].some(isValidLeadDays)).toBe(false);
  });

  it('accepts 24h HH:mm only', () => {
    expect(['00:00', '09:30', '23:59'].every(isValidReminderTime)).toBe(true);
    expect(['24:00', '9:30', '12:60', '12:00 ', 930].some(isValidReminderTime)).toBe(false);
    expect(HH_MM_PATTERN.test('07:05')).toBe(true);
  });

  it('accepts trimmed, non-empty currency codes up to 10 chars', () => {
    expect(['PLN', 'TRY', 'ABCDEFGHIJ'].every(isValidCurrency)).toBe(true);
    expect(['', ' PLN', 'PLN ', 'ABCDEFGHIJK', 5].some(isValidCurrency)).toBe(false);
  });

  it('knows the recurrence units', () => {
    expect([...SUPPORTED_RECURRENCE_UNITS].sort()).toEqual(['day', 'month', 'week', 'year']);
  });
});

describe('parseAmountInputOrZero', () => {
  it('returns the parsed amount or 0 for ambiguous input', () => {
    expect(parseAmountInputOrZero('12,50')).toBe(12.5);
    expect(parseAmountInputOrZero('1.500')).toBe(0);
    expect(parseAmountInputOrZero('abc')).toBe(0);
  });
});
