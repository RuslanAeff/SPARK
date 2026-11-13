// PERF-10: toplu dönem toplamları, tekil DAO fonksiyonlarıyla kuruşu kuruşuna aynı.
jest.mock('../../db/database', () => ({ getDatabase: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));

import { getDatabase } from '../../db/database';
import { CREATE_TABLES_SQL } from '../../db/schema';
import { ExpenseDao } from '../../db/expenseDao';
import { DebtDao } from '../../db/debtDao';
import { IncomeDao } from '../../db/incomeDao';
import { ContainerDepositDao } from '../../db/containerDepositDao';
import { roundMoney } from '../../utils/moneyMath';
import { sqliteTestDatabase } from '../../db/__tests__/helpers/sqliteTestDatabase';
import { loadPeriodTotals, periodTotalsKey, type PeriodRange } from '../budgetHistoryTotals';

let db: ReturnType<typeof sqliteTestDatabase>;
let reads = 0;

beforeEach(async () => {
  db = sqliteTestDatabase();
  await db.execAsync(CREATE_TABLES_SQL);
  const uid = () => require('node:crypto').randomUUID();
  await db.execAsync("INSERT INTO vendors (id, name) VALUES (1, 'X'); INSERT INTO categories (id, name) VALUES (1, 'C');");
  // Dönem sınırları (dahil), kupon > toplam (0'a kırpılır), kuruş kayması üreten tutarlar.
  const expenses: Array<[string, number, number]> = [
    ['2026-07-23', 10.1, 0], ['2026-08-22', 0.2, 0], ['2026-08-22', 0.1, 0],
    ['2026-08-23', 5, 7.5], ['2026-09-10', 19.99, 2.5], ['2026-09-22', 33.33, 0], ['2026-09-23', 1, 0],
  ];
  for (const [date, total, voucher] of expenses) {
    await db.runAsync(
      "INSERT INTO expenses (vendor_id, category_id, total_amount, currency, date, container_voucher_used) VALUES (1, 1, ?, 'PLN', ?, ?)",
      [total, date, voucher],
    );
  }
  await db.execAsync(`
    INSERT INTO debts (id, direction, amount, remaining, date, created_at) VALUES
      (1, 'borrowed', 100.1, 50, '2026-08-23', 'x'), (2, 'lent', 999, 999, '2026-08-24', 'x'),
      (3, 'borrowed', 0.2, 0.2, '2026-09-22', 'x');
    INSERT INTO debt_payments (debt_id, amount, date, created_at) VALUES
      (1, 20.05, '2026-08-30', 'x'), (1, 30.05, '2026-09-23', 'x'), (2, 500, '2026-09-01', 'x');
    INSERT INTO extra_incomes (source, amount, date, created_at) VALUES
      ('a', 0.1, '2026-08-23', 'x'), ('b', 0.2, '2026-09-22', 'x'), ('c', 50, '2026-07-01', 'x');
  `);
  for (const [amount, currency, date, method] of [
    [2.5, 'PLN', '2026-08-25', 'cash'], [1.25, 'EUR', '2026-08-26', 'cash'],
    [4, 'PLN', '2026-09-01', 'purchase_voucher'], [0.75, 'PLN', '2026-09-22', 'cash'],
  ] as const) {
    await db.runAsync(
      "INSERT INTO container_deposit_recoveries (uid, amount, currency, date, method, created_at) VALUES (?, ?, ?, ?, ?, 'x')",
      [uid(), amount, currency, date, method],
    );
  }
  reads = 0;
  const realAll = db.getAllAsync;
  const realFirst = db.getFirstAsync;
  (getDatabase as jest.Mock).mockResolvedValue({
    ...db,
    getAllAsync: (sql: string, params?: unknown[]) => { reads += 1; return realAll(sql, params); },
    getFirstAsync: (sql: string, params?: unknown[]) => { reads += 1; return realFirst(sql, params); },
  });
});
afterEach(async () => db.close());

const RANGES: PeriodRange[] = [
  { start: '2026-07-23', end: '2026-08-22', currency: 'PLN' },
  { start: '2026-08-23', end: '2026-09-22', currency: 'PLN' },
  { start: '2026-08-23', end: '2026-09-22', currency: 'EUR' },
  { start: '2026-09-23', end: '2026-10-22', currency: 'PLN' },
  { start: '2026-06-23', end: '2026-07-22', currency: 'PLN' },
];

it('matches the per-period DAO results to the cent for every period', async () => {
  const batch = await loadPeriodTotals(RANGES);
  for (const range of RANGES) {
    const totals = batch.get(periodTotalsKey(range))!;
    expect(totals).toEqual({
      spent: roundMoney(await ExpenseDao.getCashSpentByDateRange(range.start, range.end)),
      borrowedIn: roundMoney(await DebtDao.getBorrowedTotalByDateRange(range.start, range.end)),
      repaidIn: roundMoney(await DebtDao.getRepaidTotalByDateRange(range.start, range.end)),
      extraIncomeIn: roundMoney(await IncomeDao.getTotalByDateRange(range.start, range.end)),
      depositRecoveredIn: roundMoney(await ContainerDepositDao.getCashRecoveredByDateRange(range.start, range.end, range.currency)),
    });
  }
  // Somut değerler: sınır günleri dahil, kupon kırpması, lent borç ve kupon iadesi hariç.
  expect(batch.get(periodTotalsKey(RANGES[0]))!.spent).toBe(10.4);
  expect(batch.get(periodTotalsKey(RANGES[1]))).toEqual({
    spent: 50.82, borrowedIn: 100.3, repaidIn: 20.05, extraIncomeIn: 0.3, depositRecoveredIn: 3.25,
  });
  expect(batch.get(periodTotalsKey(RANGES[2]))!.depositRecoveredIn).toBe(1.25);
});

it('reads each table once regardless of how many periods are shown', async () => {
  await loadPeriodTotals(RANGES);
  expect(reads).toBe(5);
  reads = 0;
  const many: PeriodRange[] = Array.from({ length: 24 }, (_, i) => {
    const month = new Date(Date.UTC(2025, i, 23)).toISOString().slice(0, 10);
    const end = new Date(Date.UTC(2025, i + 1, 22)).toISOString().slice(0, 10);
    return { start: month, end, currency: 'PLN' };
  });
  await loadPeriodTotals(many);
  expect(reads).toBe(5);
});

it('returns an empty map without touching the database when there are no periods', async () => {
  expect((await loadPeriodTotals([])).size).toBe(0);
  expect(reads).toBe(0);
});
