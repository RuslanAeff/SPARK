// S.P.A.R.K. — Kategori limiti dönemi (BUG-22)
//
// Limitler bütçe döngüsüne bağlıdır: anahtar = döngünün başladığı ay (YYYY-MM),
// harcama aralığı = döngünün [start, end] günleri. Limit ayarı, Dashboard,
// Analiz ve bildirim motoru dönemi YALNIZ buradan çözer. Yeni döngüde limitler
// devralınmaz (ürün kararı B); kullanıcı o döngü için yeniden girer.
import { BudgetDao } from '../db/budgetDao';
import type { Budget } from '../db/schema';
import { getCycleStartDay } from './budgetCycleSettings';
import { cycleForDate, type BudgetCycle } from '../utils/budgetCycle';
import { getToday } from '../utils/dateUtils';

export interface ResolvedBudgetCycle {
  cycle: BudgetCycle;
  /** Günü kapsayan aktif bütçe satırı (yoksa null). */
  budget: Budget | null;
}

/** ADR-002: iki okuma sırayla yapılır. */
export async function resolveBudgetCycle(date: string = getToday()): Promise<ResolvedBudgetCycle> {
  const anchor = await getCycleStartDay();
  const budget = await BudgetDao.getContainingDate(date);
  return { cycle: cycleForDate(anchor, date, budget), budget };
}
