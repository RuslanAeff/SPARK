// S.P.A.R.K. — Borç (Debt) Data Access Object
//
// Borç Operasyonu saklama katmanı. Fiş/harcama HER ZAMAN bütün kalır; borç ve
// geri ödeme burada AYRI izlenir (çift sayım yasak — geri ödeme tüketim sayılmaz).
// Bütçe etkisi nakit-akışı modelidir (src/utils/debtMath.ts): borç alınan döngüde
// harcanabilir +, ödenen döngüde −. Tüm yazılar inputValidation'dan geçer (§7.7);
// çoklu yazı tek `withTransactionAsync` içinde (§7.3).
import { getDatabase } from './database';
import { Debt, DebtPayment } from './schema';
import { sanitizeAmount, sanitizeText, sanitizeDate } from '../utils/inputValidation';

type Direction = 'borrowed' | 'lent';

const todayYmd = (): string => new Date().toISOString().split('T')[0];

export const DebtDao = {
  /** Yeni borç kaydı. remaining = amount, status = 'open'. */
  async create(input: {
    direction?: Direction;
    counterparty: string;
    amount: number;
    currency?: string;
    date: string;
    note?: string | null;
    linkedExpenseId?: number | null;
  }): Promise<number> {
    const db = await getDatabase();
    const direction: Direction = input.direction === 'lent' ? 'lent' : 'borrowed';
    const safeAmount = sanitizeAmount(input.amount);
    const safeCounterparty = sanitizeText(input.counterparty ?? '', 200);
    const safeCurrency = sanitizeText(input.currency || 'PLN', 10);
    const safeDate = sanitizeDate(input.date) ?? todayYmd();
    const safeNote = input.note ? sanitizeText(input.note, 1000) : null;
    const linkedExpenseId =
      input.linkedExpenseId && input.linkedExpenseId > 0 ? input.linkedExpenseId : null;

    const result = await db.runAsync(
      `INSERT INTO debts
         (direction, counterparty, amount, remaining, currency, date, status, linked_expense_id, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)`,
      [
        direction,
        safeCounterparty,
        safeAmount,
        safeAmount,
        safeCurrency,
        safeDate,
        linkedExpenseId,
        safeNote,
        new Date().toISOString(),
      ]
    );
    return result.lastInsertRowId;
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
    const safeDate = (date && sanitizeDate(date)) || todayYmd();

    await db.withTransactionAsync(async () => {
      const debt = await db.getFirstAsync<{ remaining: number }>(
        'SELECT remaining FROM debts WHERE id = ?',
        [debtId]
      );
      if (!debt) return;
      // Kalanı aşan ödeme tutarı cash-flow'u şişirmesin → remaining'e kıstır.
      const payAmount = Math.min(requested, debt.remaining);
      if (payAmount <= 0) return;

      await db.runAsync(
        `INSERT INTO debt_payments (debt_id, amount, date, created_at) VALUES (?, ?, ?, ?)`,
        [debtId, payAmount, safeDate, new Date().toISOString()]
      );

      const newRemaining = debt.remaining - payAmount;
      const status = newRemaining <= 0 ? 'settled' : 'open';
      await db.runAsync(
        `UPDATE debts SET remaining = ?, status = ? WHERE id = ?`,
        [Math.max(0, newRemaining), status, debtId]
      );
    });
  },

  /** Açık (ödenmemiş) borçlar — döngü bağımsız, en yeni tarih önce. */
  async listOpen(direction: Direction = 'borrowed'): Promise<Debt[]> {
    const db = await getDatabase();
    return db.getAllAsync<Debt>(
      `SELECT * FROM debts WHERE status = 'open' AND direction = ? ORDER BY date DESC, id DESC`,
      [direction]
    );
  },

  /** Tüm borçlar (açık + kapanmış) — geçmiş görünümü, en yeni tarih önce. */
  async listAll(direction: Direction = 'borrowed'): Promise<Debt[]> {
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
  async getOutstandingTotal(direction: Direction = 'borrowed'): Promise<number> {
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
    direction: Direction = 'borrowed'
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
    direction: Direction = 'borrowed'
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
