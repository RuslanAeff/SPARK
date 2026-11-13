// S.P.A.R.K. — Bütçe geçmişi dönem toplamları, toplu okuma (PERF-10)
//
// Bütçe geçmişi kartı eskiden her dönem için beş ayrı sorgu çalıştırıyordu
// (iki yıllık geçmişte 150'yi aşan sorgu). Burada her tablo, bütün dönemleri
// kapsayan tarih aralığında BİR kez okunur; satırlar dönemlere JS'te, tekil
// DAO fonksiyonlarıyla aynı kurallarla dağıtılır:
//   • harcama: max(0, toplam − kullanılan kupon), tarih ∈ [başlangıç, bitiş]
//     (`ExpenseDao.getCashSpentByDateRange`)
//   • alınan borç: direction = 'borrowed', borç tarihi ∈ aralık
//   • geri ödeme: borrowed borcun ödemesi, ödeme tarihi ∈ aralık
//   • ek gelir: gelir tarihi ∈ aralık
//   • depozito iadesi: method = 'cash', tarih ∈ aralık, dönemin para birimi
// Tutarlar kuruş tabanlı `sumMoney` ile toplanır (ham `SUM(REAL)` değil).
// Tarihler 'YYYY-MM-DD' metnidir; SQLite BETWEEN ile JS metin karşılaştırması aynıdır.
import { getDatabase } from '../db/database';
import { sanitizeText } from '../utils/inputValidation';
import { subtractMoney, sumMoney } from '../utils/moneyMath';

export interface PeriodRange {
  start: string;
  end: string;
  /** Depozito iadesi bu para biriminde sayılır. */
  currency: string;
}

export interface PeriodTotals {
  spent: number;
  borrowedIn: number;
  repaidIn: number;
  extraIncomeIn: number;
  depositRecoveredIn: number;
}

interface DatedAmount { date: string; amount: number }

export function periodTotalsKey(range: PeriodRange): string {
  return `${range.start}:${range.end}:${normalizeCurrency(range.currency)}`;
}

function normalizeCurrency(value: string): string {
  return sanitizeText(value || 'PLN', 10).trim().toUpperCase() || 'PLN';
}

/** Tarihe göre sıralı satırlardan [start, end] aralığındakileri toplar. */
function sumInRange(rows: DatedAmount[], start: string, end: string): number {
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].date < start) lo = mid + 1; else hi = mid;
  }
  const picked: number[] = [];
  for (let i = lo; i < rows.length && rows[i].date <= end; i++) picked.push(rows[i].amount);
  return sumMoney(picked);
}

export async function loadPeriodTotals(ranges: readonly PeriodRange[]): Promise<Map<string, PeriodTotals>> {
  const result = new Map<string, PeriodTotals>();
  if (ranges.length === 0) return result;
  const from = ranges.reduce((min, r) => (r.start < min ? r.start : min), ranges[0].start);
  const to = ranges.reduce((max, r) => (r.end > max ? r.end : max), ranges[0].end);
  const db = await getDatabase();

  // ADR-002: aynı bağlantıda sıralı; Promise.all yok.
  const expenses = await db.getAllAsync<{ date: string; total_amount: number; container_voucher_used: number | null }>(
    'SELECT date, total_amount, container_voucher_used FROM expenses WHERE date BETWEEN ? AND ? ORDER BY date',
    [from, to],
  );
  const borrowed = await db.getAllAsync<DatedAmount>(
    "SELECT date, amount FROM debts WHERE direction = 'borrowed' AND date BETWEEN ? AND ? ORDER BY date",
    [from, to],
  );
  const repaid = await db.getAllAsync<DatedAmount>(
    `SELECT p.date AS date, p.amount AS amount
       FROM debt_payments p JOIN debts d ON p.debt_id = d.id
      WHERE d.direction = 'borrowed' AND p.date BETWEEN ? AND ? ORDER BY p.date`,
    [from, to],
  );
  const incomes = await db.getAllAsync<DatedAmount>(
    'SELECT date, amount FROM extra_incomes WHERE date BETWEEN ? AND ? ORDER BY date',
    [from, to],
  );
  const recoveries = await db.getAllAsync<DatedAmount & { currency: string }>(
    "SELECT date, amount, currency FROM container_deposit_recoveries WHERE method = 'cash' AND date BETWEEN ? AND ? ORDER BY date",
    [from, to],
  );

  const spentRows: DatedAmount[] = expenses.map(row => ({
    date: row.date,
    amount: Math.max(0, subtractMoney(row.total_amount, row.container_voucher_used ?? 0)),
  }));
  const recoveriesByCurrency = new Map<string, DatedAmount[]>();
  for (const row of recoveries) {
    const list = recoveriesByCurrency.get(row.currency);
    if (list) list.push(row); else recoveriesByCurrency.set(row.currency, [row]);
  }

  for (const range of ranges) {
    const key = periodTotalsKey(range);
    if (result.has(key)) continue;
    result.set(key, {
      spent: sumInRange(spentRows, range.start, range.end),
      borrowedIn: sumInRange(borrowed, range.start, range.end),
      repaidIn: sumInRange(repaid, range.start, range.end),
      extraIncomeIn: sumInRange(incomes, range.start, range.end),
      depositRecoveredIn: sumInRange(
        recoveriesByCurrency.get(normalizeCurrency(range.currency)) ?? [], range.start, range.end,
      ),
    });
  }
  return result;
}
