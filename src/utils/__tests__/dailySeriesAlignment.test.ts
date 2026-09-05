import {
  alignPreviousDailySeries,
  buildZeroFilledDailySeries,
} from '../dailySeriesAlignment';

describe('buildZeroFilledDailySeries', () => {
  it('harcamasız günleri 0 ile doldurur', () => {
    const series = buildZeroFilledDailySeries('2026-08-22', '2026-08-25', [
      { date: '2026-08-23', total: 40 },
    ]);

    expect(series).toEqual([
      { date: '2026-08-22', total: 0 },
      { date: '2026-08-23', total: 40 },
      { date: '2026-08-24', total: 0 },
      { date: '2026-08-25', total: 0 },
    ]);
  });

  it('ay sınırını ve geçersiz aralığı güvenle işler', () => {
    expect(buildZeroFilledDailySeries('2026-08-31', '2026-09-01', []).map(d => d.date))
      .toEqual(['2026-08-31', '2026-09-01']);
    expect(buildZeroFilledDailySeries('2026-09-02', '2026-09-01', [])).toEqual([]);
    expect(buildZeroFilledDailySeries('bozuk', '2026-09-01', [])).toEqual([]);
  });
});

describe('alignPreviousDailySeries', () => {
  const previousRange = { start: '2026-07-22', end: '2026-08-21' }; // 31 gün

  it('ham önceki dönemi geçerli seriyle aynı uzunluğa getirir', () => {
    const aligned = alignPreviousDailySeries(31, previousRange, [
      { date: '2026-07-22', total: 128 },
      { date: '2026-08-21', total: 12 },
    ]);

    expect(aligned).toHaveLength(31);
    expect(aligned[0]).toEqual({ date: '2026-07-22', total: 128 });
    expect(aligned[30]).toEqual({ date: '2026-08-21', total: 12 });
    expect(aligned[1].total).toBe(0);
  });

  it('önceki dönem daha uzunsa fazlasını atar, kısaysa 0 ile tamamlar', () => {
    expect(alignPreviousDailySeries(28, previousRange, [])).toHaveLength(28);

    const shortRange = { start: '2026-02-01', end: '2026-02-28' }; // 28 gün
    const padded = alignPreviousDailySeries(31, shortRange, [
      { date: '2026-02-28', total: 9 },
    ]);
    expect(padded).toHaveLength(31);
    expect(padded[27]).toEqual({ date: '2026-02-28', total: 9 });
    expect(padded.slice(28).every(d => d.total === 0)).toBe(true);
  });

  it('önceki dönem yoksa boş döner', () => {
    expect(alignPreviousDailySeries(31, null, [])).toEqual([]);
    expect(alignPreviousDailySeries(0, previousRange, [])).toEqual([]);
  });
});
