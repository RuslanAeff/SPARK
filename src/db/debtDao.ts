// S.P.A.R.K. — Borç (Debt) Data Access Object
//
// Borç Operasyonu saklama katmanı. Fiş/harcama HER ZAMAN bütün kalır; borç ve
// geri ödeme burada AYRI izlenir (çift sayım yasak — geri ödeme tüketim sayılmaz).
// Bütçe etkisi nakit-akışı modelidir (src/utils/debtMath.ts): borç alınan döngüde
// harcanabilir +, ödenen döngüde −. Tüm yazılar inputValidation'dan geçer (§7.7);
// çoklu yazı tek `withTransactionAsync` içinde (§7.3).
import { getDatabase } from './database';
import { Debt, DebtPayment } from './schema';
import {
  isSupportedYmd,
  sanitizeAmount,
  sanitizeText,
  sanitizeDate,
} from '../utils/inputValidation';
import { fromMinorUnits, toMinorUnits } from '../utils/moneyMath';
import { getToday } from '../utils/dateUtils';

export type DebtDirection = 'borrowed' | 'lent';

export interface DebtCreateInput {
  direction?: DebtDirection;
  counterparty: string;
  amount: number;
  currency?: string;
  date: string;
  dueDate?: string | null;
  reminderEnabled?: boolean;
  reminderDaysBefore?: number;
  reminderTime?: string;
  note?: string | null;
  linkedExpenseId?: number | null;
}

export interface DebtReminderSettingsInput {
  dueDate: string | null;
  reminderEnabled: boolean;
  reminderDaysBefore?: number;
  reminderTime?: string;
}

const HH_MM_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function normalizeDueDate(value: string | null | undefined): string | null {
  if (value == null || value === '') return null;
  if (!isSupportedYmd(value)) throw new Error('Invalid debt due date');
  return value;
}

function normalizeReminderDays(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 0 || value > 365) {
    throw new Error('Invalid reminder days before');
  }
  return value;
}

function normalizeReminderTime(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (!HH_MM_PATTERN.test(value)) throw new Error('Invalid reminder time');
  return value;
}

