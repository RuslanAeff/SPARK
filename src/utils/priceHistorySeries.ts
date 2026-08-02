/**
 * A raw observation returned by the item analytics query.
 *
 * Callers are expected to provide observations in chronological order. The
 * adaptive series deliberately preserves that source order (including the
 * order of multiple purchases recorded on the same day).
 */
export interface PriceHistoryObservation {
  date: string;
  unit_price: number;
  vendor_name?: string | null;
}

/** A chart-ready point that always references an actual source observation. */
export interface PriceHistoryDisplayPoint {
  label: string;
  value: number;
  meta?: string;
  sourceIndex: number;
  /** Preserves the original observation spacing after adaptive sampling. */
  position: number;
}

export interface AdaptivePriceHistorySeries {
  points: PriceHistoryDisplayPoint[];
  sourceCount: number;
  displayedCount: number;
  simplified: boolean;
}

export interface AdaptivePriceHistoryOptions {
  maxPoints?: number;
}

export const DEFAULT_MAX_PRICE_HISTORY_POINTS = 32;

interface IndexedObservation {
  observation: PriceHistoryObservation;
  sourceIndex: number;
  minorUnitPrice: number;
  vendorKey: string;
}

const toMinorUnits = (value: number): number => Math.round(value * 100);

const normalizeVendorKey = (vendorName: string | null | undefined): string =>
  (vendorName ?? '').trim().toLocaleLowerCase('en-US');

const formatDateLabel = (date: string, includeYear: boolean): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!match) return date;
  return includeYear ? `${match[3]}/${match[2]}/${match[1].slice(-2)}` : `${match[3]}/${match[2]}`;
};

const toDisplayPoint = (
  entry: IndexedObservation,
  includeYear: boolean,
): PriceHistoryDisplayPoint => {
  const vendorName = entry.observation.vendor_name?.trim();
  return {
    label: formatDateLabel(entry.observation.date, includeYear),
    value: entry.observation.unit_price,
    ...(vendorName ? { meta: vendorName } : {}),
    sourceIndex: entry.sourceIndex,
    position: entry.sourceIndex,
  };
};

/**
 * Compress a visually redundant run without changing its boundaries.
 *
 * A run is redundant only when both the price (in currency minor units) and
 * the normalized vendor are unchanged. Its first and last observations are
 * retained so the chart still shows when that plateau began and ended.
 */
const compressIdenticalRuns = (
  observations: readonly IndexedObservation[],
): IndexedObservation[] => {
  if (observations.length < 3) return [...observations];

  const compressed: IndexedObservation[] = [];
  let runStart = 0;

  const flushRun = (runEndExclusive: number) => {
    compressed.push(observations[runStart]);
    const lastIndex = runEndExclusive - 1;
    if (lastIndex > runStart) compressed.push(observations[lastIndex]);
  };

  for (let index = 1; index < observations.length; index += 1) {
    const previous = observations[index - 1];
    const current = observations[index];
    const belongsToRun =
      previous.minorUnitPrice === current.minorUnitPrice &&
      previous.vendorKey === current.vendorKey;

    if (!belongsToRun) {
      flushRun(index);
      runStart = index;
    }
  }

  flushRun(observations.length);
  return compressed;
};

/**
 * Keep the source boundaries and the observed min/max inside deterministic
 * chronological buckets. No value is averaged or synthesized.
 */
const sampleBucketExtrema = (
  observations: readonly IndexedObservation[],
  maxPoints: number,
): IndexedObservation[] => {
  if (observations.length <= maxPoints) return [...observations];

  const lastPosition = observations.length - 1;
  const selectedPositions = new Set<number>([0, lastPosition]);
  const interiorCapacity = maxPoints - 2;
  const interiorLength = observations.length - 2;

  // Each full bucket contributes its observed minimum and maximum. With an
  // odd capacity, the remaining slot is filled by the strongest unsampled
  // local turn below.
  const bucketCount = Math.floor(interiorCapacity / 2);
  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const start = 1 + Math.floor((bucket * interiorLength) / bucketCount);
    const endExclusive = 1 + Math.floor(((bucket + 1) * interiorLength) / bucketCount);
    let minPosition = start;
    let maxPosition = start;

    for (let position = start + 1; position < endExclusive; position += 1) {
      const value = observations[position].minorUnitPrice;
      if (value < observations[minPosition].minorUnitPrice) minPosition = position;
      // Keep the last occurrence of an equal maximum. Together with the
      // earliest minimum, this retains both edges of a flat bucket.
      if (value >= observations[maxPosition].minorUnitPrice) maxPosition = position;
    }

    selectedPositions.add(minPosition);
    selectedPositions.add(maxPosition);
  }

  if (selectedPositions.size < maxPoints) {
    const remaining = Array.from({ length: interiorLength }, (_, offset) => offset + 1)
      .filter((position) => !selectedPositions.has(position))
      .map((position) => {
        const previous = observations[position - 1].minorUnitPrice;
        const current = observations[position].minorUnitPrice;
        const next = observations[position + 1].minorUnitPrice;
        return {
          position,
          // Distance from the line between adjacent observations highlights
          // local peaks and valleys before visually neutral points.
          prominence: Math.abs(current - ((previous + next) / 2)),
        };
      })
      .sort((left, right) =>
        right.prominence - left.prominence || left.position - right.position,
      );

    for (const candidate of remaining) {
      if (selectedPositions.size >= maxPoints) break;
      selectedPositions.add(candidate.position);
    }
  }

  return [...selectedPositions]
    .sort((left, right) => left - right)
    .map((position) => observations[position]);
};

/**
 * Build a bounded price-chart series while keeping the complete raw history
 * untouched for purchase-history views.
 *
 * Every returned point is an original observation. The function first
 * compresses long identical price+vendor plateaus, then applies chronological
 * bucket-extrema sampling only if the result still exceeds `maxPoints`.
 */
export function buildAdaptivePriceHistorySeries(
  history: readonly PriceHistoryObservation[],
  options: AdaptivePriceHistoryOptions = {},
): AdaptivePriceHistorySeries {
  const requestedMax = options.maxPoints ?? DEFAULT_MAX_PRICE_HISTORY_POINTS;

  if (!Number.isFinite(requestedMax) || !Number.isInteger(requestedMax) || requestedMax < 4) {
    throw new RangeError('maxPoints must be a finite integer of at least 4');
  }
  const maxPoints = requestedMax;

  const indexed = history.map((observation, sourceIndex) => {
    if (!Number.isFinite(observation.unit_price)) {
      throw new TypeError(`Price history contains a non-finite value at index ${sourceIndex}`);
    }
    return {
      observation,
      sourceIndex,
      minorUnitPrice: toMinorUnits(observation.unit_price),
      vendorKey: normalizeVendorKey(observation.vendor_name),
    };
  });

  const compressed = compressIdenticalRuns(indexed);
  const sampled = sampleBucketExtrema(compressed, maxPoints);
  const years = new Set(history.map((entry) => /^(\d{4})/.exec(entry.date)?.[1]).filter(Boolean));
  const includeYear = years.size > 1;
  const points = sampled.map((entry) => toDisplayPoint(entry, includeYear));

  return {
    points,
    sourceCount: history.length,
    displayedCount: points.length,
    simplified: points.length < history.length,
  };
}
