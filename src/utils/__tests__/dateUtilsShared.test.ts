import {
  daysBetweenLocal,
  localYmdFromEpoch,
  parseLocalYmdAtNoon,
  splitYmd,
  toLocalYmd,
} from '../dateUtils';

// CQ-04: kopyaları birleştirilen tarih yardımcıları.
describe('shared date helpers', () => {
  it('round-trips local calendar days without UTC shifts', () => {
    for (const ymd of ['2026-01-01', '2026-02-28', '2028-02-29', '2026-03-29', '2026-10-25', '2026-12-31']) {
      expect(toLocalYmd(parseLocalYmdAtNoon(ymd))).toBe(ymd);
    }
    expect(parseLocalYmdAtNoon('2026-11-16').getHours()).toBe(12);
  });

  it('splits YYYY-MM-DD into numbers', () => {
    expect(splitYmd('2026-03-07')).toEqual([2026, 3, 7]);
  });

  it('counts signed whole days across month, year and DST boundaries', () => {
    expect(daysBetweenLocal('2026-03-28', '2026-03-30')).toBe(2); // Avrupa yaz saati geçişi
    expect(daysBetweenLocal('2026-10-24', '2026-10-26')).toBe(2); // kış saati geçişi
    expect(daysBetweenLocal('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetweenLocal('2026-03-01', '2026-02-28')).toBe(-1);
  });

  it('formats an epoch as the local day and rejects invalid input', () => {
    const noon = new Date(2026, 10, 16, 12).getTime();
    expect(localYmdFromEpoch(noon)).toBe('2026-11-16');
    expect(localYmdFromEpoch(new Date(2026, 10, 16, 23, 59).getTime())).toBe('2026-11-16');
    expect(localYmdFromEpoch(Number.NaN)).toBeNull();
    expect(localYmdFromEpoch(Number.POSITIVE_INFINITY)).toBeNull();
  });
});
