import { useState, useEffect, useCallback, useRef } from 'react';
import { ExpenseDao, type TopTransactionSelection } from '../db/expenseDao';
import { useLanguage } from '../i18n/LanguageContext';
import { SPEND_SEGMENT_COLOR, SPEND_SEGMENT_LABEL_KEY, type SpendSegment } from '../utils/spendSegment';
import { ExpenseWithDetails, CategorySpending, VendorSpending } from '../db/schema';
import { getStartOfMonth, getEndOfMonth } from '../utils/dateUtils';
import { logError } from '../utils/logError';
import { matchesSearch } from '../utils/searchText';

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

function useAutoRefresh(
  refresh: () => Promise<void>,
  enabled: boolean,
  autoLoad: boolean,
) {
  useEffect(() => {
    if (enabled && autoLoad) void refresh();
  }, [refresh, enabled, autoLoad]);
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
  }, [pageSize]);

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
  }, [pageSize, hasMore]);

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
  }, [trimmed, pageSize]);

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
  }, [hasMore, pageSize]);

  /** Veri değişince (silme/düzenleme) yüklenmiş sonuç sayısını koruyarak yeniler. */
  const refresh = useCallback(() => run(true), [run]);

  return { active: trimmed.length > 0, items, searching, loadingMore, hasMore, loadMore, refresh };
}

export function useMonthlyTotal(startDate?: string, endDate?: string) {
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
  }, [start, end]);

  useEffect(() => { refresh(); }, [refresh]);

  return { total, loading, refresh };
}

export function useCategorySpending(
  startDate?: string,
  endDate?: string,
  options: ExpenseQueryOptions = {},
) {
  const [data, setData] = useState<CategorySpending[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useMounted();
  const refreshSequence = useRef(0);
  const enabled = options.enabled ?? true;
  const autoLoad = options.autoLoad ?? true;
  useEffect(() => {
    if (!enabled) {
      refreshSequence.current += 1;
      setLoading(false);
    }
  }, [enabled]);

  const start = startDate || getStartOfMonth();
  const end = endDate || getEndOfMonth();

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const sequence = ++refreshSequence.current;
    setLoading(true);
    try {
      const raw: any[] = await ExpenseDao.getCategorySpending(start, end) as any[];
      const totalSpent = raw.reduce((sum, r) => sum + r.total, 0);
      const mapped: CategorySpending[] = raw.map(r => ({
        category_id: r.category_id,
        category_name: r.category_name,
        category_icon: r.category_icon,
        category_color: r.category_color,
        total: r.total,
        percentage: totalSpent > 0 ? Math.round((r.total / totalSpent) * 100) : 0,
      }));
      if (mounted.current && sequence === refreshSequence.current) setData(mapped);
    } catch (e) {
      logError('Error loading category spending', e);
    }
    if (mounted.current && sequence === refreshSequence.current) setLoading(false);
  }, [start, end, enabled]);

  useAutoRefresh(refresh, enabled, autoLoad);

  return { data, loading, refresh };
}

