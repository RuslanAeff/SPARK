import { normalizeItemKey } from './itemNameNormalizer';
import {
  sanitizeMeasurementUnit,
  type MeasurementUnit,
} from './measurementUnit';
import { canonicalizeProductLabel } from './productIdentity';

export interface ProductMatchViewProduct {
  id: number;
  canonical_name: string;
  canonical_key?: string | null;
  measurement_unit: MeasurementUnit | string;
  observation_count?: number | null;
  latest_date?: string | null;
  alias_search_text?: string | null;
  raw_search_text?: string | null;
  translated_search_text?: string | null;
  user_label_search_text?: string | null;
  brand?: string | null;
  variant?: string | null;
  package_descriptor?: string | null;
}

export interface ProductMatchCandidate<T extends ProductMatchViewProduct = ProductMatchViewProduct> {
  left: T;
  right: T;
  /** 0–1 aralığında, yalnız inceleme sırasını belirleyen yerel benzerlik skoru. */
  score: number;
}

export type ProductMatchTimeFilter = 'all' | '30' | '90' | '365' | 'older' | 'none';
export type ProductMatchSort = 'recent' | 'frequent' | 'name';
export type ProductMatchUnitFilter = 'all' | MeasurementUnit;
export type ProductMatchTimeBucket =
  | 'recent30'
  | 'recent90'
  | 'recent365'
  | 'older'
  | 'unknown';

export interface ProductMatchFilterOptions {
  search?: string;
  unit?: ProductMatchUnitFilter;
  time?: ProductMatchTimeFilter;
  sort?: ProductMatchSort;
  /** İlk ürün seçildikten sonra ikinci seçim yalnız aynı birimden yapılır. */
  anchorUnit?: MeasurementUnit | string | null;
  /** Test edilebilir takvim hesabı için YYYY-MM-DD veya Date. */
  today?: string | Date;
}

export interface ProductMatchActivitySection<T extends ProductMatchViewProduct = ProductMatchViewProduct> {
  key: ProductMatchTimeBucket;
  data: T[];
}

