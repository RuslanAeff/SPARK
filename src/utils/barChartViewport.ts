export interface ChartPageRange {
  start: number;
  endExclusive: number;
}

export interface ChartViewportState {
  dataKey: string;
  zoomIndex: number;
  pageIndex: number;
}

export function buildChartZoomSizes(dataLength: number): number[] {
  const safeLength = Math.max(0, Math.floor(dataLength));
  if (safeLength === 0) return [];

  const candidates = [safeLength, Math.min(14, safeLength), Math.min(7, safeLength)];
  return candidates.filter((value, index) => candidates.indexOf(value) === index);
}

/**
 * Sayfaları sağdan hizalar. Böylece en güncel pencere her zaman tam 14/7 gün,
 * yalnızca en eski pencere gerektiğinde daha kısa olur.
 */
export function buildRightAlignedPageRanges(
  dataLength: number,
  requestedPageSize: number,
): ChartPageRange[] {
  const safeLength = Math.max(0, Math.floor(dataLength));
  if (safeLength === 0) return [];

  const pageSize = Math.max(1, Math.min(safeLength, Math.floor(requestedPageSize)));
  const firstPageSize = safeLength % pageSize || pageSize;
  const ranges: ChartPageRange[] = [];

  let start = 0;
  let size = firstPageSize;
  while (start < safeLength) {
    const endExclusive = Math.min(safeLength, start + size);
    ranges.push({ start, endExclusive });
    start = endExclusive;
    size = pageSize;
  }

  return ranges;
}

export function findPageForAnchor(
  ranges: ChartPageRange[],
  anchorIndex: number,
): number {
  if (ranges.length === 0) return 0;

  const safeAnchor = Math.max(
    ranges[0].start,
    Math.min(ranges[ranges.length - 1].endExclusive - 1, Math.floor(anchorIndex)),
  );
  const match = ranges.findIndex(
    range => safeAnchor >= range.start && safeAnchor < range.endExclusive,
  );
  return match >= 0 ? match : ranges.length - 1;
}

export function normalizeChartViewport(
  state: ChartViewportState,
  dataKey: string,
  dataLength: number,
  zoomSizes: number[],
): ChartViewportState {
  if (state.dataKey !== dataKey || zoomSizes.length === 0) {
    return { dataKey, zoomIndex: 0, pageIndex: 0 };
  }

  const zoomIndex = Math.max(0, Math.min(zoomSizes.length - 1, state.zoomIndex));
  const ranges = buildRightAlignedPageRanges(dataLength, zoomSizes[zoomIndex]);
  const pageIndex = Math.max(0, Math.min(Math.max(0, ranges.length - 1), state.pageIndex));
  return { dataKey, zoomIndex, pageIndex };
}

export function moveChartZoom(
  state: ChartViewportState,
  targetZoomIndex: number,
  dataKey: string,
  dataLength: number,
  zoomSizes: number[],
): ChartViewportState {
  const current = normalizeChartViewport(state, dataKey, dataLength, zoomSizes);
  if (zoomSizes.length === 0) return current;

  const nextZoomIndex = Math.max(
    0,
    Math.min(zoomSizes.length - 1, Math.floor(targetZoomIndex)),
  );
  if (nextZoomIndex === current.zoomIndex) return current;

  const currentRanges = buildRightAlignedPageRanges(
    dataLength,
    zoomSizes[current.zoomIndex],
  );
  const currentRange = currentRanges[current.pageIndex] ?? currentRanges[currentRanges.length - 1];
  const anchorIndex = currentRange?.endExclusive
    ? currentRange.endExclusive - 1
    : Math.max(0, dataLength - 1);
  const nextRanges = buildRightAlignedPageRanges(dataLength, zoomSizes[nextZoomIndex]);

  return {
    dataKey,
    zoomIndex: nextZoomIndex,
    pageIndex: findPageForAnchor(nextRanges, anchorIndex),
  };
}

/**
 * Önceki dönem serisi yalnız gün gün hizalıysa (geçerli seriyle aynı uzunluk)
 * kullanılabilir: karşılaştırma i. çubuğu i. çubukla eşler. Hizasız seri hem
 * çizilemez hem de ölçeğe katılırsa gerçek çubukları sıfıra yapıştırır, bu
 * yüzden tek bir kapıdan geçer.
 */
export function alignedPreviousSeries<T>(
  data: readonly T[],
  previousData?: readonly T[],
): readonly T[] | null {
  if (!previousData || previousData.length !== data.length) return null;
  return previousData;
}
