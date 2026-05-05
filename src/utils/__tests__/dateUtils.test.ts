import {
  normalizeToYYYYMMDD,
  getStartOfMonth,
  getEndOfMonth,
  getDaysInMonth,
  isToday,
  getToday,
} from '../dateUtils';

describe('normalizeToYYYYMMDD', () => {
  it('zaten YYYY-MM-DD ise olduğu gibi döner', () => {
    expect(normalizeToYYYYMMDD('2026-05-15')).toBe('2026-05-15');
  });

  it('DD.MM.YYYY formatını çevirir', () => {
    expect(normalizeToYYYYMMDD('15.05.2026')).toBe('2026-05-15');
  });

  it('DD/MM/YYYY formatını çevirir', () => {
    expect(normalizeToYYYYMMDD('5/3/2026')).toBe('2026-03-05');
  });

  it('boş/geçersiz girdi bugüne fallback', () => {
    expect(normalizeToYYYYMMDD('')).toBe(getToday());
    expect(normalizeToYYYYMMDD('abc')).toBe(getToday());
  });
});

describe('ay yardımcıları', () => {
  it('getStartOfMonth ayın 1. günü', () => {
    const d = new Date(2026, 4, 15); // 15 Mayıs 2026
    expect(getStartOfMonth(d)).toBe('2026-05-01');
  });

  it('getEndOfMonth yerel saat dilimine duyarlı (timezone bug fix)', () => {
    expect(getEndOfMonth(new Date(2026, 1, 1))).toBe('2026-02-28'); // Şubat normal
    expect(getEndOfMonth(new Date(2024, 1, 1))).toBe('2024-02-29'); // Şubat artık
    expect(getEndOfMonth(new Date(2026, 3, 1))).toBe('2026-04-30'); // Nisan
    expect(getEndOfMonth(new Date(2026, 11, 1))).toBe('2026-12-31'); // Aralık
  });

  it('getDaysInMonth ay uzunluğu (artık yıl Şubat dahil)', () => {
    expect(getDaysInMonth(new Date(2026, 0, 1))).toBe(31); // Ocak
    expect(getDaysInMonth(new Date(2026, 1, 1))).toBe(28); // Şubat 2026 normal
    expect(getDaysInMonth(new Date(2024, 1, 1))).toBe(29); // Şubat 2024 artık
  });
});

describe('isToday', () => {
  it('bugünün tarihi true', () => {
    expect(isToday(getToday())).toBe(true);
  });

  it('başka tarih false', () => {
    expect(isToday('2020-01-01')).toBe(false);
  });
});
