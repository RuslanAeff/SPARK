// S.P.A.R.K. — Budget Calculation Hook
// Bütçe dönemi takvim ayı DEĞİL, kullanıcının seçtiği "döngü başlangıç günü"ne
// göre hesaplanır (src/utils/budgetCycle.ts). anchor=1'de döngü = takvim ayı,
// yani eski davranış birebir korunur.
import { useState, useEffect, useCallback, useRef } from 'react';
import { BudgetDao } from '../db/budgetDao';
import { ExpenseDao } from '../db/expenseDao';
import { getCycleStartDay } from '../services/budgetCycleSettings';
import { getCurrentCycle, getCycleForKey, getCycleProgress } from '../utils/budgetCycle';

export interface BudgetInfo {
  monthlyBudget: number;
  totalSpent: number;
  remaining: number;
  percentage: number;         // 0-100 spent percentage
  dailyAverage: number;       // average daily spending
  dailyBudget: number;        // ideal daily budget
  daysRemaining: number;
  isOverBudget: boolean;
  currency: string;
  /** Geçerli döngünün ilk günü (YYYY-MM-DD). */
  periodStart: string;
  /** Geçerli döngünün son günü (YYYY-MM-DD). */
  periodEnd: string;
  /** Aktif döngü başlangıç günü (1–31). 1 = takvim ayı. */
  cycleStartDay: number;
}

export function useBudget(specificMonth?: string) {
  const [budget, setBudget] = useState<BudgetInfo>({
    monthlyBudget: 0,
    totalSpent: 0,
    remaining: 0,
    percentage: 0,
    dailyAverage: 0,
    dailyBudget: 0,
    daysRemaining: 0,
    isOverBudget: false,
    currency: 'PLN',
    periodStart: '',
    periodEnd: '',
    cycleStartDay: 1,
  });
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const anchor = await getCycleStartDay();
      const currentCycle = getCurrentCycle(anchor);
      // specificMonth verilirse o döngü anahtarını (YYYY-MM = döngü başlangıç ayı) çöz.
      const cycle = specificMonth ? getCycleForKey(anchor, specificMonth) : currentCycle;
      const isCurrent = cycle.key === currentCycle.key;

      // Bütçe tutarı döngünün başladığı ay anahtarıyla saklanır.
      let activeBudget = await BudgetDao.getForMonth(cycle.key);
      if (!activeBudget) {
        // Bu döngü için bütçe yoksa en son aktif bütçeyi şablon olarak kullan (daha iyi UX).
        activeBudget = await BudgetDao.getLatestActive();
      }

      const budgetAmount = activeBudget ? activeBudget.monthly_amount : 0;
      const budgetCurrency = activeBudget ? activeBudget.currency : 'PLN';

      const totalSpent = await ExpenseDao.getTotalByDateRange(cycle.start, cycle.end);

      // Döngü içindeki ilerleme: güncel döngüde bugüne göre; geçmiş döngüde tam
      // dolmuş, gelecek döngüde hiç başlamamış kabul edilir.
      let dayOfCycle: number;
      let daysRemaining: number;
      if (isCurrent) {
        ({ dayOfCycle, daysRemaining } = getCycleProgress(cycle));
      } else if (cycle.key < currentCycle.key) {
        dayOfCycle = cycle.totalDays;
        daysRemaining = 0;
      } else {
        dayOfCycle = 0;
        daysRemaining = cycle.totalDays;
      }

      const remaining = budgetAmount - totalSpent;
      const percentage = budgetAmount > 0
        ? Math.min(100, Math.round((totalSpent / budgetAmount) * 100))
        : 0;

      const dailyAverage = dayOfCycle > 0 ? totalSpent / dayOfCycle : 0;
      const dailyBudget = daysRemaining > 0 ? Math.max(0, remaining) / daysRemaining : 0;

      if (mounted.current) {
        setBudget({
          monthlyBudget: budgetAmount,
          totalSpent,
          remaining,
          percentage,
          dailyAverage,
          dailyBudget,
          daysRemaining,
          isOverBudget: remaining < 0,
          currency: budgetCurrency,
          periodStart: cycle.start,
          periodEnd: cycle.end,
          cycleStartDay: anchor,
        });
      }
    } catch (e) {
      console.error('Error loading budget:', e);
    }
    if (mounted.current) setLoading(false);
  }, [specificMonth]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { budget, loading, refresh };
}