interface DiscoveryDescriptor<T extends ProductMatchViewProduct> {
  product: T;
  unit: MeasurementUnit;
  labels: string[];
  brandKey: string;
  variantKey: string;
  packageDescriptorKey: string;
  packageSignatures: Set<string>;
  indexFeatures: Set<string>;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_INDEX_BUCKET = 64;
const DEFAULT_CANDIDATE_LIMIT = 40;
const MIN_MATCH_SCORE = 0.78;

// Paket ölçüleri benzer ürün sinyali değildir. Bunları semantik token'lardan
// çıkarırız, fakat farklı paketleri yanlış adaylaştırmamak için ayrıca saklarız.
const PACKAGE_PATTERN = /\b(?:\d+(?:[.,]\d+)?\s*[x×]\s*)?\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l|lt|litre|liter|adet|pcs?)\b/giu;
const PACKAGE_TOKEN_PATTERN = /^(?:\d+(?:[.,]\d+)?(?:x\d+(?:[.,]\d+)?)?(?:kg|g|ml|l|lt|litre|liter|adet|pcs?)?|kg|g|ml|l|lt|litre|liter|adet|pcs?)$/iu;

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function safeObservationCount(product: ProductMatchViewProduct): number {
  const value = Number(product.observation_count);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function splitAggregatedLabels(value: string | null | undefined): string[] {
  if (!value) return [];
  // SQLite GROUP_CONCAT çıktısı çoğunlukla virgülle ayrılır. Kaynak etikette
  // virgül bulunması halinde bütün metni de aşağıda ayrıca aday olarak tutarız.
  const whole = value.trim();
  const parts = whole.split(/[,;|\n\r]+/gu).map(part => part.trim()).filter(Boolean);
  return parts.length > 1 ? [whole, ...parts] : parts;
}

function normalizeCandidateLabel(value: string, unit: MeasurementUnit): string {
  return canonicalizeProductLabel(value, unit).canonicalKey
    .replace(/[^\p{L}\p{N}%+x.]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function collectSourceLabels(product: ProductMatchViewProduct, unit: MeasurementUnit): string[] {
  const sources = [
    product.canonical_name,
    product.canonical_key,
    ...splitAggregatedLabels(product.alias_search_text),
    ...splitAggregatedLabels(product.raw_search_text),
    ...splitAggregatedLabels(product.translated_search_text),
    ...splitAggregatedLabels(product.user_label_search_text),
  ];

  return [...new Set(
    sources
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map(value => normalizeCandidateLabel(value, unit))
      .filter(Boolean),
  )];
}

function extractPackageSignatures(label: string): string[] {
  return [...label.matchAll(PACKAGE_PATTERN)]
    .map(match => normalizeItemKey(match[0]).replace(/\s+/gu, '').replace(',', '.'))
    .filter(Boolean);
}

function semanticTokens(label: string): string[] {
  const withoutPackages = label.replace(PACKAGE_PATTERN, ' ');
  return withoutPackages
    .split(/\s+/gu)
    .map(token => token.trim())
    .filter(token => token.length >= 2 && !PACKAGE_TOKEN_PATTERN.test(token));
}

function trigrams(value: string): string[] {
  const compact = value.replace(/\s+/gu, '');
  if (compact.length < 4) return [];
  const result = new Set<string>();
  for (let index = 0; index <= compact.length - 3; index += 1) {
    result.add(compact.slice(index, index + 3));
  }
  return [...result];
}

function buildDescriptor<T extends ProductMatchViewProduct>(product: T): DiscoveryDescriptor<T> {
  const unit = sanitizeMeasurementUnit(product.measurement_unit);
  const labels = collectSourceLabels(product, unit);
  const packageDescriptorKey = normalizeCandidateLabel(product.package_descriptor ?? '', unit);
  const packageSignatures = new Set([
    ...labels.flatMap(extractPackageSignatures),
    ...extractPackageSignatures(packageDescriptorKey),
  ]);
  const indexFeatures = new Set<string>();

  labels.forEach(label => {
    indexFeatures.add(`exact:${label}`);
    const tokens = semanticTokens(label);
    tokens.forEach(token => indexFeatures.add(`token:${token}`));
    trigrams(tokens.join(' ')).forEach(trigram => indexFeatures.add(`tri:${trigram}`));
  });

  return {
    product,
    unit,
    labels,
    brandKey: normalizeCandidateLabel(product.brand ?? '', unit),
    variantKey: normalizeCandidateLabel(product.variant ?? '', unit),
    packageDescriptorKey,
    packageSignatures,
    indexFeatures,
  };
}

function intersectionSize(left: readonly string[], right: readonly string[]): number {
  const rightSet = new Set(right);
  return left.reduce((count, value) => count + (rightSet.has(value) ? 1 : 0), 0);
}

function tokenSimilarity(left: readonly string[], right: readonly string[]): number {
  if (left.length === 0 || right.length === 0) return 0;
  const intersection = intersectionSize(left, right);
  if (intersection === 0) return 0;
  return (2 * intersection) / (new Set(left).size + new Set(right).size);
}

function trigramSimilarity(left: string, right: string): number {
  const leftTrigrams = trigrams(left);
  const rightTrigrams = trigrams(right);
  if (leftTrigrams.length === 0 || rightTrigrams.length === 0) return 0;
  return (2 * intersectionSize(leftTrigrams, rightTrigrams))
    / (leftTrigrams.length + rightTrigrams.length);
}

function packagesConflict(
  left: DiscoveryDescriptor<ProductMatchViewProduct>,
  right: DiscoveryDescriptor<ProductMatchViewProduct>,
): boolean {
  if (left.packageSignatures.size === 0 || right.packageSignatures.size === 0) return false;
  return ![...left.packageSignatures].some(value => right.packageSignatures.has(value));
}

function protectedMetadataConflict(
  left: DiscoveryDescriptor<ProductMatchViewProduct>,
  right: DiscoveryDescriptor<ProductMatchViewProduct>,
): boolean {
  return [
    [left.brandKey, right.brandKey],
    [left.variantKey, right.variantKey],
    [left.packageDescriptorKey, right.packageDescriptorKey],
  ].some(([leftValue, rightValue]) => (
    leftValue.length > 0 && rightValue.length > 0 && leftValue !== rightValue
  ));
}

function descriptorSimilarity(
  left: DiscoveryDescriptor<ProductMatchViewProduct>,
  right: DiscoveryDescriptor<ProductMatchViewProduct>,
): number {
  if (
    left.unit !== right.unit
    || packagesConflict(left, right)
    || protectedMetadataConflict(left, right)
  ) return 0;

  let best = 0;
  for (const leftLabel of left.labels) {
    const leftTokens = semanticTokens(leftLabel);
    if (leftTokens.length === 0) continue;
    for (const rightLabel of right.labels) {
      const rightTokens = semanticTokens(rightLabel);
      if (rightTokens.length === 0) continue;

      if (leftLabel === rightLabel) return 1;
      const tokenScore = tokenSimilarity(leftTokens, rightTokens);
      const trigramScore = trigramSimilarity(leftTokens.join(' '), rightTokens.join(' '));
      // Tek ortak genel kelime (örn. "tavuk") otomatik aday değildir. Uzun ve
      // neredeyse aynı yazımlar ise OCR/imlâ varyasyonu olarak sıralanabilir.
      const score = Math.max(tokenScore, trigramScore);
      if (score > best) best = score;
    }
  }
  return best;
}

function boundedCandidatePairBudget(limit: number): number {
  return Math.min(30_000, Math.max(2_000, limit * 120));
}

/**
 * Yerel ve açıklanabilir aday kuyruğu üretir. Sonuç hiçbir zaman otomatik
 * birleştirme kararı değildir. Inverted index sayesinde bütün ürün çiftlerini
 * O(n²) taramaz; aşırı genel özellik kovaları güvenli biçimde atlanır.
 */
export function buildProductMatchCandidates<T extends ProductMatchViewProduct>(
  products: readonly T[],
  limit = DEFAULT_CANDIDATE_LIMIT,
): ProductMatchCandidate<T>[] {
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : DEFAULT_CANDIDATE_LIMIT;
  if (safeLimit === 0 || products.length < 2) return [];

  const descriptors = products
    .map(buildDescriptor)
    .sort((left, right) => left.product.id - right.product.id);
  const featureIndex = new Map<string, number[]>();

  descriptors.forEach((descriptor, descriptorIndex) => {
    descriptor.indexFeatures.forEach(feature => {
      const existing = featureIndex.get(feature);
      if (existing) existing.push(descriptorIndex);
      else featureIndex.set(feature, [descriptorIndex]);
    });
  });

  const pairKeys = new Set<string>();
  const pairBudget = boundedCandidatePairBudget(safeLimit);
  const orderedFeatures = [...featureIndex.keys()].sort(compareText);

  for (const feature of orderedFeatures) {
    const indexes = featureIndex.get(feature) ?? [];
    if (indexes.length < 2 || indexes.length > MAX_INDEX_BUCKET) continue;
    for (let leftIndex = 0; leftIndex < indexes.length - 1; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < indexes.length; rightIndex += 1) {
        const leftDescriptor = descriptors[indexes[leftIndex]];
        const rightDescriptor = descriptors[indexes[rightIndex]];
        if (
          leftDescriptor.unit !== rightDescriptor.unit
          || leftDescriptor.product.id === rightDescriptor.product.id
        ) continue;
        pairKeys.add(`${indexes[leftIndex]}:${indexes[rightIndex]}`);
        if (pairKeys.size >= pairBudget) break;
      }
      if (pairKeys.size >= pairBudget) break;
    }
    if (pairKeys.size >= pairBudget) break;
  }

  const candidates: ProductMatchCandidate<T>[] = [];
  pairKeys.forEach(pairKey => {
    const [leftIndex, rightIndex] = pairKey.split(':').map(Number);
    const left = descriptors[leftIndex];
    const right = descriptors[rightIndex];
    const score = descriptorSimilarity(left, right);
    if (score >= MIN_MATCH_SCORE) {
      candidates.push({ left: left.product, right: right.product, score: Number(score.toFixed(4)) });
    }
  });

  return candidates
    .sort((left, right) => {
      const scoreDifference = right.score - left.score;
      if (scoreDifference !== 0) return scoreDifference;
      const observationDifference = (
        safeObservationCount(right.left) + safeObservationCount(right.right)
      ) - (
        safeObservationCount(left.left) + safeObservationCount(left.right)
      );
      if (observationDifference !== 0) return observationDifference;
      const leftFirstId = Math.min(left.left.id, left.right.id);
      const rightFirstId = Math.min(right.left.id, right.right.id);
      if (leftFirstId !== rightFirstId) return leftFirstId - rightFirstId;
      return Math.max(left.left.id, left.right.id) - Math.max(right.left.id, right.right.id);
    })
    .slice(0, safeLimit);
}

function referenceUtcDate(today?: string | Date): number {
  if (typeof today === 'string') {
    const parsed = parseCalendarDate(today);
    if (parsed != null) return parsed;
  } else if (today instanceof Date && Number.isFinite(today.getTime())) {
    return Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  }
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseCalendarDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/u.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;
  return timestamp;
}

export function getProductMatchTimeBucket(
  latestDate: string | null | undefined,
  today?: string | Date,
): ProductMatchTimeBucket {
  const activityDate = parseCalendarDate(latestDate);
  const referenceDate = referenceUtcDate(today);
  if (activityDate == null || activityDate > referenceDate) return 'unknown';
  const ageInDays = Math.floor((referenceDate - activityDate) / DAY_MS);
  if (ageInDays <= 30) return 'recent30';
  if (ageInDays <= 90) return 'recent90';
  if (ageInDays <= 365) return 'recent365';
  return 'older';
}

function matchesTimeFilter(
  product: ProductMatchViewProduct,
  filter: ProductMatchTimeFilter,
  today?: string | Date,
): boolean {
  if (filter === 'all') return true;
  const bucket = getProductMatchTimeBucket(product.latest_date, today);
  if (filter === '30') return bucket === 'recent30';
  if (filter === '90') return bucket === 'recent30' || bucket === 'recent90';
  if (filter === '365') {
    return bucket === 'recent30' || bucket === 'recent90' || bucket === 'recent365';
  }
  if (filter === 'older') return bucket === 'older';
  return bucket === 'unknown';
}

function searchableProductText(product: ProductMatchViewProduct): string {
  return normalizeItemKey([
    product.canonical_name,
    product.canonical_key,
    product.brand,
    product.variant,
    product.package_descriptor,
    product.alias_search_text,
    product.raw_search_text,
    product.translated_search_text,
    product.user_label_search_text,
  ].filter(Boolean).join(' ')).replace(/[^\p{L}\p{N}%+x.]+/gu, ' ');
}

function sortableActivityDate(product: ProductMatchViewProduct, today?: string | Date): number {
  if (getProductMatchTimeBucket(product.latest_date, today) === 'unknown') {
    return Number.NEGATIVE_INFINITY;
  }
  return parseCalendarDate(product.latest_date) ?? Number.NEGATIVE_INFINITY;
}

/** Arama, birim, dönem ve sıralamayı kaynak diziyi değiştirmeden uygular. */
export function filterAndSortProductMatches<T extends ProductMatchViewProduct>(
  products: readonly T[],
  options: ProductMatchFilterOptions = {},
): T[] {
  const query = normalizeItemKey(options.search).replace(/[^\p{L}\p{N}%+x.]+/gu, ' ').trim();
  const unit = options.unit ?? 'all';
  const anchorUnit = options.anchorUnit == null
    ? null
    : sanitizeMeasurementUnit(options.anchorUnit);
  const time = options.time ?? 'all';
  const sort = options.sort ?? 'recent';

  return products
    .filter(product => {
      const productUnit = sanitizeMeasurementUnit(product.measurement_unit);
      if (unit !== 'all' && productUnit !== unit) return false;
      if (anchorUnit != null && productUnit !== anchorUnit) return false;
      if (!matchesTimeFilter(product, time, options.today)) return false;
      return !query || searchableProductText(product).includes(query);
    })
    .sort((left, right) => {
      if (sort === 'frequent') {
        const countDifference = safeObservationCount(right) - safeObservationCount(left);
        if (countDifference !== 0) return countDifference;
      }
      if (sort === 'recent' || sort === 'frequent') {
        const leftDate = sortableActivityDate(left, options.today);
        const rightDate = sortableActivityDate(right, options.today);
        if (leftDate !== rightDate) return leftDate > rightDate ? -1 : 1;
      }
      const nameDifference = compareText(
        normalizeItemKey(left.canonical_name),
        normalizeItemKey(right.canonical_name),
      );
      return nameDifference !== 0 ? nameDifference : left.id - right.id;
    });
}

/** Ürünleri ekrandaki zaman başlıklarına, mevcut sıralarını bozmadan böler. */
export function groupProductsByActivity<T extends ProductMatchViewProduct>(
  products: readonly T[],
  today?: string | Date,
): ProductMatchActivitySection<T>[] {
  const bucketOrder: ProductMatchTimeBucket[] = [
    'recent30',
    'recent90',
    'recent365',
    'older',
    'unknown',
  ];
  const buckets = new Map<ProductMatchTimeBucket, T[]>(
    bucketOrder.map(bucket => [bucket, []]),
  );
  products.forEach(product => {
    buckets.get(getProductMatchTimeBucket(product.latest_date, today))?.push(product);
  });
  return bucketOrder
    .map(key => ({ key, data: buckets.get(key) ?? [] }))
    .filter(section => section.data.length > 0);
}
