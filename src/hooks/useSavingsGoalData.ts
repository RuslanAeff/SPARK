// S.P.A.R.K. — Birikim hedefi + kategori limitleri (mevcut ay)
import { useState, useEffect, useCallback } from 'react';
import { GoalDao, SavingsGoalRow } from '../db/goalDao';
import { CategoryLimitDao, CategoryLimitRow } from '../db/categoryLimitDao';
import { CategoryDao } from '../db/categoryDao';
import { ExpenseDao } from '../db/expenseDao';
import { getStartOfMonth, getEndOfMonth } from '../utils/dateUtils';
import { getGoalFeatureEnabled } from '../services/goalFeatureSettings';

export function useSavingsGoal() {
  const [goal, setGoal] = useState<SavingsGoalRow | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
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

function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function useCategoryLimitsProgress(startDate?: string, endDate?: string) {
  const [rows, setRows] = useState<CategoryLimitProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const start = startDate || getStartOfMonth();
  const end = endDate || getEndOfMonth();

  const refresh = useCallback(async () => {
    const m = monthKey();
    setLoading(true);
    try {
      const limits = await CategoryLimitDao.getForMonth(m);

      // P1: Tüm kategorileri tek sorguda ön-yükle → O(1) lookup
      const allCategories = await CategoryDao.getAll();
      const catMap = new Map(allCategories.map(c => [c.id, c]));

      // Harcamaları paralel hesapla
      const spentPromises = limits.map(lim =>
        ExpenseDao.getSpentForCategoryInRange(lim.category_id, start, end)
      );
      const spentResults = await Promise.all(spentPromises);

      const out: CategoryLimitProgress[] = [];
      for (let i = 0; i < limits.length; i++) {
        const lim = limits[i];
        const cat = catMap.get(lim.category_id);
        if (!cat) continue;
        const spent = spentResults[i];
        const over = Math.max(0, spent - lim.limit_amount);
        const rem = Math.max(0, lim.limit_amount - spent);
        out.push({
          id: lim.id,
          category_id: lim.category_id,
          category_name: cat.name,
          category_icon: cat.icon,
          category_color: cat.color,
          limit_amount: lim.limit_amount,
          spent,
          remaining: rem,
          over_by: over,
        });
      }
      setRows(out);
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { rows, loading, refresh };
}

export function useGoalFeatureEnabled() {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setEnabled(await getGoalFeatureEnabled());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { enabled, loading, refresh };
}