export function useSubcategorySpending(
  parentId: number | null,
  startDate?: string,
  endDate?: string,
  options: ExpenseQueryOptions = {},
) {
  // Satırlar ve ait oldukları üst kategori tek state'te tutulur; böylece kart,
  // önceki kategorinin satırlarını yeni seçimin sonucu sanıp açılmaz.
  const [result, setResult] = useState<{ data: CategorySpending[]; parentId: number | null }>({
    data: [], parentId: null,
  });
  const [loading, setLoading] = useState(true);
  const mounted = useMounted();
  const refreshSequence = useRef(0);
  const enabled = options.enabled ?? true;
  const autoLoad = options.autoLoad ?? true;
  useEffect(() => {
    if (!enabled) {
      refreshSequence.current += 1;
      setLoading(false);
    }
  }, [enabled]);

  const start = startDate || getStartOfMonth();
  const end = endDate || getEndOfMonth();

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const sequence = ++refreshSequence.current;
    if (!parentId) {
      if (mounted.current && sequence === refreshSequence.current) {
        setResult({ data: [], parentId: null });
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    try {
      const raw: any[] = await ExpenseDao.getSubcategorySpending(parentId, start, end) as any[];
      const totalSpent = raw.reduce((sum, r) => sum + r.total, 0);
      const mapped: CategorySpending[] = raw.map(r => ({
        category_id: r.category_id,
        category_name: r.category_name,
        category_icon: r.category_icon,
        category_color: r.category_color,
        total: r.total,
        percentage: totalSpent > 0 ? Math.round((r.total / totalSpent) * 100) : 0,
      }));
      if (mounted.current && sequence === refreshSequence.current) setResult({ data: mapped, parentId });
    } catch (e) {
      logError('Error loading subcategory spending', e);
      // Seçili kart sonsuza dek "bekliyor" kalmasın; boş durumla açılsın.
      if (mounted.current && sequence === refreshSequence.current) setResult({ data: [], parentId });
    }
    if (mounted.current && sequence === refreshSequence.current) setLoading(false);
  }, [parentId, start, end, enabled]);

  useAutoRefresh(refresh, enabled, autoLoad);

  return { data: result.data, parentId: result.parentId, loading, refresh };
}

export function useVendorSpending(
  startDate?: string,
  endDate?: string,
  options: ExpenseQueryOptions = {},
) {
  const [data, setData] = useState<VendorSpending[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useMounted();
  const refreshSequence = useRef(0);
  const enabled = options.enabled ?? true;
  const autoLoad = options.autoLoad ?? true;
  useEffect(() => {
    if (!enabled) {
      refreshSequence.current += 1;
      setLoading(false);
    }
  }, [enabled]);

  const start = startDate || getStartOfMonth();
  const end = endDate || getEndOfMonth();

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const sequence = ++refreshSequence.current;
    setLoading(true);
    try {
      const raw: any[] = await ExpenseDao.getVendorSpending(start, end) as any[];
      const totalSpent = raw.reduce((sum, r) => sum + r.total, 0);
      const mapped: VendorSpending[] = raw.map(r => ({
        vendor_id: r.vendor_id,
        vendor_name: r.vendor_name,
        vendor_logo: r.vendor_logo,
        total: r.total,
        percentage: totalSpent > 0 ? Math.round((r.total / totalSpent) * 100) : 0,
      }));
      if (mounted.current && sequence === refreshSequence.current) setData(mapped);
    } catch (e) {
      logError('Error loading vendor spending', e);
    }
    if (mounted.current && sequence === refreshSequence.current) setLoading(false);
  }, [start, end, enabled]);

  useAutoRefresh(refresh, enabled, autoLoad);

  return { data, loading, refresh };
}

export function useDailySpending(
  startDate?: string,
  endDate?: string,
  options: ExpenseQueryOptions & { cashOnly?: boolean } = {},
) {
  const [data, setData] = useState<{ date: string; total: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useMounted();
  const refreshSequence = useRef(0);
  const enabled = options.enabled ?? true;
  const autoLoad = options.autoLoad ?? true;
  const cashOnly = options.cashOnly ?? false;
  useEffect(() => {
    if (!enabled) {
      refreshSequence.current += 1;
      setLoading(false);
    }
  }, [enabled]);

  const start = startDate || getStartOfMonth();
  const end = endDate || getEndOfMonth();

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const sequence = ++refreshSequence.current;
    setLoading(true);
    try {
      const raw = cashOnly
        ? await ExpenseDao.getCashSpendingByDays(start, end)
        : await ExpenseDao.getSpendingByDays(start, end);
      
      const result = [];
      const currentDate = new Date(start + 'T12:00:00Z');
      const lastDate = new Date(end + 'T12:00:00Z');
      
      const diffTime = Math.abs(lastDate.getTime() - currentDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 60) {
        if (mounted.current && sequence === refreshSequence.current) {
          setData(raw);
          setLoading(false);
        }
        return;
      }
      
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
      
      if (mounted.current && sequence === refreshSequence.current) setData(result);
    } catch (e) {
      logError('Error loading daily spending', e);
    }
    if (mounted.current && sequence === refreshSequence.current) setLoading(false);
  }, [start, end, enabled, cashOnly]);

  useAutoRefresh(refresh, enabled, autoLoad);

  return { data, loading, refresh };
}