export const DebtDao = {
  /** Yeni borç kaydı. remaining = amount, status = 'open'. */
  async create(input: DebtCreateInput): Promise<number> {
    const db = await getDatabase();
    const direction: DebtDirection = input.direction === 'lent' ? 'lent' : 'borrowed';
    const safeAmount = sanitizeAmount(input.amount);
    if (safeAmount <= 0) throw new Error('Debt amount must be greater than zero');
    const safeCounterparty = sanitizeText(input.counterparty ?? '', 200);
    const safeCurrency = sanitizeText(input.currency || 'PLN', 10);
    const safeDate = sanitizeDate(input.date);
    if (!safeDate) throw new Error('Invalid debt date');
    const dueDate = normalizeDueDate(input.dueDate);
    const reminderEnabled = input.reminderEnabled === true;
    if (reminderEnabled && !dueDate) {
      throw new Error('Debt reminder requires a due date');
    }
    const reminderDaysBefore = normalizeReminderDays(input.reminderDaysBefore) ?? 3;
    const reminderTime = normalizeReminderTime(input.reminderTime) ?? '09:00';
    const safeNote = input.note ? sanitizeText(input.note, 1000) : null;
    const linkedExpenseId =
      input.linkedExpenseId && input.linkedExpenseId > 0 ? input.linkedExpenseId : null;

    const result = await db.runAsync(
      `INSERT INTO debts
         (direction, counterparty, amount, remaining, currency, date, status,
          due_date, reminder_enabled, reminder_days_before, reminder_time,
          linked_expense_id, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?)`,
      [
        direction,
        safeCounterparty,
        safeAmount,
        safeAmount,
        safeCurrency,
        safeDate,
        dueDate,
        reminderEnabled ? 1 : 0,
        reminderDaysBefore,
        reminderTime,
        linkedExpenseId,
        safeNote,
        new Date().toISOString(),
      ]
    );
    return result.lastInsertRowId;
  },

  /** Borcun vade/hatırlatma ayarlarını atomik tek yazıyla günceller. */
  async updateReminderSettings(
    debtId: number,
    input: DebtReminderSettingsInput,
  ): Promise<boolean> {
    if (!Number.isInteger(debtId) || debtId <= 0) return false;
    const dueDate = normalizeDueDate(input.dueDate);
    if (input.reminderEnabled && !dueDate) {
      throw new Error('Debt reminder requires a due date');
    }
    const reminderDaysBefore = normalizeReminderDays(input.reminderDaysBefore);
    const reminderTime = normalizeReminderTime(input.reminderTime);
    const db = await getDatabase();
    const result = await db.runAsync(
      `UPDATE debts
          SET due_date = ?,
              reminder_enabled = ?,
              reminder_days_before = COALESCE(?, reminder_days_before),
              reminder_time = COALESCE(?, reminder_time)
        WHERE id = ?
          AND status = 'open'
          AND remaining > 0`,
      [
        dueDate,
        input.reminderEnabled ? 1 : 0,
        reminderDaysBefore ?? null,
        reminderTime ?? null,
        debtId,
      ],
    );
    return result.changes > 0;
  },

  /**
   * Borca kısmi/tam geri ödeme. Çoklu yazı (payment INSERT + debts UPDATE) tek
   * transaction içinde. Ödeme kalanı aşamaz (overpay → remaining'e kıstırılır);
   * kalan <=0 olunca status='settled'.
   */
  async repay(debtId: number, amount: number, date?: string): Promise<void> {
    const db = await getDatabase();
    const requested = sanitizeAmount(amount);
    if (requested <= 0) return;
    const safeDate = date === undefined ? getToday() : sanitizeDate(date);
    if (!safeDate) throw new Error('Invalid debt payment date');

    await db.withTransactionAsync(async () => {
      const debt = await db.getFirstAsync<{ remaining: number }>(
        'SELECT remaining FROM debts WHERE id = ?',
        [debtId]
      );
      if (!debt) return;
      // Kalanı aşan ödeme tutarı cash-flow'u şişirmesin → remaining'e kıstır.
      const remainingMinor = toMinorUnits(debt.remaining);
      const requestedMinor = toMinorUnits(requested);
      const payMinor = Math.min(requestedMinor, remainingMinor);
      if (payMinor <= 0) return;
      const payAmount = fromMinorUnits(payMinor);

      await db.runAsync(
        `INSERT INTO debt_payments (debt_id, amount, date, created_at) VALUES (?, ?, ?, ?)`,
        [debtId, payAmount, safeDate, new Date().toISOString()]
      );

      const newRemainingMinor = remainingMinor - payMinor;
      const newRemaining = fromMinorUnits(newRemainingMinor);
      const settled = newRemainingMinor === 0;
      const status = settled ? 'settled' : 'open';
      await db.runAsync(
        `UPDATE debts
            SET remaining = ?,
                status = ?,
                reminder_enabled = CASE WHEN ? = 1 THEN 0 ELSE reminder_enabled END
          WHERE id = ?`,
        [Math.max(0, newRemaining), status, settled ? 1 : 0, debtId]
      );
    });
  },

  /** Açık (ödenmemiş) borçlar — döngü bağımsız, en yeni tarih önce. */
  async listOpen(direction: DebtDirection = 'borrowed'): Promise<Debt[]> {
    const db = await getDatabase();
    return db.getAllAsync<Debt>(
      `SELECT * FROM debts WHERE status = 'open' AND direction = ? ORDER BY date DESC, id DESC`,
      [direction]
    );
  },

  /** Tüm borçlar (açık + kapanmış) — geçmiş görünümü, en yeni tarih önce. */
  async listAll(direction: DebtDirection = 'borrowed'): Promise<Debt[]> {
    const db = await getDatabase();
    return db.getAllAsync<Debt>(
      `SELECT * FROM debts WHERE direction = ? ORDER BY date DESC, id DESC`,
      [direction]
    );
  },

  async getById(id: number): Promise<Debt | null> {
    const db = await getDatabase();
    return db.getFirstAsync<Debt>('SELECT * FROM debts WHERE id = ?', [id]);
  },

  /** Belirtilen gün sonuna kadar hatırlatılması gereken açık borçlar. */
  async listDueReminders(onOrBefore: string): Promise<Debt[]> {
    if (!isSupportedYmd(onOrBefore)) throw new Error('Invalid reminder cutoff date');
    const db = await getDatabase();
    return db.getAllAsync<Debt>(
      `SELECT * FROM debts
        WHERE status = 'open'
          AND reminder_enabled = 1
          AND due_date IS NOT NULL
          AND due_date <= ?
        ORDER BY due_date ASC, id ASC`,
      [onOrBefore],
    );
  },

  async getPayments(debtId: number): Promise<DebtPayment[]> {
    const db = await getDatabase();
    return db.getAllAsync<DebtPayment>(
      'SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY date DESC, id DESC',
      [debtId]
    );
  },

  /** Borcu (ve CASCADE ile ödemelerini) sil. */
  async remove(id: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM debts WHERE id = ?', [id]);
  },

  /**
   * Global açık borç toplamı (kırmızı rozet) = Σ remaining (status='open').
   * v1 yalnızca 'borrowed'; 'lent' (alacak) için ayrı çağrılır.
   */
  async getOutstandingTotal(direction: DebtDirection = 'borrowed'): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(remaining), 0) as total FROM debts WHERE status = 'open' AND direction = ?`,
      [direction]
    );
    return row?.total ?? 0;
  },

  /** Bir döngüde [start,end] alınan borç toplamı (date ∈ aralık). Nakit-akışı +. */
  async getBorrowedTotalByDateRange(
    startDate: string,
    endDate: string,
    direction: DebtDirection = 'borrowed'
  ): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM debts WHERE direction = ? AND date BETWEEN ? AND ?`,
      [direction, startDate, endDate]
    );
    return row?.total ?? 0;
  },

  /** Bir döngüde [start,end] yapılan geri ödeme toplamı (payment.date ∈ aralık). Nakit-akışı −. */
  async getRepaidTotalByDateRange(
    startDate: string,
    endDate: string,
    direction: DebtDirection = 'borrowed'
  ): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(p.amount), 0) as total
       FROM debt_payments p
       JOIN debts d ON p.debt_id = d.id
       WHERE d.direction = ? AND p.date BETWEEN ? AND ?`,
      [direction, startDate, endDate]
    );
    return row?.total ?? 0;
  },
};
