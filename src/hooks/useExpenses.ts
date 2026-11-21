import { useState, useEffect, useCallback, useRef } from 'react';
import { ExpenseDao, type TopTransactionSelection } from '../db/expenseDao';
import { useLanguage } from '../i18n/LanguageContext';
import {
  DAY_TYPE_SEGMENT_COLOR,
  DAY_TYPE_SEGMENT_LABEL_KEY,
  SPEND_SEGMENT_COLOR,
  SPEND_SEGMENT_LABEL_KEY,
  type SpendSegment,
} from '../utils/spendSegment';
import { ExpenseWithDetails, CategorySpending, VendorSpending } from '../db/schema';
import { getStartOfMonth, getEndOfMonth } from '../utils/dateUtils';
import { logError } from '../utils/logError';
import { matchesSearch } from '../utils/searchText';
import { useLatestQuery } from './useLatestQuery';

function useMounted() {
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  return mounted;
}

export interface ExpenseQueryOptions {
  /** false iken manuel refresh dahil DAO sorgusu başlatılmaz. */
  enabled?: boolean;
  /** false iken hook mount/range değişiminde otomatik sorgu başlatmaz. */
  autoLoad?: boolean;
}

export interface TopTransactionsQueryOptions extends ExpenseQueryOptions {
  /** Uzun dönem listelerinde satıcı başına tek temsilci işlem seçilebilir. */
  selection?: TopTransactionSelection;
}

// P9: İşlem listesinde tüm satırları tek seferde okuyup FlatList’e vermek yerine
// sayfalı çekim. İlk sayfa anında görünür, kullanıcı listeyi aşağı kaydırınca
// `loadMore` ile arka arkaya sayfalar eklenir. Arama bütün kayıtlarda
// `useExpenseSearch` ile yapılır (BUG-11).
export function usePaginatedExpenses(pageSize: number = 60) {
  const [items, setItems] = useState<ExpenseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const mounted = useMounted();
  const busyRef = useRef(false);
  const itemsLenRef = useRef(0);
  itemsLenRef.current = items.length;

  const refresh = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    try {
      // BUG-25: yenileme, kullanıcının o ana kadar yüklediği kadar satırı yeniden
      // çeker; derindeki bir kaydı düzenleyip dönünce liste 60'a inmez.
      const limit = Math.max(pageSize, itemsLenRef.current);
      const page = await ExpenseDao.getAll(limit, 0);
      if (!mounted.current) return;
      setItems(page);
      setHasMore(page.length >= limit);
    } catch (e) {
      logError('Expenses refresh failed', e);
    } finally {
      busyRef.current = false;
      if (mounted.current) setLoading(false);
    }
  }, [mounted, pageSize]);

  const loadMore = useCallback(async () => {
    if (busyRef.current || !hasMore) return;
    busyRef.current = true;
    setLoadingMore(true);
    try {
      const offset = itemsLenRef.current;
      const page = await ExpenseDao.getAll(pageSize, offset);
      if (!mounted.current) return;
      setItems(prev => (page.length > 0 ? [...prev, ...page] : prev));
      if (page.length < pageSize) setHasMore(false);
    } catch (e) {
      logError('Expenses loadMore failed', e);
    } finally {
      busyRef.current = false;
      if (mounted.current) setLoadingMore(false);
    }
  }, [mounted, pageSize, hasMore]);

  useEffect(() => { refresh(); }, [refresh]);

  return { items, loading, loadingMore, hasMore, loadMore, refresh };
}

/**
 * BUG-11: İşlem araması bütün kayıtlarda çalışır (eskiden yalnız yüklenmiş 60'lık
 * sayfalarda). Eşleşen kimlikler hafif bir sorguyla bulunur, katlama dil
 * bağımsızdır (`foldSearchText`); tam satırlar sayfa sayfa okunur.
 * `categoryLabel` ekranda görünen (çevrilmiş) kategori adını verir; arama hem
 * kayıtlı adda hem görünen adda yapılır.
 */
