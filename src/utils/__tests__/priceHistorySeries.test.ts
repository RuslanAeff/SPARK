import {
  buildAdaptivePriceHistorySeries,
  type PriceHistoryObservation,
} from '../priceHistorySeries';

const point = (
  index: number,
  price: number,
  vendor = 'Market A',
): PriceHistoryObservation => ({
  date: `2026-${String(Math.floor(index / 28) + 1).padStart(2, '0')}-${String((index % 28) + 1).padStart(2, '0')}`,
  unit_price: price,
  vendor_name: vendor,
});

describe('buildAdaptivePriceHistorySeries', () => {
  it('keeps a short, non-redundant history unchanged', () => {
    const history = [point(0, 5.99), point(1, 6.49), point(2, 6.99)];

    const result = buildAdaptivePriceHistorySeries(history);

    expect(result).toEqual({
      points: [
        { label: '01/01', value: 5.99, meta: 'Market A', sourceIndex: 0, position: 0 },
        { label: '02/01', value: 6.49, meta: 'Market A', sourceIndex: 1, position: 1 },
        { label: '03/01', value: 6.99, meta: 'Market A', sourceIndex: 2, position: 2 },
      ],
      sourceCount: 3,
      displayedCount: 3,
      simplified: false,
    });
  });

  it('compresses a long identical price and vendor run to its first and last observations', () => {
    const history = Array.from({ length: 20 }, (_, index) => point(index, 6.99));

    const result = buildAdaptivePriceHistorySeries(history);

    expect(result.points.map((entry) => entry.sourceIndex)).toEqual([0, 19]);
    expect(result.points.map((entry) => entry.value)).toEqual([6.99, 6.99]);
    expect(result).toMatchObject({
      sourceCount: 20,
      displayedCount: 2,
      simplified: true,
    });
  });

  it('does not merge equal observations that are non-consecutive or belong to different vendors', () => {
    const history = [
      point(0, 10, 'Store A'),
      point(1, 11, 'Store A'),
      point(2, 10, 'Store A'),
      point(3, 10, 'Store B'),
    ];

    const result = buildAdaptivePriceHistorySeries(history);

    expect(result.points.map((entry) => entry.sourceIndex)).toEqual([0, 1, 2, 3]);
    expect(result.simplified).toBe(false);
  });

  it('preserves source boundaries and bucket extrema without exceeding the cap', () => {
    const history = Array.from({ length: 80 }, (_, index) => point(index, 50 + (index % 9)));
    history[17] = point(17, 125);
    history[63] = point(63, 2);

    const result = buildAdaptivePriceHistorySeries(history, { maxPoints: 10 });
    const sourceIndexes = result.points.map((entry) => entry.sourceIndex);

    expect(result.displayedCount).toBeLessThanOrEqual(10);
    expect(sourceIndexes[0]).toBe(0);
    expect(sourceIndexes[sourceIndexes.length - 1]).toBe(79);
    expect(sourceIndexes).toContain(17);
    expect(sourceIndexes).toContain(63);
    expect(sourceIndexes).toEqual([...sourceIndexes].sort((a, b) => a - b));
    expect(result.points.every((entry) => entry.value === history[entry.sourceIndex].unit_price)).toBe(true);
    expect(result.simplified).toBe(true);
  });

  it('is deterministic for the same source series and point budget', () => {
    const history = Array.from(
      { length: 101 },
      (_, index) => point(index, 10 + Math.sin(index / 3) * 4, index % 2 ? 'A' : 'B'),
    );

    const first = buildAdaptivePriceHistorySeries(history, { maxPoints: 9 });
    const second = buildAdaptivePriceHistorySeries(history, { maxPoints: 9 });

    expect(first).toEqual(second);
  });

  it('varsayılan yoğun seri bütçesini 32 gerçek gözlemle sınırlar', () => {
    const history = Array.from(
      { length: 100 },
      (_, index) => point(index, 10 + (index % 11), index % 2 ? 'Market A' : 'Market B'),
    );

    const result = buildAdaptivePriceHistorySeries(history);

    expect(result.displayedCount).toBe(32);
    expect(result.points[0].sourceIndex).toBe(0);
    expect(result.points[result.points.length - 1].sourceIndex).toBe(99);
  });

  it('çok yıllı seride kısa yıl bilgisini etikete ekler', () => {
    const result = buildAdaptivePriceHistorySeries([
      { date: '2025-12-30', unit_price: 5, vendor_name: 'Market A' },
      { date: '2026-01-02', unit_price: 6, vendor_name: 'Market A' },
    ]);

    expect(result.points.map((entry) => entry.label)).toEqual(['30/12/25', '02/01/26']);
  });

  it('uçları ve en düşük/yüksek gözlemleri koruyamayacak bütçeyi reddeder', () => {
    expect(() => buildAdaptivePriceHistorySeries([point(0, 1), point(1, 2)], { maxPoints: 3 }))
      .toThrow(RangeError);
  });
});
