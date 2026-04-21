// S.P.A.R.K. — Tek birikim hedefi (singleton id = 1)
import { getDatabase } from './database';

export interface SavingsGoalRow {
  id: number;
  title: string;
  target_amount: number;
  target_date: string;
  currency: string;
  /** Kullanıcının o ana kadar biriktirdiğini beyan ettiği tutar (≥0) */
  current_amount: number;
}

/** Yerel, işaret-koruyan sayı normalize: sanitizeAmount negatifleri 0'a
 * çeviriyor; oysa addContribution delta'sında negatif de geçerlidir. */
function toFiniteNumber(value: unknown, fallback: number = 0): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return fallback;
  if (n > 999_999_999) return 999_999_999;
  if (n < -999_999_999) return -999_999_999;
  return n;
}

export const GoalDao = {
  async get(): Promise<SavingsGoalRow | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<SavingsGoalRow>(
      'SELECT * FROM savings_goal WHERE id = 1'
    );
    if (!row) return null;
    return {
      ...row,
      current_amount: Math.max(0, toFiniteNumber(row.current_amount)),
    };
  },

  async upsert(data: {
    title: string;
    target_amount: number;
    target_date: string;
    currency: string;
    current_amount?: number;
  }): Promise<void> {
    const db = await getDatabase();
    const existing = await db.getFirstAsync<{ current_amount: number | null }>(
      'SELECT current_amount FROM savings_goal WHERE id = 1'
    );
    const current =
      data.current_amount !== undefined
        ? Math.max(0, toFiniteNumber(data.current_amount))
        : Math.max(0, toFiniteNumber(existing?.current_amount));

    await db.runAsync(
      `INSERT OR REPLACE INTO savings_goal
         (id, title, target_amount, target_date, currency, current_amount)
       VALUES (1, ?, ?, ?, ?, ?)`,
      [data.title.trim(), data.target_amount, data.target_date, data.currency, current]
    );
  },

  /** Güncel birikim tutarını doğrudan değiştirir (negatifler 0'a kilitlenir). */
  async setCurrentAmount(amount: number): Promise<void> {
    const db = await getDatabase();
    const normalized = Math.max(0, toFiniteNumber(amount));
    await db.runAsync(
      'UPDATE savings_goal SET current_amount = ? WHERE id = 1',
      [normalized]
    );
  },

  /**
   * Hedefe bir katkı ekler veya çıkarır (delta negatif olabilir). Toplam asla
   * 0'ın altına düşmez. Hedef yoksa 0 döner.
   */
  async addContribution(delta: number): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ current_amount: number | null }>(
      'SELECT current_amount FROM savings_goal WHERE id = 1'
    );
    if (!row) return 0;
    const current = Math.max(0, toFiniteNumber(row.current_amount));
    const next = Math.max(0, current + toFiniteNumber(delta));
    await db.runAsync(
      'UPDATE savings_goal SET current_amount = ? WHERE id = 1',
      [next]
    );
    return next;
  },

  async clear(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM savings_goal WHERE id = 1');
  },
};