export function useExpenseSearch(
  query: string,
  categoryLabel: (name: string) => string,
  pageSize: number = 60,
) {
  const [items, setItems] = useState<ExpenseWithDetails[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const mounted = useMounted();
  const matchIdsRef = useRef<number[]>([]);
  const sequenceRef = useRef(0);
  const busyRef = useRef(false);
  const itemsLenRef = useRef(0);
  itemsLenRef.current = items.length;
  const labelRef = useRef(categoryLabel);
  labelRef.current = categoryLabel;
  const trimmed = query.trim();

  const run = useCallback(async (keepLoaded: boolean) => {
    const sequence = ++sequenceRef.current;
    if (!trimmed) {
      matchIdsRef.current = [];
      setItems([]);
      setHasMore(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const index = await ExpenseDao.getSearchIndex();
      if (sequence !== sequenceRef.current || !mounted.current) return;
      const ids = index
        .filter(row => matchesSearch([
          row.vendor_name,
          row.category_name,
          row.category_name ? labelRef.current(row.category_name) : null,
          row.note,
        ], trimmed))
        .map(row => row.id);
      matchIdsRef.current = ids;
      const count = keepLoaded ? Math.max(pageSize, itemsLenRef.current) : pageSize;
      const page = await ExpenseDao.getByIdsInOrder(ids.slice(0, count));
      if (sequence !== sequenceRef.current || !mounted.current) return;
      setItems(page);
      setHasMore(ids.length > count);
    } catch (e) {
      logError('Expense search failed', e);
    } finally {
      if (sequence === sequenceRef.current && mounted.current) setSearching(false);
    }
  }, [mounted, trimmed, pageSize]);

  // Yazarken her tuşta veritabanı taranmasın.
  useEffect(() => {
    if (!trimmed) {
      void run(false);
      return;
    }
    const timer = setTimeout(() => { void run(false); }, 250);
    return () => clearTimeout(timer);
  }, [run, trimmed]);

  const loadMore = useCallback(async () => {
    if (busyRef.current || !hasMore) return;
    busyRef.current = true;
    setLoadingMore(true);
    const sequence = sequenceRef.current;
    try {
      const offset = itemsLenRef.current;
      const nextIds = matchIdsRef.current.slice(offset, offset + pageSize);
      const page = await ExpenseDao.getByIdsInOrder(nextIds);
      if (sequence !== sequenceRef.current || !mounted.current) return;
      setItems(prev => [...prev, ...page]);
      setHasMore(matchIdsRef.current.length > offset + nextIds.length);
    } catch (e) {
      logError('Expense search loadMore failed', e);
    } finally {
      busyRef.current = false;
      if (mounted.current) setLoadingMore(false);
    }
  }, [mounted, hasMore, pageSize]);

  /** Veri değişince (silme/düzenleme) yüklenmiş sonuç sayısını koruyarak yeniler. */
  const refresh = useCallback(() => run(true), [run]);

  return { active: trimmed.length > 0, items, searching, loadingMore, hasMore, loadMore, refresh };
}

export function useMonthlyTotal(startDate?: string, endDate?: string, options: ExpenseQueryOptions = {}) {
  const autoLoad = options.autoLoad ?? true;
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const mounted = useMounted();

  const start = startDate || getStartOfMonth();
  const end = endDate || getEndOfMonth();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const t = await ExpenseDao.getTotalByDateRange(start, end);
      if (mounted.current) setTotal(t);
    } catch (e) {
      logError('Error loading total', e);
    }
    if (mounted.current) setLoading(false);
  }, [mounted, start, end]);

  useEffect(() => { if (autoLoad) refresh(); }, [refresh, autoLoad]);

  return { total, loading, refresh };
}