export function useTopTransactions(
  startDate?: string,
  endDate?: string,
  limit: number = 3,
  options: TopTransactionsQueryOptions = {},
) {
  const [data, setData] = useState<ExpenseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useMounted();
  const refreshSequence = useRef(0);
  const enabled = options.enabled ?? true;
  const autoLoad = options.autoLoad ?? true;
  const selection = options.selection ?? 'overall';
  useEffect(() => {
    if (!enabled) {
      refreshSequence.current += 1;
      setLoading(false);
    }
  }, [enabled]);

  const start = startDate || getStartOfMonth();
  const end = endDate || getEndOfMonth();

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const sequence = ++refreshSequence.current;
    setLoading(true);
    try {
      const raw = await ExpenseDao.getTopTransactions(start, end, limit, selection);
      if (mounted.current && sequence === refreshSequence.current) setData(raw);
    } catch (e) {
      logError('Error loading top transactions', e);
    }
    if (mounted.current && sequence === refreshSequence.current) setLoading(false);
  }, [start, end, limit, selection, enabled]);

  useAutoRefresh(refresh, enabled, autoLoad);

  return { data, loading, refresh };
}

export function useBehavioralAnalytics(
  startDate?: string,
  endDate?: string,
  options: ExpenseQueryOptions = {},
) {
  const [needsWants, setNeedsWants] = useState<{ key: SpendSegment; segment: string; total: number; percentage: number; color: string }[]>([]);
  const [weekWeekend, setWeekWeekend] = useState<{ segment: string; total: number; percentage: number; color: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();
  const mounted = useMounted();
  const refreshSequence = useRef(0);
  const enabled = options.enabled ?? true;
  const autoLoad = options.autoLoad ?? true;
  useEffect(() => {
    if (!enabled) {
      refreshSequence.current += 1;
      setLoading(false);
    }
  }, [enabled]);
  const tRef = useRef(t);
  tRef.current = t;

  const start = startDate || getStartOfMonth();
  const end = endDate || getEndOfMonth();

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const sequence = ++refreshSequence.current;
    setLoading(true);
    const translate = tRef.current;
    try {
      const nwData = await ExpenseDao.getNeedsVsWants(start, end);
      const nwTotal = nwData.reduce((sum, item) => sum + item.total, 0);
      const mappedNW = nwData.map(item => ({
        key: item.segment,
        segment: translate(SPEND_SEGMENT_LABEL_KEY[item.segment]),
        total: item.total,
        percentage: nwTotal > 0 ? Math.round((item.total / nwTotal) * 100) : 0,
        color: SPEND_SEGMENT_COLOR[item.segment],
      }));
      if (mounted.current && sequence === refreshSequence.current) setNeedsWants(mappedNW);

      const wwData = await ExpenseDao.getWeekdayVsWeekend(start, end);
      const wwTotal = wwData.reduce((sum, item) => sum + item.total, 0);
      const mappedWW = wwData.map(item => {
        let localizedSegment = item.segment;
        if (item.segment === 'Hafta Sonu') localizedSegment = translate('weekend');
        if (item.segment === 'Hafta İçi') localizedSegment = translate('weekday');

        return {
          ...item,
          segment: localizedSegment,
          percentage: wwTotal > 0 ? Math.round((item.total / wwTotal) * 100) : 0,
          color: item.segment === 'Hafta Sonu' ? '#FF9F1C' : '#2EC4B6'
        };
      });
      if (mounted.current && sequence === refreshSequence.current) setWeekWeekend(mappedWW);
    } catch (e) {
      logError('Error loading behavioral analytics', e);
    }
    if (mounted.current && sequence === refreshSequence.current) setLoading(false);
  }, [start, end, enabled]);

  useAutoRefresh(refresh, enabled, autoLoad);

  return { needsWants, weekWeekend, loading, refresh };
}
