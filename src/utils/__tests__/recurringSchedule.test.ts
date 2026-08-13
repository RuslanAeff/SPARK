import {
  getCalendarDayOffset,
  getNextOccurrence,
  isRecurringOccurrence,
  isValidYmd,
  shiftCalendarDate,
  type RecurrenceUnit,
  type RecurringSchedule,
} from '../recurringSchedule';

const recurring = (
  unit: RecurrenceUnit,
  interval: number,
  anchorDate: string,
): RecurringSchedule => ({ kind: 'recurring', unit, interval, anchorDate });

describe('recurringSchedule — aylık özgün-anchor ve ay-sonu clamp', () => {
  it('31 anchorını normal ve artık yıl Şubat aylarının sonuna çeker', () => {
    expect(getNextOccurrence(
      recurring('month', 1, '2026-01-31'),
      '2026-02-01',
      'on_or_after',
    )).toBe('2026-02-28');
    expect(getNextOccurrence(
      recurring('month', 1, '2024-01-31'),
      '2024-02-01',
      'on_or_after',
    )).toBe('2024-02-29');
  });

  it('clamp edilmiş günden sonra özgün 31 anchorına geri döner', () => {
    const schedule = recurring('month', 1, '2026-01-31');
    expect(getNextOccurrence(schedule, '2026-02-28', 'on_or_after'))
      .toBe('2026-02-28');
    expect(getNextOccurrence(schedule, '2026-02-28', 'strictly_after'))
      .toBe('2026-03-31');
    expect(getNextOccurrence(schedule, '2026-04-30', 'on_or_after'))
      .toBe('2026-04-30');
    expect(getNextOccurrence(schedule, '2026-04-30', 'strictly_after'))
      .toBe('2026-05-31');
  });

  it('28–30 anchorlarını ay ve yıl sınırlarında doğru ilerletir', () => {
    expect(getNextOccurrence(
      recurring('month', 1, '2026-01-28'),
      '2026-02-28',
      'strictly_after',
    )).toBe('2026-03-28');
    expect(getNextOccurrence(
      recurring('month', 1, '2026-11-30'),
      '2026-12-31',
      'on_or_after',
    )).toBe('2027-01-30');
  });

  it('iki ve üç aylık interval adımlarını anchor ayından sayar', () => {
    const everyTwoMonths = recurring('month', 2, '2026-01-31');
    expect(getNextOccurrence(everyTwoMonths, '2026-02-01', 'on_or_after'))
      .toBe('2026-03-31');
    expect(getNextOccurrence(everyTwoMonths, '2026-03-31', 'strictly_after'))
      .toBe('2026-05-31');

    const everyThreeMonths = recurring('month', 3, '2025-11-30');
    expect(getNextOccurrence(everyThreeMonths, '2026-02-01', 'on_or_after'))
      .toBe('2026-02-28');
    expect(getNextOccurrence(everyThreeMonths, '2026-02-28', 'strictly_after'))
      .toBe('2026-05-30');
  });
});

describe('recurringSchedule — yıllık özgün-anchor ve artık yıl', () => {
  const annualLeapDay = recurring('year', 1, '2020-02-29');

  it('29 Şubatı normal yılda 28e, artık yılda 29a çeker', () => {
    expect(getNextOccurrence(annualLeapDay, '2023-02-01', 'on_or_after'))
      .toBe('2023-02-28');
    expect(getNextOccurrence(annualLeapDay, '2024-02-01', 'on_or_after'))
      .toBe('2024-02-29');
  });

  it('clamp edilmiş yıllardan sonra özgün 29 Şubat anchorını korur', () => {
    expect(getNextOccurrence(annualLeapDay, '2023-02-28', 'strictly_after'))
      .toBe('2024-02-29');
    expect(getNextOccurrence(annualLeapDay, '2024-02-29', 'strictly_after'))
      .toBe('2025-02-28');
  });

  it('Gregoryen 400/100 artık-yıl kuralını korur', () => {
    const centuryAnchor = recurring('year', 1, '2000-02-29');
    expect(getNextOccurrence(centuryAnchor, '2000-02-01', 'on_or_after'))
      .toBe('2000-02-29');
    expect(getNextOccurrence(centuryAnchor, '2100-02-01', 'on_or_after'))
      .toBe('2100-02-28');
  });

  it('iki ve üç yıllık intervali anchor yılından sayar', () => {
    const everyTwoYears = recurring('year', 2, '2024-02-29');
    expect(getNextOccurrence(everyTwoYears, '2025-01-01', 'on_or_after'))
      .toBe('2026-02-28');
    expect(getNextOccurrence(everyTwoYears, '2026-02-28', 'strictly_after'))
      .toBe('2028-02-29');

    const everyThreeYears = recurring('year', 3, '2024-02-29');
    expect(getNextOccurrence(everyThreeYears, '2026-12-31', 'on_or_after'))
      .toBe('2027-02-28');
    expect(getNextOccurrence(everyThreeYears, '2027-02-28', 'strictly_after'))
      .toBe('2030-02-28');
  });
});