function withPercentages<T extends { total: number }>(rows: T[]): (T & { percentage: number })[] {
  const totalSpent = rows.reduce((sum, r) => sum + r.total, 0);
  return rows.map(r => ({
    ...r,
    percentage: totalSpent > 0 ? Math.round((r.total / totalSpent) * 100) : 0,
  }));
}

const EMPTY_CATEGORY_SPENDING: CategorySpending[] = [];
const EMPTY_VENDOR_SPENDING: VendorSpending[] = [];
const EMPTY_DAILY: { date: string; total: number }[] = [];
const EMPTY_TRANSACTIONS: ExpenseWithDetails[] = [];

// CQ-06: Aşağıdaki altı hook sıra/iptal/yükleniyor iskeletini `useLatestQuery`
// üzerinden paylaşır; burada yalnız sorgu ve eşleme kalır.

export function useCategorySpending(
  startDate?: string,
  endDate?: string,
  options: ExpenseQueryOptions = {},
) {
  const start = startDate || getStartOfMonth();
  const end = endDate || getEndOfMonth();

  const load = useCallback(async (): Promise<CategorySpending[]> => {
    const raw: any[] = await ExpenseDao.getCategorySpending(start, end) as any[];
    return withPercentages(raw.map(r => ({
      category_id: r.category_id,
      category_name: r.category_name,
      category_icon: r.category_icon,
      category_color: r.category_color,
      total: r.total,
    })));
  }, [start, end]);

  return useLatestQuery(load, EMPTY_CATEGORY_SPENDING, {
    ...options,
    errorMessage: 'Error loading category spending',
  });
}

type SubcategoryResult = { data: CategorySpending[]; parentId: number | null };
const EMPTY_SUBCATEGORY_RESULT: SubcategoryResult = { data: [], parentId: null };

export function useSubcategorySpending(
  parentId: number | null,
  startDate?: string,
  endDate?: string,
  options: ExpenseQueryOptions = {},
) {
  // Satırlar ve ait oldukları üst kategori tek state'te tutulur; böylece kart,
  // önceki kategorinin satırlarını yeni seçimin sonucu sanıp açılmaz.
  const start = startDate || getStartOfMonth();
  const end = endDate || getEndOfMonth();

  const load = useCallback((): SubcategoryResult | Promise<SubcategoryResult> => {
    if (!parentId) return EMPTY_SUBCATEGORY_RESULT;
    return (async () => {
      const raw: any[] = await ExpenseDao.getSubcategorySpending(parentId, start, end) as any[];
      const data: CategorySpending[] = withPercentages(raw.map(r => ({
        category_id: r.category_id,
        category_name: r.category_name,
        category_icon: r.category_icon,
        category_color: r.category_color,
        total: r.total,
      })));
      return { data, parentId };
    })();
  }, [parentId, start, end]);

  // Seçili kart sonsuza dek "bekliyor" kalmasın; hata olursa boş durumla açılsın.
  const fallbackOnError = useCallback((): SubcategoryResult => ({ data: [], parentId }), [parentId]);

  const { data: result, loading, refresh } = useLatestQuery(load, EMPTY_SUBCATEGORY_RESULT, {
    ...options,
    errorMessage: 'Error loading subcategory spending',
    fallbackOnError,
  });

  return { data: result.data, parentId: result.parentId, loading, refresh };
}

export function useVendorSpending(
  startDate?: string,
  endDate?: string,
  options: ExpenseQueryOptions = {},
) {
  const start = startDate || getStartOfMonth();
  const end = endDate || getEndOfMonth();

  const load = useCallback(async (): Promise<VendorSpending[]> => {
    const raw: any[] = await ExpenseDao.getVendorSpending(start, end) as any[];
    return withPercentages(raw.map(r => ({
      vendor_id: r.vendor_id,
      vendor_name: r.vendor_name,
      vendor_logo: r.vendor_logo,
      total: r.total,
    })));
  }, [start, end]);

  return useLatestQuery(load, EMPTY_VENDOR_SPENDING, {
    ...options,
    errorMessage: 'Error loading vendor spending',
  });
}

