// S.P.A.R.K. — Tek birikim hedefi (singleton id = 1)
import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from './database';
import {
  type CategoryLimitInput,
  validateCategoryLimit,
  writeCategoryLimit,
} from './categoryLimitDao';
import { sanitizeDate, sanitizeText } from '../utils/inputValidation';
import { roundMoney } from '../utils/moneyMath';

export const SAVINGS_GOAL_TITLE_MAX = 200;

export interface SavingsGoalInput {
  title: string;
  target_amount: number;
  target_date: string;
  currency: string;
  /** Atlanırsa mevcut birikim korunur. */
  current_amount?: number;
}

interface ValidatedGoal {
  title: string;
  targetAmount: number;
  targetDate: string;
  currency: string;
  currentAmount: number | null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Yazmadan önce tüm hedef alanlarını doğrular (AGENTS.md: inputValidation sınırı). */
function validateGoal(data: SavingsGoalInput): ValidatedGoal {
  const title = sanitizeText(data.title, SAVINGS_GOAL_TITLE_MAX);
  const targetDate = sanitizeDate(data.target_date);
  if (!title || !isFiniteNumber(data.target_amount)
    || data.target_amount <= 0 || data.target_amount > 999_999_999
    || !targetDate
    || (data.current_amount !== undefined
      && (!isFiniteNumber(data.current_amount) || data.current_amount < 0
        || data.current_amount > 999_999_999))) {
    throw new Error('INVALID_SAVINGS_GOAL');
  }
  return {
    title,
    targetAmount: roundMoney(data.target_amount),
    targetDate,
    currency: sanitizeText(data.currency || 'PLN', 10) || 'PLN',
    currentAmount: data.current_amount === undefined ? null : roundMoney(data.current_amount),
  };
}

/** Tek ifadelik hedef yazısı; atlanan birikim aynı ifade içinde korunur. */
async function writeGoal(db: Pick<SQLiteDatabase, 'runAsync'>, goal: ValidatedGoal): Promise<void> {
  await db.runAsync(
    `INSERT INTO savings_goal
       (id, title, target_amount, target_date, currency, current_amount)
     VALUES (1, ?, ?, ?, ?, COALESCE(?, (SELECT current_amount FROM savings_goal WHERE id = 1), 0))
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       target_amount = excluded.target_amount,
       target_date = excluded.target_date,
       currency = excluded.currency,
       current_amount = excluded.current_amount`,
    [goal.title, goal.targetAmount, goal.targetDate, goal.currency, goal.currentAmount],
  );
}

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

  async upsert(data: SavingsGoalInput): Promise<void> {
    const goal = validateGoal(data);
    const db = await getDatabase();
    await writeGoal(db, goal);
  },

  /**
   * Hedefe bir katkı ekler veya çıkarır (delta negatif olabilir). Toplam asla
   * 0'ın altına düşmez. Hedef yoksa 0 döner.
   * Tek UPDATE ifadesi: eski oku-hesapla-yaz akışında hızlı çift dokunuşta
   * bir katkı kaybolabiliyordu (BUG-09).
   */
  async addContribution(delta: number): Promise<number> {
    if (!isFiniteNumber(delta) || Math.abs(delta) > 999_999_999) {
      throw new Error('INVALID_SAVINGS_CONTRIBUTION');
    }
    const db = await getDatabase();
    const result = await db.runAsync(
      'UPDATE savings_goal SET current_amount = MAX(0, ROUND(current_amount + ?, 2)) WHERE id = 1',
      [roundMoney(delta)],
    );
    if (result.changes === 0) return 0;
    const row = await db.getFirstAsync<{ current_amount: number | null }>(
      'SELECT current_amount FROM savings_goal WHERE id = 1'
    );
    return Math.max(0, toFiniteNumber(row?.current_amount));
  },

  /**
   * Hedef ekranının kaydı: hedef (varsa) + ayın limit kümesi TEK transaction'da.
   * Listede olmayan limitler o ay için silinir. Tüm girdiler transaction
   * açılmadan doğrulanır; ortada hata olursa hiçbir satır değişmez (BUG-09).
   */
  async saveSettings(input: {
    goal: SavingsGoalInput | null;
    month: string;
    limits: CategoryLimitInput[];
  }): Promise<void> {
    const goal = input.goal ? validateGoal(input.goal) : null;
    const limits = input.limits.map(l => validateCategoryLimit(l.category_id, input.month, l.limit_amount));
    const { month } = validateCategoryLimit(1, input.month, 0);
    const keptIds = limits.map(l => l.categoryId);
    if (new Set(keptIds).size !== keptIds.length) throw new Error('INVALID_CATEGORY_LIMIT');

    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      if (goal) await writeGoal(db, goal);
      if (keptIds.length === 0) {
        await db.runAsync('DELETE FROM category_limits WHERE month = ?', [month]);
      } else {
        await db.runAsync(
          `DELETE FROM category_limits WHERE month = ? AND category_id NOT IN (${keptIds.map(() => '?').join(', ')})`,
          [month, ...keptIds],
        );
      }
      for (const limit of limits) await writeCategoryLimit(db, limit);
    });
  },

  /**
   * Kayıtlı hedef varsa siler. Çağıranın gerçekte bir satır silinip
   * silinmediğini ayırt edebilmesi, boş/stale ekran durumunda sahte başarı
   * göstermesini engeller.
   */
  async clear(): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.runAsync('DELETE FROM savings_goal WHERE id = 1');
    return result.changes > 0;
  },
};
