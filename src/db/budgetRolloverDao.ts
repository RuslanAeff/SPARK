import * as Crypto from 'expo-crypto';
import { getDatabase } from './database';
import type { Budget, BudgetRollover } from './schema';
import { BudgetDao } from './budgetDao';
import { ExpenseDao } from './expenseDao';
import { DebtDao } from './debtDao';
import { IncomeDao } from './incomeDao';
import { getToday } from '../utils/dateUtils';
import { sanitizeAmount, sanitizeDate } from '../utils/inputValidation';
import { fromMinorUnits, toMinorUnits, sumMoney, subtractMoney } from '../utils/moneyMath';
import { computeDebtAdjustedBudget } from '../utils/debtMath';

export function previousDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

export interface RolloverStatus {
  incoming: number;
  outgoing: number;
  periodRemaining: number;
  unallocated: number;
  needsReview: boolean;
  records: BudgetRollover[];
}

// Serialize read/validate/write sequences, including rapid repeat submissions.
let writeQueue: Promise<unknown> = Promise.resolve();
function serialize<T>(work: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(work, work);
  writeQueue = next.catch(() => undefined);
  return next;
}

export const BudgetRolloverDao = {
  async effectiveAmount(budget: Budget | null, start: string, end: string): Promise<number> {
    const borrowedIn = await DebtDao.getBorrowedTotalByDateRange(start, end);
    const repaidIn = await DebtDao.getRepaidTotalByDateRange(start, end);
    const extraIncomeIn = await IncomeDao.getTotalByDateRange(start, end);
    const { incoming } = await BudgetRolloverDao.totals(start, end, budget?.currency ?? 'PLN');
    return computeDebtAdjustedBudget({ monthlyBudget: budget?.monthly_amount ?? 0, totalSpent: 0,
      borrowedIn, repaidIn, extraIncomeIn, carryIn: incoming }).effectiveBudget;
  },
  async list(): Promise<BudgetRollover[]> {
    return (await getDatabase()).getAllAsync<BudgetRollover>('SELECT * FROM budget_rollovers ORDER BY source_start, uid');
  },

  async totals(start: string, end: string, currency: string) {
    const rows = await BudgetRolloverDao.list();
    const incoming = sumMoney(rows.filter(r => r.target_start === start && r.target_end === end && r.currency === currency).map(r => fromMinorUnits(r.amount_minor)));
    const outgoing = sumMoney(rows.filter(r => r.source_start === start && r.source_end === end && r.currency === currency).map(r => fromMinorUnits(r.amount_minor)));
    return { incoming, outgoing };
  },

  async status(budget: Budget): Promise<RolloverStatus> {
    const rows = await BudgetRolloverDao.list();
    const budgets = await BudgetDao.getAllBudgets();
    const balances = new Map<string, number>();
    const find = (start: string, end: string, currency: string) => {
      const overlapping = budgets.filter(b => b.period_start && b.period_end && b.period_start <= end && b.period_end >= start);
      return overlapping.length === 1 && overlapping[0].period_start === start
        && overlapping[0].period_end === end && overlapping[0].currency === currency ? overlapping[0] : null;
    };
    const balance = async (b: Budget) => {
      const key = `${b.period_start}:${b.period_end}:${b.currency}`;
      if (balances.has(key)) return balances.get(key)!;
      const start = b.period_start!; const end = b.period_end!;
      const spent = await ExpenseDao.getTotalByDateRange(start, end);
      const borrowed = await DebtDao.getBorrowedTotalByDateRange(start, end);
      const repaid = await DebtDao.getRepaidTotalByDateRange(start, end);
      const income = await IncomeDao.getTotalByDateRange(start, end);
      const incoming = sumMoney(rows.filter(r => r.target_start === start && r.target_end === end && r.currency === b.currency).map(r => fromMinorUnits(r.amount_minor)));
      const remaining = computeDebtAdjustedBudget({ monthlyBudget: b.monthly_amount, totalSpent: spent,
        borrowedIn: borrowed, repaidIn: repaid, extraIncomeIn: income, carryIn: incoming }).remaining;
      balances.set(key, remaining);
      return remaining;
    };
    // Walk ancestors in date order: an overdrawn earlier transfer must also be
    // visible downstream, rather than allowing it to be forwarded indefinitely.
    const affected = new Set([`${budget.period_start}:${budget.period_end}`]);
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i];
      if (affected.has(`${r.target_start}:${r.target_end}`)) affected.add(`${r.source_start}:${r.source_end}`);
    }
    let needsReview = false;
    for (const r of rows) {
      if (!affected.has(`${r.source_start}:${r.source_end}`) && !affected.has(`${r.target_start}:${r.target_end}`)) continue;
      const source = find(r.source_start, r.source_end, r.currency);
      const target = find(r.target_start, r.target_end, r.currency);
      if (!source || !target || toMinorUnits(await balance(source)) < r.amount_minor) needsReview = true;
    }
    const records = rows.filter(r => (r.source_start === budget.period_start && r.source_end === budget.period_end)
      || (r.target_start === budget.period_start && r.target_end === budget.period_end));
    const incoming = sumMoney(records.filter(r => r.target_start === budget.period_start && r.currency === budget.currency).map(r => fromMinorUnits(r.amount_minor)));
    const outgoing = sumMoney(records.filter(r => r.source_start === budget.period_start && r.currency === budget.currency).map(r => fromMinorUnits(r.amount_minor)));
    const periodRemaining = budget.period_start && budget.period_end ? await balance(budget) : 0;
    return { incoming, outgoing, periodRemaining, unallocated: subtractMoney(periodRemaining, outgoing), needsReview, records };
  },

  /** Set the TOTAL transferred, never increment it. Zero explicitly reverses it. */
  async save(sourceId: number, targetId: number, amount: number): Promise<void> {
    if (!Number.isFinite(amount) || amount < 0 || sanitizeAmount(amount) !== amount) throw new Error('rollover_invalid_amount');
    return serialize(async () => {
      const db = await getDatabase();
      await db.withTransactionAsync(async () => {
        const source = await db.getFirstAsync<Budget>('SELECT * FROM budgets WHERE id = ? AND active = 1', [sourceId]);
        const target = await db.getFirstAsync<Budget>('SELECT * FROM budgets WHERE id = ? AND active = 1', [targetId]);
        if (!source?.period_start || !source.period_end || !target?.period_start || !target.period_end
          || !sanitizeDate(source.period_start) || !sanitizeDate(target.period_start)
          || source.period_end !== previousDay(target.period_start)
          || source.currency !== target.currency) throw new Error('rollover_unavailable');
        const existing = (await BudgetRolloverDao.list()).find(r => r.source_start === source.period_start && r.source_end === source.period_end);
        if (existing && (existing.target_start !== target.period_start || existing.target_end !== target.period_end)) throw new Error('rollover_unavailable');
        if (amount === 0) {
          if (existing) await db.runAsync('DELETE FROM budget_rollovers WHERE uid = ?', [existing.uid]);
          return;
        }
        const today = getToday();
        if (target.period_start > today || target.period_end < today || source.period_end >= today) throw new Error('rollover_unavailable');
        const status = await BudgetRolloverDao.status(source);
        // An existing outgoing deficit can be repaired by reducing this amount.
        const incomingRecords = status.records.filter(r => r.target_start === source.period_start);
        for (const r of incomingRecords) {
          const parent = await BudgetDao.getContainingDate(r.source_start);
          if (!parent || (await BudgetRolloverDao.status(parent)).needsReview) throw new Error('rollover_review');
        }
        const all = await BudgetDao.getAllBudgets();
        for (const b of [source, target]) {
          if (all.filter(x => x.period_start && x.period_end && x.period_start <= b.period_end! && x.period_end >= b.period_start!).length !== 1) throw new Error('rollover_unavailable');
        }
        if (toMinorUnits(amount) > toMinorUnits(status.periodRemaining)) throw new Error('rollover_invalid_amount');
        const timestamp = new Date().toISOString();
        await db.runAsync(`INSERT INTO budget_rollovers
          (uid, source_start, source_end, target_start, target_end, currency, amount_minor, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(source_start, source_end) DO UPDATE SET amount_minor = excluded.amount_minor, updated_at = excluded.updated_at`,
        [existing?.uid ?? Crypto.randomUUID(), source.period_start, source.period_end, target.period_start,
          target.period_end, source.currency, toMinorUnits(amount), existing?.created_at ?? timestamp, timestamp]);
      });
    });
  },
};
