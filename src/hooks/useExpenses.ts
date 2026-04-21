import { useState, useEffect, useCallback, useRef } from 'react';
import { ExpenseDao } from '../db/expenseDao';
import { useLanguage } from '../i18n/LanguageContext';
import { ExpenseWithDetails, CategorySpending, VendorSpending } from '../db/schema';
import { getStartOfMonth, getEndOfMonth } from '../utils/dateUtils';

function useMounted() {
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  return mounted;
}

export function useExpenses(startDate?: string, endDate?: string) {
  const [expenses, setExpenses] = useState<ExpenseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useMounted();

  const start = startDate || getStartOfMonth();
  const end = endDate || getEndOfMonth();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ExpenseDao.getByDateRange(start, end);
      if (mounted.current) setExpenses(data);
    } catch (e) {
      console.error('Error loading expenses:', e);
    }
    if (mounted.current) setLoading(false);
  }, [start, end]);

  useEffect(() => { refresh(); }, [refresh]);

  return { expenses, loading, refresh };
}

export function useAllExpenses(limit: number = 100) {
  const [expenses, setExpenses] = useState<ExpenseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useMounted();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ExpenseDao.getAll(limit, 0);
      if (mounted.current) setExpenses(data);
    } catch (e) {
      console.error('Error loading all expenses:', e);
    }
    if (mounted.current) setLoading(false);
  }, [limit]);

  useEffect(() => { refresh(); }, [refresh]);

  return { expenses, loading, refresh };
}

// P9: İşlem listesinde tüm satırları tek seferde okuyup FlatList’e vermek yerine
// sayfalı çekim. İlk sayfa anında görünür, kullanıcı listeyi aşağı kaydırınca
// `loadMore` ile arka arkaya sayfalar eklenir. Arama, hâlihazırda yüklü satırlar
// üzerinde çalışır; kullanıcı yeni satırlara ulaşmak için kaydırmaya devam eder.
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
      const page = await ExpenseDao.getAll(pageSize, 0);
      if (!mounted.current) return;
      setItems(page);
      setHasMore(page.length >= pageSize);
    } catch (e) {
      console.error('[Expenses] refresh failed', e);
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
      console.error('[Expenses] loadMore failed', e);
    } finally {
      busyRef.current = false;
      if (mounted.current) setLoadingMore(false);
    }
  }, [pageSize, hasMore]);

  useEffect(() => { refresh(); }, [refresh]);

  return { items, loading, loadingMore, hasMore, loadMore, refresh };
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
      console.error('Error loading total:', e);
    }
    if (mounted.current) setLoading(false);
  }, [start, end]);

  useEffect(() => { refresh(); }, [refresh]);

  return { total, loading, refresh };
}

export function useCategorySpending(startDate?: string, endDate?: string) {
  const [data, setData] = useState<CategorySpending[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useMounted();

  const start = startDate || getStartOfMonth();
  const end = endDate || getEndOfMonth();

  const refresh = useCallback(async () => {
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
      if (mounted.current) setData(mapped);
    } catch (e) {
      console.error('Error loading category spending:', e);
    }
    if (mounted.current) setLoading(false);
  }, [start, end]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, refresh };
}

export function useSubcategorySpending(parentId: number | null, startDate?: string, endDate?: string) {
  const [data, setData] = useState<CategorySpending[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useMounted();

  const start = startDate || getStartOfMonth();
  const end = endDate || getEndOfMonth();

  const refresh = useCallback(async () => {
    if (!parentId) {
      setData([]);
      setLoading(false);
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
      if (mounted.current) setData(mapped);
    } catch (e) {
      console.error('Error loading subcategory spending:', e);
    }
    if (mounted.current) setLoading(false);
  }, [parentId, start, end]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, refresh };
}

export function useVendorSpending(startDate?: string, endDate?: string) {
  const [data, setData] = useState<VendorSpending[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useMounted();

  const start = startDate || getStartOfMonth();
  const end = endDate || getEndOfMonth();

  const refresh = useCallback(async () => {
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
      if (mounted.current) setData(mapped);
    } catch (e) {
      console.error('Error loading vendor spending:', e);
    }
    if (mounted.current) setLoading(false);
  }, [start, end]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, refresh };
}

export function useDailySpending(startDate?: string, endDate?: string) {
  const [data, setData] = useState<{ date: string; total: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useMounted();

  const start = startDate || getStartOfMonth();
  const end = endDate || getEndOfMonth();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await ExpenseDao.getSpendingByDays(start, end);
      
      const result = [];
      const currentDate = new Date(start + 'T12:00:00Z');
      const lastDate = new Date(end + 'T12:00:00Z');
      
      const diffTime = Math.abs(lastDate.getTime() - currentDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 60) {
        if (mounted.current) { setData(raw); setLoading(false); }
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
      
      if (mounted.current) setData(result);
    } catch (e) {
      console.error('Error loading daily spending:', e);
    }
    if (mounted.current) setLoading(false);
  }, [start, end]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, refresh };
}

export function useTopTransactions(startDate?: string, endDate?: string, limit: number = 3) {
  const [data, setData] = useState<ExpenseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useMounted();

  const start = startDate || getStartOfMonth();
  const end = endDate || getEndOfMonth();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await ExpenseDao.getTopTransactions(start, end, limit);
      if (mounted.current) setData(raw);
    } catch (e) {
      console.error('Error loading top transactions:', e);
    }
    if (mounted.current) setLoading(false);
  }, [start, end, limit]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, refresh };
}

export function useBehavioralAnalytics(startDate?: string, endDate?: string) {
  const [needsWants, setNeedsWants] = useState<{ segment: string; total: number; percentage: number; color: string }[]>([]);
  const [weekWeekend, setWeekWeekend] = useState<{ segment: string; total: number; percentage: number; color: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();
  const mounted = useMounted();
  const tRef = useRef(t);
  tRef.current = t;

  const start = startDate || getStartOfMonth();
  const end = endDate || getEndOfMonth();

  const refresh = useCallback(async () => {
    setLoading(true);
    const translate = tRef.current;
    try {
      const nwData = await ExpenseDao.getNeedsVsWants(start, end);
      const nwTotal = nwData.reduce((sum, item) => sum + item.total, 0);
      const mappedNW = nwData.map(item => {
        let localizedSegment = item.segment;
        if (item.segment === 'Zorunlu İhtiyaçlar') localizedSegment = translate('needs');
        if (item.segment === 'Keyfi Harcamalar') localizedSegment = translate('wants');
        if (item.segment === 'Tasarruf / Diğer') localizedSegment = translate('savings_other');

        return {
          ...item,
          segment: localizedSegment,
          percentage: nwTotal > 0 ? Math.round((item.total / nwTotal) * 100) : 0,
          color: item.segment === 'Zorunlu İhtiyaçlar' ? '#FF6B6B' : item.segment === 'Keyfi Harcamalar' ? '#4ECDC4' : '#FFE66D'
        };
      });
      if (mounted.current) setNeedsWants(mappedNW);

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
      if (mounted.current) setWeekWeekend(mappedWW);
    } catch (e) {
      console.error('Error loading behavioral analytics:', e);
    }
    if (mounted.current) setLoading(false);
  }, [start, end]);

  useEffect(() => { refresh(); }, [refresh]);

  return { needsWants, weekWeekend, loading, refresh };
}