export function useDailySpending(
  startDate?: string,
  endDate?: string,
  options: ExpenseQueryOptions & { cashOnly?: boolean } = {},
) {
  const { cashOnly = false, ...queryOptions } = options;
  const start = startDate || getStartOfMonth();
  const end = endDate || getEndOfMonth();

  const load = useCallback(async (): Promise<{ date: string; total: number }[]> => {
    const raw = cashOnly
      ? await ExpenseDao.getCashSpendingByDays(start, end)
      : await ExpenseDao.getSpendingByDays(start, end);

    const result: { date: string; total: number }[] = [];
    const currentDate = new Date(start + 'T12:00:00Z');
    const lastDate = new Date(end + 'T12:00:00Z');

    const diffTime = Math.abs(lastDate.getTime() - currentDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 60) return raw;

    // P4: Map tabanlı O(1) lookup — eski raw.find() O(n²) idi
    const rawMap = new Map(raw.map(r => [r.date, r.total]));

    while (currentDate <= lastDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      result.push({
        date: dateStr,
        total: rawMap.get(dateStr) ?? 0,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return result;
  }, [start, end, cashOnly]);

  return useLatestQuery(load, EMPTY_DAILY, {
    ...queryOptions,
    errorMessage: 'Error loading daily spending',
  });
}

export function useTopTransactions(
  startDate?: string,
  endDate?: string,
  limit: number = 3,
  options: TopTransactionsQueryOptions = {},
) {
  const { selection = 'overall', ...queryOptions } = options;
  const start = startDate || getStartOfMonth();
  const end = endDate || getEndOfMonth();

  const load = useCallback(
    () => ExpenseDao.getTopTransactions(start, end, limit, selection),
    [start, end, limit, selection],
  );

  return useLatestQuery(load, EMPTY_TRANSACTIONS, {
    ...queryOptions,
    errorMessage: 'Error loading top transactions',
  });
}

type NeedsWantsRow = { key: SpendSegment; segment: string; total: number; percentage: number; color: string };
type WeekWeekendRow = { segment: string; total: number; percentage: number; color: string };
type BehavioralResult = { needsWants: NeedsWantsRow[]; weekWeekend: WeekWeekendRow[] };
const EMPTY_BEHAVIORAL: BehavioralResult = { needsWants: [], weekWeekend: [] };

export function useBehavioralAnalytics(
  startDate?: string,
  endDate?: string,
  options: ExpenseQueryOptions = {},
) {
  const { t } = useLanguage();
  const tRef = useRef(t);
  tRef.current = t;

  const start = startDate || getStartOfMonth();
  const end = endDate || getEndOfMonth();

  const load = useCallback(async (): Promise<BehavioralResult> => {
    const translate = tRef.current;
    const nwData = await ExpenseDao.getNeedsVsWants(start, end);
    const needsWants = withPercentages(nwData.map(item => ({
      key: item.segment,
      segment: translate(SPEND_SEGMENT_LABEL_KEY[item.segment]),
      total: item.total,
      color: SPEND_SEGMENT_COLOR[item.segment],
    })));

    const wwData = await ExpenseDao.getWeekdayVsWeekend(start, end);
    const weekWeekend = withPercentages(wwData.map(item => ({
      segment: translate(DAY_TYPE_SEGMENT_LABEL_KEY[item.segment]),
      total: item.total,
      color: DAY_TYPE_SEGMENT_COLOR[item.segment],
    })));
    return { needsWants, weekWeekend };
  }, [start, end]);

  const { data, loading, refresh } = useLatestQuery(load, EMPTY_BEHAVIORAL, {
    ...options,
    errorMessage: 'Error loading behavioral analytics',
  });

  return { needsWants: data.needsWants, weekWeekend: data.weekWeekend, loading, refresh };
}
