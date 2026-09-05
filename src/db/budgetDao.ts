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

  /**
   * Verilen gerçek takvim gününü kapsayan dondurulmuş bütçe dönemi.
   *
   * Eski sürümlerden çakışan satır kalmışsa "son yazılan kazanır" kuralı
   * uygulanır (en yüksek id). Bu sıralama `findShadowedBudgetIds` ile aynıdır;
   * böylece Dashboard, Analiz, bildirimler ve geçmiş şeridi aynı satırı yetkili
   * sayar ve ekranlar birbiriyle çelişmez.
   */
  async getContainingDate(date: string): Promise<Budget | null> {
    const db = await getDatabase();
    return db.getFirstAsync<Budget>(
      `SELECT * FROM budgets
       WHERE active = 1 AND period_start <= ? AND period_end >= ?
       ORDER BY id DESC LIMIT 1`,
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

  /**
   * ADR-008 değişmezinin TEK yazma giriş noktası: hedef dönemle kesişen bütün
   * aktif satırlar aynı transaction içinde pasife çekilir, ardından yeni kayıt
   * yazılır. Böylece bir takvim gününü iki aktif dönem kapsayamaz ve aynı
   * harcama iki bütçede sayılmaz. Harcama satırlarına dokunulmaz.
   *
   * `start_date` her zaman dönemin BAŞLADIĞI aydır; seçilen navigatör ayı değil.
   * Bu, döngü günü 1 dışındayken iki farklı "ay" kavramının karışmasını önler.
   */
  async setBudgetForPeriod(input: {
    amount: number;
    currency: string;
    periodStart: string;
    periodEnd: string;
    cycleStartDay: number;
  }): Promise<number> {
    const db = await getDatabase();
    const snapshotDay = normalizeCycleStartDay(input.cycleStartDay);
    let insertedId = 0;
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE budgets SET active = 0
          WHERE active = 1
            AND period_start IS NOT NULL AND period_end IS NOT NULL
            AND period_start <= ? AND period_end >= ?`,
        [input.periodEnd, input.periodStart],
      );
      const result = await db.runAsync(
        `INSERT INTO budgets
          (monthly_amount, currency, start_date, period_start, period_end, cycle_start_day, active)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [
          input.amount,
          input.currency,
          input.periodStart.slice(0, 7),
          input.periodStart,
          input.periodEnd,
          snapshotDay,
        ],
      );
      insertedId = Number(result.lastInsertRowId);
    });
    return insertedId;
  },

  /**
   * Bütçe hedefini kaldırır; dönem "bütçesiz" görünür. Harcama kayıtları ve
   * tarihsel toplamlar korunur — silinen yalnız o dönemin hedefidir.
   */
  async deleteBudget(id: number): Promise<number> {
    const db = await getDatabase();
    const result = await db.runAsync('DELETE FROM budgets WHERE id = ?', [id]);
    return Number(result.changes ?? 0);
  },

  // Set budget for a specific month
  async setMonthlyBudget(
    amount: number,
    month: string,
    currency: string = 'PLN',
    cycleStartDay: number = 1,
  ): Promise<number> {
    const previous = await BudgetDao.getForMonth(month);
    // Dondurulmuş sınırlar korunur: geçmiş bir dönem, bugünkü global döngü
    // gününe göre yeniden yorumlanmaz (ADR-008).
    const fallback = getCycleForKey(cycleStartDay, month);
    return BudgetDao.setBudgetForPeriod({
      amount,
      currency,
      periodStart: previous?.period_start ?? fallback.start,
      periodEnd: previous?.period_end ?? fallback.end,
      cycleStartDay: previous?.cycle_start_day ?? cycleStartDay,
    });
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
        // Geçmiş korunur: eski dönem dün kapanır, sınırları silinmez.
        await db.runAsync('UPDATE budgets SET period_end = ? WHERE id = ?', [
          previousYmd(periodStart),
          current.id,
        ]);
      } else if (current?.period_start === periodStart) {
        await db.runAsync('UPDATE budgets SET active = 0 WHERE id = ?', [current.id]);
      }

      // Kısaltmadan sonra kalan her kesişim de kapatılır. Yalnız `period_start`
      // birebir eşleşenleri kapatmak yetmiyordu: farklı başlayıp üst üste binen
      // satırlar aktif kalıp aynı günü iki bütçenin kapsamasına yol açıyordu.
      await db.runAsync(
        `UPDATE budgets SET active = 0
          WHERE active = 1
            AND period_start IS NOT NULL AND period_end IS NOT NULL
            AND period_start <= ? AND period_end >= ?`,
        [periodEnd, periodStart],
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
