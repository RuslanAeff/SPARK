// S.P.A.R.K. — Birikim hedefi + kategori limitleri (bütçe döngüsü)
import { useState, useEffect, useCallback, useRef } from 'react';
import { GoalDao, SavingsGoalRow } from '../db/goalDao';
import { CategoryLimitDao } from '../db/categoryLimitDao';
import { resolveBudgetCycle } from '../services/limitCycle';
import { getGoalFeaturePreferences } from '../services/goalFeatureSettings';
import { logError } from '../utils/logError';

export function useSavingsGoal() {
  const [goal, setGoal] = useState<SavingsGoalRow | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const g = await GoalDao.get();
      setGoal(g);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { goal, loading, refresh };
}

export interface CategoryLimitProgress {
  id: number;
  category_id: number;
  category_name: string;
  category_icon: string;
  category_color: string;
  limit_amount: number;
  spent: number;
  remaining: number;
  over_by: number;
}

/**
 * BUG-22: Limitler bütçe döngüsüne bağlıdır. Dashboard seçili döngünün
 * dondurulmuş sınırlarını verir; anahtar = döngünün başladığı ay (start'ın
 * YYYY-MM'i). Sınır verilmezse (ilk render) bugünü kapsayan döngü çözülür —
 * takvim ayına düşülmez, yoksa limit ayarıyla farklı satır okunurdu.
 */
export function useCategoryLimitsProgress(startDate?: string, endDate?: string) {
  const [rows, setRows] = useState<CategoryLimitProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  const refreshSequence = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    const isCurrent = () => mounted.current && sequence === refreshSequence.current;
    setLoading(true);
    try {
      // PERF-03: limit + kategori + aralık harcaması (alt kategoriler dahil) TEK
      // sorguda; eskiden limit başına 2 sorgu + tüm kategoriler okunuyordu.
      // Analiz ekranıyla aynı fonksiyon → aynı sayım kuralı.
      let start = startDate;
      let end = endDate;
      if (!start || !end) {
        ({ start, end } = (await resolveBudgetCycle()).cycle);
      }
      const limits = await CategoryLimitDao.getForMonthWithSpending(start.slice(0, 7), start, end);

      const out: CategoryLimitProgress[] = limits.map(lim => ({
        id: lim.id,
        category_id: lim.category_id,
        category_name: lim.category_name,
        category_icon: lim.category_icon,
        category_color: lim.category_color,
        limit_amount: lim.limit_amount,
        spent: lim.spent,
        remaining: Math.max(0, lim.limit_amount - lim.spent),
        over_by: Math.max(0, lim.spent - lim.limit_amount),
      }));
      if (isCurrent()) setRows(out);
    } catch (error) {
      // Yenileme çağıranlar beklemeden tetikliyor; reddi yutup son veriyi koruyoruz.
      logError('useCategoryLimitsProgress refresh failed', error);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { rows, loading, refresh };
}

export function useGoalFeatureEnabled() {
  const [enabled, setEnabled] = useState(true);
  const [dashboardFocusEnabled, setDashboardFocusEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const preferences = await getGoalFeaturePreferences();
      setEnabled(preferences.enabled);
      setDashboardFocusEnabled(preferences.dashboardFocusEnabled);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { enabled, dashboardFocusEnabled, loading, refresh };
}
