// S.P.A.R.K. — Budget Data Access Object
import { getDatabase } from './database';
import { Budget } from './schema';
import {
  getCycleForKey,
  getCycleForYmd,
  normalizeCycleStartDay,
} from '../utils/budgetCycle';

function parseYmd(value: string): [number, number, number] {
  const [year, month, day] = value.split('-').map(Number);
  return [year, month, day];
}

function previousYmd(value: string): string {
  const [year, month, day] = parseYmd(value);
  const utc = new Date(Date.UTC(year, month - 1, day - 1));
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, '0')}-${String(utc.getUTCDate()).padStart(2, '0')}`;
}

export const BudgetDao = {
  // Get active budget for a specific month (format: 'YYYY-MM')
  async getForMonth(month: string): Promise<Budget | null> {
    const db = await getDatabase();
    return db.getFirstAsync<Budget>(
      'SELECT * FROM budgets WHERE substr(start_date, 1, 7) = ? AND active = 1 ORDER BY id DESC LIMIT 1',
      [month]
    );
  },

  /** Verilen gerçek takvim gününü kapsayan dondurulmuş bütçe dönemi. */
  async getContainingDate(date: string): Promise<Budget | null> {
    const db = await getDatabase();
    return db.getFirstAsync<Budget>(
      `SELECT * FROM budgets
       WHERE active = 1 AND period_start <= ? AND period_end >= ?
       ORDER BY period_start DESC, id DESC LIMIT 1`,
      [date, date],
    );
  },

  // Fallback to latest active budget if current month has none
  async getLatestActive(): Promise<Budget | null> {
    const db = await getDatabase();
    return db.getFirstAsync<Budget>(
      'SELECT * FROM budgets WHERE active = 1 ORDER BY start_date DESC LIMIT 1'
    );
  },

  // Set budget for a specific month
  async setMonthlyBudget(
    amount: number,
    month: string,
    currency: string = 'PLN',
    cycleStartDay: number = 1,
  ): Promise<number> {
    const db = await getDatabase();
    const previous = await db.getFirstAsync<Budget>(
      'SELECT * FROM budgets WHERE substr(start_date, 1, 7) = ? AND active = 1 ORDER BY id DESC LIMIT 1',
      [month],
    );
    const fallback = getCycleForKey(cycleStartDay, month);
    const periodStart = previous?.period_start ?? fallback.start;
    const periodEnd = previous?.period_end ?? fallback.end;
    const snapshotDay = previous?.cycle_start_day ?? normalizeCycleStartDay(cycleStartDay);

    let insertedId = 0;
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        'UPDATE budgets SET active = 0 WHERE period_start = ? AND active = 1',
        [periodStart],
      );
      const result = await db.runAsync(
        `INSERT INTO budgets
          (monthly_amount, currency, start_date, period_start, period_end, cycle_start_day, active)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [amount, currency, month, periodStart, periodEnd, snapshotDay],
      );
      insertedId = Number(result.lastInsertRowId);
    });
    return insertedId;
  },

  /**
   * Döngü günü değişikliğini bugün yürürlüğe alır: eski açık dönem dün kapanır,
   * yeni dönem bugün başlar. Geçmiş dönemlerin sınırlarına dokunulmaz.
   */
  async transitionAndSetBudget(input: {
    amount: number;
    currency: string;
    previousStartDay: number;
    nextStartDay: number;
    effectiveDate: string;
  }): Promise<number> {
    const db = await getDatabase();
    const nextStartDay = normalizeCycleStartDay(input.nextStartDay);
    const [year, month, day] = parseYmd(input.effectiveDate);
    const naturalNextCycle = getCycleForYmd(nextStartDay, year, month - 1, day);
    const periodStart = input.effectiveDate;
    const periodEnd = naturalNextCycle.end;
    const monthKey = periodStart.slice(0, 7);
    let insertedId = 0;

    await db.withTransactionAsync(async () => {
      const current = await db.getFirstAsync<Budget>(
        `SELECT * FROM budgets
         WHERE active = 1 AND period_start <= ? AND period_end >= ?
         ORDER BY period_start DESC, id DESC LIMIT 1`,
        [periodStart, periodStart],
      );
      if (current?.period_start && current.period_start < periodStart) {
        await db.runAsync('UPDATE budgets SET period_end = ? WHERE id = ?', [
          previousYmd(periodStart),
          current.id,
        ]);
      } else if (current?.period_start === periodStart) {
        await db.runAsync('UPDATE budgets SET active = 0 WHERE id = ?', [current.id]);
      }

      await db.runAsync(
        'UPDATE budgets SET active = 0 WHERE period_start = ? AND active = 1',
        [periodStart],
      );
      const result = await db.runAsync(
        `INSERT INTO budgets
          (monthly_amount, currency, start_date, period_start, period_end, cycle_start_day, active)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [input.amount, input.currency, monthKey, periodStart, periodEnd, nextStartDay],
      );
      insertedId = Number(result.lastInsertRowId);
      await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
        'budget_cycle_start_day',
        String(nextStartDay),
      ]);
    });
    return insertedId;
  },

  // Get all months that have a budget set (for history view)
  async getAllBudgets(): Promise<Budget[]> {
    const db = await getDatabase();
    return db.getAllAsync<Budget>(
      'SELECT * FROM budgets WHERE active = 1 ORDER BY COALESCE(period_start, start_date) DESC, id DESC'
    );
  },
};