describe('recurringSchedule — günlük ve haftalık Gregoryen ilerleme', () => {
  it('günlük tekrar normal ve artık yıl ay sınırlarını Date kullanmadan aşar', () => {
    const daily = recurring('day', 1, '2026-02-27');
    expect(getNextOccurrence(daily, '2026-02-28', 'on_or_after'))
      .toBe('2026-02-28');
    expect(getNextOccurrence(daily, '2026-02-28', 'strictly_after'))
      .toBe('2026-03-01');

    expect(getNextOccurrence(
      recurring('day', 2, '2024-02-28'),
      '2024-02-29',
      'on_or_after',
    )).toBe('2024-03-01');
  });

  it('iki haftalık intervali anchor gününden ve yıl sınırından sayar', () => {
    const everyTwoWeeks = recurring('week', 2, '2025-12-18');
    expect(getNextOccurrence(everyTwoWeeks, '2026-01-01', 'on_or_after'))
      .toBe('2026-01-01');
    expect(getNextOccurrence(everyTwoWeeks, '2026-01-01', 'strictly_after'))
      .toBe('2026-01-15');
    expect(getNextOccurrence(everyTwoWeeks, '2026-01-16', 'on_or_after'))
      .toBe('2026-01-29');
  });

  it('2100 yılının artık olmadığını günlük ilerlemede de korur', () => {
    expect(getNextOccurrence(
      recurring('day', 1, '2100-02-28'),
      '2100-02-28',
      'strictly_after',
    )).toBe('2100-03-01');
  });
});

describe('recurringSchedule — anchor ve referans sınırı', () => {
  it.each<RecurrenceUnit>(['day', 'week', 'month', 'year'])(
    '%s tekrarı referans anchor öncesindeyken anchor tarihini döndürür',
    (unit) => {
      const schedule = recurring(unit, 3, '2026-08-15');
      expect(getNextOccurrence(schedule, '2020-01-01', 'on_or_after'))
        .toBe('2026-08-15');
      expect(getNextOccurrence(schedule, '2020-01-01', 'strictly_after'))
        .toBe('2026-08-15');
    },
  );

  it('anchor gününü on_or_after dahil, strictly_after hariç tutar', () => {
    const daily = recurring('day', 1, '2026-08-15');
    expect(getNextOccurrence(daily, '2026-08-15', 'on_or_after'))
      .toBe('2026-08-15');
    expect(getNextOccurrence(daily, '2026-08-15', 'strictly_after'))
      .toBe('2026-08-16');
  });
});

describe('recurringSchedule — occurrence üyeliği', () => {
  it('ay sonu clamp edilen gerçek oluşumu kabul edip aradaki günü reddeder', () => {
    expect(isRecurringOccurrence('month', 1, '2026-01-31', '2026-02-28')).toBe(true);
    expect(isRecurringOccurrence('month', 1, '2026-01-31', '2026-02-27')).toBe(false);
  });

  it('interval anchorından çıkmayan tarihi reddeder', () => {
    expect(isRecurringOccurrence('month', 2, '2026-01-15', '2026-03-15')).toBe(true);
    expect(isRecurringOccurrence('month', 2, '2026-01-15', '2026-02-15')).toBe(false);
  });
});

describe('recurringSchedule — tek seferlik son tarih', () => {
  const once: RecurringSchedule = { kind: 'one_time', dueDate: '2026-08-15' };

  it('gelecekteki tarihi ve on-reference semantiğini döndürür', () => {
    expect(getNextOccurrence(once, '2026-08-10', 'strictly_after'))
      .toBe('2026-08-15');
    expect(getNextOccurrence(once, '2026-08-15', 'on_or_after'))
      .toBe('2026-08-15');
  });

  it('referans günü strict modda veya geçmişte tüketilmişse null döner', () => {
    expect(getNextOccurrence(once, '2026-08-15', 'strictly_after')).toBeNull();
    expect(getNextOccurrence(once, '2026-08-16', 'on_or_after')).toBeNull();
  });
});

