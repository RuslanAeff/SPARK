// S.P.A.R.K. — Budget Data Access Object
import { getDatabase } from './database';
import { Budget } from './schema';
import {
  getCycleForYmd,
  normalizeCycleStartDay,
} from '../utils/budgetCycle';
import { previewBudgetCycleTransition } from '../utils/budgetCycleTransition';
import { sanitizeAmount, sanitizeDate } from '../utils/inputValidation';

function parseYmd(value: string): [number, number, number] {
  const [year, month, day] = value.split('-').map(Number);
  return [year, month, day];
}

export const BudgetDao = {
  async getById(id: number): Promise<Budget | null> {
    const db = await getDatabase();
    return db.getFirstAsync<Budget>('SELECT * FROM budgets WHERE id = ? AND active = 1', [id]);
  },

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

  async getLatestAtOrBefore(date: string): Promise<Budget | null> {
    const db = await getDatabase();
    return db.getFirstAsync<Budget>(
      `SELECT * FROM budgets WHERE active = 1
       AND COALESCE(period_start, start_date || '-01') <= ?
       ORDER BY COALESCE(period_start, start_date || '-01') DESC, id DESC LIMIT 1`,
      [date],
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
    const safeAmount = sanitizeAmount(input.amount, -1);
    const periodStart = sanitizeDate(input.periodStart);
    const periodEnd = sanitizeDate(input.periodEnd);
    const safeCurrency = String(input.currency ?? '').trim().toUpperCase();
    if (safeAmount <= 0 || safeAmount !== input.amount) throw new Error('budget_invalid_amount');
    if (!periodStart || !periodEnd || periodStart > periodEnd) throw new Error('budget_repair_invalid_dates');
    if (!/^[A-Z]{3}$/.test(safeCurrency)) throw new Error('budget_invalid_currency');
    const db = await getDatabase();
    const snapshotDay = normalizeCycleStartDay(input.cycleStartDay);
    let insertedId = 0;
    await db.withTransactionAsync(async () => {
      await assertRolloverPeriodEditable(db, periodStart, periodEnd, safeCurrency);
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
        [
          safeAmount,
          safeCurrency,
          periodStart.slice(0, 7),
          periodStart,
          periodEnd,
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
    let changes = 0;
    await db.withTransactionAsync(async () => {
      const linked = await db.getFirstAsync<{ uid: string }>(`SELECT r.uid FROM budget_rollovers r JOIN budgets b ON b.id = ?
        WHERE (b.period_start = r.source_start AND b.period_end = r.source_end)
           OR (b.period_start = r.target_start AND b.period_end = r.target_end) LIMIT 1`, [id]);
      if (linked?.uid) throw new Error('rollover_period_locked');
      const result = await db.runAsync('DELETE FROM budgets WHERE id = ?', [id]);
      changes = Number(result.changes ?? 0);
    });
    return changes;
  },

  // Get all months that have a budget set (for history view)
  async getAllBudgets(): Promise<Budget[]> {
    const db = await getDatabase();
    return db.getAllAsync<Budget>(
      'SELECT * FROM budgets WHERE active = 1 ORDER BY COALESCE(period_start, start_date) DESC, id DESC'
    );
  },

  /** Amount-only correction. Exact frozen bounds, currency and rollover links survive. */
  async updateBudgetAmount(id: number, amount: number): Promise<number> {
    const safeAmount = sanitizeAmount(amount, -1);
    if (safeAmount <= 0 || safeAmount !== amount) throw new Error('budget_invalid_amount');
    const db = await getDatabase();
    const result = await db.runAsync(
      'UPDATE budgets SET monthly_amount = ? WHERE id = ? AND active = 1',
      [safeAmount, id],
    );
    if (!result.changes) throw new Error('budget_period_not_found');
    return Number(result.changes);
  },

  /**
   * Explicit historical repair. Unlike normal save, this never deactivates a
   * neighbouring row: overlap and rollover dependencies must be resolved by
   * the user first.
   */
  async repairBudgetPeriod(id: number, nextStartRaw: string, nextEndRaw: string): Promise<number> {
    const nextStart = sanitizeDate(nextStartRaw);
    const nextEnd = sanitizeDate(nextEndRaw);
    if (!nextStart || !nextEnd || nextStart > nextEnd) throw new Error('budget_repair_invalid_dates');
    const db = await getDatabase();
    let changes = 0;
    await db.withTransactionAsync(async () => {
      const current = await db.getFirstAsync<Budget>(
        'SELECT * FROM budgets WHERE id = ? AND active = 1',
        [id],
      );
      if (!current?.period_start || !current.period_end) throw new Error('budget_period_not_found');
      if (current.period_start === nextStart && current.period_end === nextEnd) return;
      const linked = await db.getFirstAsync<{ uid: string }>(
        `SELECT uid FROM budget_rollovers
         WHERE (source_start = ? AND source_end = ?)
            OR (target_start = ? AND target_end = ?) LIMIT 1`,
        [current.period_start, current.period_end, current.period_start, current.period_end],
      );
      if (linked?.uid) throw new Error('rollover_period_locked');
      const overlap = await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM budgets
         WHERE active = 1 AND id != ?
           AND period_start IS NOT NULL AND period_end IS NOT NULL
           AND period_start <= ? AND period_end >= ? LIMIT 1`,
        [id, nextEnd, nextStart],
      );
      if (overlap?.id) throw new Error('budget_repair_overlap');
      const result = await db.runAsync(
        `UPDATE budgets
         SET start_date = ?, period_start = ?, period_end = ?, cycle_start_day = ?
         WHERE id = ? AND active = 1`,
        [nextStart.slice(0, 7), nextStart, nextEnd, Number(nextStart.slice(8, 10)), id],
      );
      changes = Number(result.changes ?? 0);
    });
    return changes;
  },

  /**
   * Changes the recurring anchor after the current period. The current period
   * is preserved; an explicit short bridge is inserted when the new anchor
   * does not begin on the following day.
   */
  async applyCycleStartDayChange(nextStartDayRaw: number, effectiveDate: string): Promise<{
    bridgeId: number | null;
  }> {
    const effective = sanitizeDate(effectiveDate);
    if (!effective) throw new Error('budget_repair_invalid_dates');
    const nextStartDay = normalizeCycleStartDay(nextStartDayRaw);
    const db = await getDatabase();
    let bridgeId: number | null = null;
    await db.withTransactionAsync(async () => {
      const setting = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM settings WHERE key = ?',
        ['budget_cycle_start_day'],
      );
      const previousStartDay = normalizeCycleStartDay(setting?.value ?? 1);
      if (previousStartDay === nextStartDay) return;
      const exact = await db.getFirstAsync<Budget>(
        `SELECT * FROM budgets WHERE active = 1 AND period_start <= ? AND period_end >= ?
         ORDER BY id DESC LIMIT 1`,
        [effective, effective],
      );
      const fallback = exact ?? await db.getFirstAsync<Budget>(
        'SELECT * FROM budgets WHERE active = 1 AND period_start <= ? ORDER BY period_start DESC, id DESC LIMIT 1',
        [effective],
      );
      if (!fallback) throw new Error('budget_cycle_requires_budget');
      const [year, month, day] = parseYmd(effective);
      const computed = getCycleForYmd(previousStartDay, year, month - 1, day);
      const currentStart = exact?.period_start ?? computed.start;
      const currentEnd = exact?.period_end ?? computed.end;
      const preview = previewBudgetCycleTransition(currentStart!, currentEnd!, nextStartDay);

      // The previous plan may have been inherited without an exact row. Freeze
      // it now so changing the global anchor cannot reinterpret today's period.
      if (!exact) {
        await db.runAsync(
          `INSERT INTO budgets
            (monthly_amount, currency, start_date, period_start, period_end, cycle_start_day, active)
           VALUES (?, ?, ?, ?, ?, ?, 1)`,
          [fallback.monthly_amount, fallback.currency, computed.start.slice(0, 7),
            computed.start, computed.end, previousStartDay],
        );
      }

      if (preview.bridge) {
        await assertRolloverPeriodEditable(
          db,
          preview.bridge.start,
          preview.bridge.end,
          fallback.currency,
        );
        const overlap = await db.getFirstAsync<{ id: number }>(
          `SELECT id FROM budgets WHERE active = 1
             AND period_start IS NOT NULL AND period_end IS NOT NULL
             AND period_start <= ? AND period_end >= ? LIMIT 1`,
          [preview.bridge.end, preview.bridge.start],
        );
        if (overlap?.id) throw new Error('budget_cycle_future_conflict');
        const inserted = await db.runAsync(
          `INSERT INTO budgets
            (monthly_amount, currency, start_date, period_start, period_end, cycle_start_day, active)
           VALUES (?, ?, ?, ?, ?, ?, 1)`,
          [fallback.monthly_amount, fallback.currency, preview.bridge.start.slice(0, 7),
            preview.bridge.start, preview.bridge.end, nextStartDay],
        );
        bridgeId = Number(inserted.lastInsertRowId);
      }
      await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
        'budget_cycle_start_day',
        String(nextStartDay),
      ]);
    });
    return { bridgeId };
  },
};

/** Amount edits keep transfers; moving their dates/currency requires explicit reversal. */
async function assertRolloverPeriodEditable(db: Awaited<ReturnType<typeof getDatabase>>, start: string, end: string, currency: string) {
  const linked = await db.getFirstAsync<{ uid: string }>(`SELECT uid FROM budget_rollovers WHERE
    (source_start <= ? AND source_end >= ? AND NOT (source_start = ? AND source_end = ? AND currency = ?)) OR
    (target_start <= ? AND target_end >= ? AND NOT (target_start = ? AND target_end = ? AND currency = ?)) LIMIT 1`,
  [end, start, start, end, currency, end, start, start, end, currency]);
  if (linked?.uid) throw new Error('rollover_period_locked');
}
