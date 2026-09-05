import {
  alignedPreviousSeries,
  buildChartZoomSizes,
  buildRightAlignedPageRanges,
  moveChartZoom,
  normalizeChartViewport,
  type ChartViewportState,
} from '../barChartViewport';

describe('barChartViewport', () => {
  const dataKey = '32:2026-07-21:2026-08-21';
  const zoomSizes = buildChartZoomSizes(32);

  it('en güncel 14 ve 7 günlük pencereleri tam tutup yalnız en eski sayfayı kısaltır', () => {
    expect(zoomSizes).toEqual([32, 14, 7]);
    expect(buildRightAlignedPageRanges(32, 14)).toEqual([
      { start: 0, endExclusive: 4 },
      { start: 4, endExclusive: 18 },
      { start: 18, endExclusive: 32 },
    ]);
    expect(buildRightAlignedPageRanges(32, 7)).toEqual([
      { start: 0, endExclusive: 4 },
      { start: 4, endExclusive: 11 },
      { start: 11, endExclusive: 18 },
      { start: 18, endExclusive: 25 },
      { start: 25, endExclusive: 32 },
    ]);
  });

  it('yakınlaştırıp uzaklaştırırken incelenen sayfanın sağ uç tarihini korur', () => {
    const fourteenDayState: ChartViewportState = {
      dataKey,
      zoomIndex: 1,
      pageIndex: 1,
    };

    const sevenDayState = moveChartZoom(
      fourteenDayState,
      2,
      dataKey,
      32,
      zoomSizes,
    );
    expect(sevenDayState).toEqual({ dataKey, zoomIndex: 2, pageIndex: 2 });

    expect(moveChartZoom(sevenDayState, 1, dataKey, 32, zoomSizes)).toEqual(
      fourteenDayState,
    );
  });

  it('hızlı ardışık adımları sırayla uygular ve zoom sınırlarını aşmaz', () => {
    let state: ChartViewportState = { dataKey, zoomIndex: 0, pageIndex: 0 };
    state = moveChartZoom(state, state.zoomIndex + 1, dataKey, 32, zoomSizes);
    state = moveChartZoom(state, state.zoomIndex + 1, dataKey, 32, zoomSizes);
    state = moveChartZoom(state, state.zoomIndex + 1, dataKey, 32, zoomSizes);
    expect(state.zoomIndex).toBe(2);

    state = moveChartZoom(state, state.zoomIndex - 1, dataKey, 32, zoomSizes);
    state = moveChartZoom(state, state.zoomIndex - 1, dataKey, 32, zoomSizes);
    state = moveChartZoom(state, state.zoomIndex - 1, dataKey, 32, zoomSizes);
    expect(state).toEqual({ dataKey, zoomIndex: 0, pageIndex: 0 });
  });

  it('aynı veri aralığında konumu korur, farklı aralıkta stale konumu sıfırlar', () => {
    const state: ChartViewportState = { dataKey, zoomIndex: 2, pageIndex: 4 };
    expect(normalizeChartViewport(state, dataKey, 32, zoomSizes)).toEqual(state);
    expect(normalizeChartViewport(state, '31:2026-07-22:2026-08-21', 31, [31, 14, 7]))
      .toEqual({ dataKey: '31:2026-07-22:2026-08-21', zoomIndex: 0, pageIndex: 0 });
  });
});

describe('alignedPreviousSeries', () => {
  const data = [{ value: 10 }, { value: 20 }, { value: 30 }];

  it('aynı uzunluktaki seriyi geçirir', () => {
    const previous = [{ value: 1 }, { value: 2 }, { value: 3 }];
    expect(alignedPreviousSeries(data, previous)).toBe(previous);
  });

  it('hizasız seriyi eler (ölçeği şişirmesin)', () => {
    expect(alignedPreviousSeries(data, [{ value: 5000 }])).toBeNull();
    expect(alignedPreviousSeries(data, undefined)).toBeNull();
  });
});
