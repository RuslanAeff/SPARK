import {
  normalizeToYYYYMMDD,
  getStartOfMonth,
  getEndOfMonth,
  getDaysInMonth,
  isToday,
  getToday,
  parseLocalYYYYMMDD,
  formatDateFull,
  formatPeriodRange,
} from '../dateUtils';

describe('parseLocalYYYYMMDD', () => {
  it('kanonik tarihi UTC yerine yerel takvim parçalarıyla oluşturur', () => {
    const parsed = parseLocalYYYYMMDD('2026-01-31');

    expect(parsed).not.toBeNull();
    expect(parsed?.getTime()).toBe(new Date(2026, 0, 31).getTime());
    expect(parsed?.getHours()).toBe(0);
  });

  it('geçersiz veya kanonik olmayan tarihleri başka güne taşımaz', () => {
    expect(parseLocalYYYYMMDD('2026-02-29')).toBeNull();
    expect(parseLocalYYYYMMDD('2026-13-01')).toBeNull();
    expect(parseLocalYYYYMMDD('31.01.2026')).toBeNull();
  });

  it('kanonik tarihi yerel gün kayması olmadan biçimlendirir', () => {
    const t = (key: string) => key;
    expect(formatDateFull('2026-01-31', t)).toBe('31 month_01 2026');
  });
});

describe('formatPeriodRange', () => {
  const t = (key: string) => ({
    month_short_01: 'Oca',
    month_short_08: 'Ağu',
    month_short_09: 'Eyl',
    month_short_12: 'Ara',
  })[key] ?? key;

  it('aynı yıl içindeki iki ayı tek yıl bilgisiyle gösterir', () => {
    expect(formatPeriodRange('2026-08-22', '2026-09-21', t))
      .toBe('22 Ağu – 21 Eyl 2026');
  });

  it('aynı ay içindeki tekrar eden ay adını sıkıştırır', () => {
    expect(formatPeriodRange('2026-08-01', '2026-08-31', t))
      .toBe('1–31 Ağu 2026');
  });

  it('yıl değişiminde iki yılı da açıkça gösterir', () => {
    expect(formatPeriodRange('2026-12-22', '2027-01-21', t))
      .toBe('22 Ara 2026 – 21 Oca 2027');
  });

  it('geçersiz aralıkta bozuk tarih metni üretmez', () => {
    expect(formatPeriodRange('geçersiz', '2026-09-21', t)).toBe('');
  });
});

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
    expect(normalizeToYYYYMMDD('2026-02-29')).toBe(getToday());
    expect(normalizeToYYYYMMDD('31.02.2026')).toBe(getToday());
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
