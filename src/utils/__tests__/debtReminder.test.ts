import {
  getDebtDueState,
  isValidDebtReminderTime,
  parseDebtReminderDays,
} from '../debtReminder';

describe('debt reminder presentation and form rules', () => {
  it('classifies date-only due states without Date/timezone arithmetic', () => {
    expect(getDebtDueState(null, '2026-08-11')).toBe('none');
    expect(getDebtDueState('2026-08-10', '2026-08-11')).toBe('overdue');
    expect(getDebtDueState('2026-08-11', '2026-08-11')).toBe('today');
    expect(getDebtDueState('2026-08-12', '2026-08-11')).toBe('upcoming');
    expect(getDebtDueState('2026-02-30', '2026-08-11')).toBe('none');
  });

  it.each([
    ['0', 0],
    ['1', 1],
    ['365', 365],
    [' 7 ', 7],
  ])('accepts a valid lead day value %s', (value, expected) => {
    expect(parseDebtReminderDays(value)).toBe(expected);
  });

  it.each(['', '-1', '1.5', '366', 'abc', '0000'])('rejects invalid lead days %s', (value) => {
    expect(parseDebtReminderDays(value)).toBeNull();
  });

  it.each(['00:00', '09:05', '23:59'])('accepts valid local time %s', (value) => {
    expect(isValidDebtReminderTime(value)).toBe(true);
  });

  it.each(['9:05', '24:00', '23:60', '09.05', ''])('rejects invalid local time %s', (value) => {
    expect(isValidDebtReminderTime(value)).toBe(false);
  });
});

