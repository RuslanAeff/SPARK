// S.P.A.R.K. — Budget Calculation Hook
import { useState, useEffect, useCallback, useRef } from 'react';
import { BudgetDao } from '../db/budgetDao';
import { ExpenseDao } from '../db/expenseDao';
import { getStartOfMonth, getEndOfMonth, getDaysInMonth, getDayOfMonth } from '../utils/dateUtils';

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
  });
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // Determine the month to query (YYYY-MM format)
      // getStartOfMonth returns 'YYYY-MM-DD', we just take 'YYYY-MM'
      const startOfM = getStartOfMonth();
      const currentMonthStr = specificMonth || startOfM.substring(0, 7);
      
      let activeBudget = await BudgetDao.getForMonth(currentMonthStr);
      
      // Fallback: If no budget set for this month, try to get the most recent one 
      // as a template, but maybe we just default to 0 to prompt user.
      if (!activeBudget) {
        activeBudget = await BudgetDao.getLatestActive();
        // If we want it strictly per month, we could set amount to 0
        // but keeping the last budget as a fallback is a nicer UX.
      }

      const budgetAmount = activeBudget ? activeBudget.monthly_amount : 0;
      const budgetCurrency = activeBudget ? activeBudget.currency : 'PLN';

      // Spendings for the requested month
      // Build start/end dynamically if specificMonth is given
      let startRange = startOfM;
      let endRange = getEndOfMonth();
      let daysInM = getDaysInMonth();
      let currentDay = getDayOfMonth();
      
      if (specificMonth) {
        // Compute for that specific month
        const dateObj = new Date(`${specificMonth}-01T12:00:00Z`);
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth() + 1;
        const paddedMonth = month.toString().padStart(2, '0');
        
        startRange = `${year}-${paddedMonth}-01`;
        
        // End of month
        const nextMonthStr = month === 12 ? `${year + 1}-01-01` : `${year}-${(month + 1).toString().padStart(2, '0')}-01`;
        const endObj = new Date(new Date(`${nextMonthStr}T12:00:00Z`).getTime() - 86400000);
        endRange = endObj.toISOString().split('T')[0];
        
        daysInM = endObj.getDate();
        
        // If the specific month is not the current month, we evaluate it statically
        const todayMonthStr = new Date().toISOString().substring(0, 7);
        if (specificMonth !== todayMonthStr) {
          // It's a past or future month, we assume full month passed or 0 days passed
          currentDay = specificMonth < todayMonthStr ? daysInM : 0;
        }
      }

      const totalSpent = await ExpenseDao.getTotalByDateRange(startRange, endRange);
      const daysRemaining = Math.max(0, daysInM - currentDay);
      
      const remaining = budgetAmount - totalSpent;
      const percentage = budgetAmount > 0 
        ? Math.min(100, Math.round((totalSpent / budgetAmount) * 100))
        : 0;
      
      const dailyAverage = currentDay > 0 ? totalSpent / currentDay : 0;
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
