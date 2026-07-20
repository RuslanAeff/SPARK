// S.P.A.R.K. — Ek Gelir (Extra Income) Data Access Object
//
// Ek Gelir = bütçe planının DIŞINDA gelen, harcanabilir tutarı artıran nakit
// (banka promosyonu, hediye, tek seferlik ek iş). Borçtan (src/db/debtDao.ts)
// ayrıldığı nokta: geri ödeme yükümlülüğü YOKTUR → `remaining`/`status` alanı ve
// ödeme tablosu yok, "açık borç" rozetine hiç girmez.
//
// Bütçe etkisi nakit-akışı modelinin bir terimidir (src/utils/debtMath.ts):
// yalnızca `date`'in düştüğü döngünün effectiveBudget'ını artırır, sonraki
// döngüye sarkmaz. Harcama/fiş tablolarına DOKUNMAZ — tüketim analizi (kategori,
// satıcı, projeksiyon temposu) gelirden etkilenmez.
//
// Tüm yazılar inputValidation'dan geçer (§7.7).
import { getDatabase } from './database';
import { ExtraIncome } from './schema';
import { sanitizeAmount, sanitizeText, sanitizeDate } from '../utils/inputValidation';

const todayYmd = (): string => new Date().toISOString().split('T')[0];

export const IncomeDao = {
  /** Yeni ek gelir kaydı. Tutar <= 0 ise yazılmaz (hayalî/negatif para yok). */
  async create(input: {
    source: string;
    amount: number;
    currency?: string;
    date: string;
    note?: string | null;
  }): Promise<number> {
    const db = await getDatabase();
    const safeAmount = sanitizeAmount(input.amount);
    if (safeAmount <= 0) return 0;
    const safeSource = sanitizeText(input.source ?? '', 200);
    const safeCurrency = sanitizeText(input.currency || 'PLN', 10);
    const safeDate = sanitizeDate(input.date) ?? todayYmd();
    const safeNote = input.note ? sanitizeText(input.note, 1000) : null;

    const result = await db.runAsync(
      `INSERT INTO extra_incomes (source, amount, currency, date, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [safeSource, safeAmount, safeCurrency, safeDate, safeNote, new Date().toISOString()]
    );
    return result.lastInsertRowId;
  },

  /** Bir döngüdeki [start,end] gelir kayıtları — en yeni tarih önce. */
  async listByDateRange(startDate: string, endDate: string): Promise<ExtraIncome[]> {
    const db = await getDatabase();
    return db.getAllAsync<ExtraIncome>(
      `SELECT * FROM extra_incomes WHERE date BETWEEN ? AND ? ORDER BY date DESC, id DESC`,
      [startDate, endDate]
    );
  },

  /** Tüm gelir kayıtları (geçmiş görünümü) — en yeni tarih önce. */
  async listAll(limit: number = 100): Promise<ExtraIncome[]> {
    const db = await getDatabase();
    return db.getAllAsync<ExtraIncome>(
      `SELECT * FROM extra_incomes ORDER BY date DESC, id DESC LIMIT ?`,
      [limit]
    );
  },

  async getById(id: number): Promise<ExtraIncome | null> {
    const db = await getDatabase();
    return db.getFirstAsync<ExtraIncome>('SELECT * FROM extra_incomes WHERE id = ?', [id]);
  },

  async remove(id: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM extra_incomes WHERE id = ?', [id]);
  },

  /** Bir döngüde [start,end] elde edilen ek gelir toplamı. Nakit-akışı +. */
  async getTotalByDateRange(startDate: string, endDate: string): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM extra_incomes WHERE date BETWEEN ? AND ?`,
      [startDate, endDate]
    );
    return row?.total ?? 0;
  },
};