describe('recurringSchedule — timezone bağımsızlığı ve doğrulama', () => {
  it('takvim tarihini DST ve ay/yıl sınırlarından bağımsız kaydırır', () => {
    expect(shiftCalendarDate('2024-02-28', 2)).toBe('2024-03-01');
    expect(shiftCalendarDate('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftCalendarDate('2026-08-11', 400)).toBe('2027-09-15');
  });

  it('geçersiz ofsetleri ve desteklenen takvim aralığı dışını reddeder', () => {
    expect(shiftCalendarDate('2026-02-30', 1)).toBeNull();
    expect(shiftCalendarDate('2026-01-01', 1.5)).toBeNull();
    expect(shiftCalendarDate('0001-01-01', -1)).toBeNull();
    expect(shiftCalendarDate('9999-12-31', 1)).toBeNull();
  });

  it('takvim günü ofsetini ay/yıl sınırlarında Date kullanmadan hesaplar', () => {
    expect(getCalendarDayOffset('2024-02-28', '2024-03-01')).toBe(2);
    expect(getCalendarDayOffset('2026-12-31', '2027-01-01')).toBe(1);
    expect(getCalendarDayOffset('2026-08-11', '2026-08-11')).toBe(0);
    expect(getCalendarDayOffset('2026-08-11', '2026-08-08')).toBe(-3);
  });

  it('takvim günü ofsetinde geçersiz girdileri fail-closed reddeder', () => {
    expect(getCalendarDayOffset('2026-02-30', '2026-03-01')).toBeNull();
    expect(getCalendarDayOffset('2026-02-28', '2026/03/01')).toBeNull();
    expect(getCalendarDayOffset(null, '2026-03-01')).toBeNull();
  });

  it('Europe/Warsaw veya zıt UTC ofsetlerinde aynı YYYY-MM-DD sonucunu üretir', () => {
    const originalTimezone = process.env.TZ;
    const schedule = recurring('month', 1, '2026-01-31');
    try {
      process.env.TZ = 'Europe/Warsaw';
      const warsaw = getNextOccurrence(schedule, '2026-03-31', 'strictly_after');
      process.env.TZ = 'Pacific/Kiritimati';
      const farEast = getNextOccurrence(schedule, '2026-03-31', 'strictly_after');
      process.env.TZ = 'America/Los_Angeles';
      const farWest = getNextOccurrence(schedule, '2026-03-31', 'strictly_after');

      expect(warsaw).toBe('2026-04-30');
      expect(farEast).toBe(warsaw);
      expect(farWest).toBe(warsaw);
    } finally {
      if (originalTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimezone;
    }
  });

  it('yalnız gerçek ve kanonik YYYY-MM-DD değerlerini kabul eder', () => {
    expect(isValidYmd('2024-02-29')).toBe(true);
    expect(isValidYmd('2023-02-29')).toBe(false);
    expect(isValidYmd('2026-04-31')).toBe(false);
    expect(isValidYmd('2026-2-01')).toBe(false);
    expect(isValidYmd('0000-01-01')).toBe(false);
  });

  it.each([
    [{ kind: 'recurring', unit: 'day', interval: 0, anchorDate: '2026-01-01' }],
    [{ kind: 'recurring', unit: 'week', interval: -1, anchorDate: '2026-01-01' }],
    [{ kind: 'recurring', unit: 'month', interval: 1.5, anchorDate: '2026-01-01' }],
    [{ kind: 'recurring', unit: 'year', interval: Number.POSITIVE_INFINITY, anchorDate: '2026-01-01' }],
    [{ kind: 'recurring', unit: 'year', interval: 1, anchorDate: '2026-02-30' }],
    [{ kind: 'recurring', unit: 'quarter', interval: 1, anchorDate: '2026-01-01' }],
    [{ kind: 'one_time', dueDate: '2026-02-30' }],
    [{ kind: 'unknown' }],
  ])('geçersiz programı null ile reddeder: %j', (schedule) => {
    expect(getNextOccurrence(
      schedule as unknown as RecurringSchedule,
      '2026-01-01',
      'on_or_after',
    )).toBeNull();
  });

  it('geçersiz referans veya boundary değerini null ile reddeder', () => {
    const monthly = recurring('month', 1, '2026-01-15');
    expect(getNextOccurrence(monthly, '2026-02-30', 'on_or_after')).toBeNull();
    expect(getNextOccurrence(monthly, '2026/02/20', 'on_or_after')).toBeNull();
    expect(getNextOccurrence(
      monthly,
      '2026-02-20',
      'inclusive' as unknown as 'on_or_after',
    )).toBeNull();
  });

  it.each<RecurrenceUnit>(['day', 'week', 'month', 'year'])(
    '9999 sınırından sonraki %s oluşumu için null döner',
    (unit) => {
      expect(getNextOccurrence(
        recurring(unit, 1, '9999-12-31'),
        '9999-12-31',
        'strictly_after',
      )).toBeNull();
    },
  );
});
