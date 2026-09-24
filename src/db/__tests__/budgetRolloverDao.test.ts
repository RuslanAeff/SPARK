jest.mock('../database', () => ({ getDatabase: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));
jest.mock('../../utils/dateUtils', () => ({ getToday: () => '2026-09-21' }));

import { getDatabase } from '../database';
import { BudgetRolloverDao } from '../budgetRolloverDao';
import { BudgetDao } from '../budgetDao';
import { BUDGET_ROLLOVERS_SCHEMA_SQL, CREATE_TABLES_SQL } from '../schema';
import { sqliteTestDatabase } from './helpers/sqliteTestDatabase';

let db: ReturnType<typeof sqliteTestDatabase>;
beforeEach(async () => {
  db = sqliteTestDatabase();
  (getDatabase as jest.Mock).mockResolvedValue(db);
  await db.execAsync(CREATE_TABLES_SQL);
  await db.runAsync(`INSERT INTO budgets (id, monthly_amount,currency,start_date,period_start,period_end,cycle_start_day,active)
    VALUES (1,1000,'PLN','2026-08','2026-08-01','2026-08-31',1,1), (2,800,'PLN','2026-09','2026-09-01','2026-09-30',1,1)`);
  await db.runAsync("INSERT INTO expenses (total_amount,currency,date) VALUES (980,'PLN','2026-08-10')");
});
afterEach(async () => db.close());

it('carries part of 20 zł without changing spending or generating income; repeat submits replace the total', async () => {
  await Promise.all([BudgetRolloverDao.save(1, 2, 15), BudgetRolloverDao.save(1, 2, 15)]);
  const source = (await BudgetDao.getContainingDate('2026-08-01'))!;
  const target = (await BudgetDao.getContainingDate('2026-09-01'))!;
  expect(await BudgetRolloverDao.status(source)).toMatchObject({ periodRemaining: 20, outgoing: 15, unallocated: 5, needsReview: false });
  expect(await BudgetRolloverDao.status(target)).toMatchObject({ incoming: 15, periodRemaining: 815 });
  expect(await BudgetRolloverDao.list()).toHaveLength(1);
  expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM extra_incomes')).toEqual({ n: 0 });
  expect(await db.getFirstAsync('SELECT SUM(total_amount) AS n FROM expenses')).toEqual({ n: 980 });
  expect(await BudgetRolloverDao.effectiveAmount(target, '2026-09-01', '2026-09-30')).toBe(815);
});

it('rejects overdraws and fractional cents without altering an existing transfer', async () => {
  await BudgetRolloverDao.save(1, 2, 15);
  await expect(BudgetRolloverDao.save(1, 2, 20.01)).rejects.toThrow('rollover_invalid_amount');
  await expect(BudgetRolloverDao.save(1, 2, 1.001)).rejects.toThrow('rollover_invalid_amount');
  expect((await BudgetRolloverDao.list())[0].amount_minor).toBe(1500);
});

it('warns after a late expense without silently changing the credit; allows explicit correction/reversal', async () => {
  await BudgetRolloverDao.save(1, 2, 20);
  await db.runAsync("INSERT INTO expenses (total_amount,date) VALUES (10,'2026-08-20')");
  const target = (await BudgetDao.getContainingDate('2026-09-01'))!;
  expect(await BudgetRolloverDao.status(target)).toMatchObject({ incoming: 20, periodRemaining: 820, needsReview: true });
  await BudgetRolloverDao.save(1, 2, 10);
  expect(await BudgetRolloverDao.status(target)).toMatchObject({ incoming: 10, needsReview: false });
  await BudgetRolloverDao.save(1, 2, 0);
  expect(await BudgetRolloverDao.status(target)).toMatchObject({ incoming: 0, periodRemaining: 800, needsReview: false });
});

it('protects participating periods from deletion, currency and boundary changes; amount edits retain the link', async () => {
  await BudgetRolloverDao.save(1, 2, 20);
  await expect(BudgetDao.deleteBudget(1)).rejects.toThrow('rollover_period_locked');
  await expect(BudgetDao.setMonthlyBudget(900, '2026-08', 'EUR')).rejects.toThrow('rollover_period_locked');
  await expect(BudgetDao.transitionAndSetBudget({ amount: 800, currency: 'PLN', previousStartDay: 1, nextStartDay: 21, effectiveDate: '2026-09-21' })).rejects.toThrow('rollover_period_locked');
  await BudgetDao.setMonthlyBudget(990, '2026-08', 'PLN');
  expect(await BudgetRolloverDao.status((await BudgetDao.getContainingDate('2026-09-01'))!)).toMatchObject({ incoming: 20, needsReview: true });
});

it('includes debt flows and extra income when determining available carryover', async () => {
  await db.runAsync("INSERT INTO extra_incomes (source,amount,currency,date,created_at) VALUES ('gift',5.25,'PLN','2026-08-12','2026-08-12T12:00:00Z')");
  await db.runAsync("INSERT INTO debts (id,amount,remaining,date,created_at) VALUES (1,10,6,'2026-08-12','2026-08-12T12:00:00Z')");
  await db.runAsync("INSERT INTO debt_payments (debt_id,amount,date,created_at) VALUES (1,4,'2026-08-13','2026-08-13T12:00:00Z')");
  await BudgetRolloverDao.save(1, 2, 31.25);
  expect((await BudgetRolloverDao.list())[0].amount_minor).toBe(3125);
  await expect(BudgetRolloverDao.save(1, 2, 31.26)).rejects.toThrow();
});

it('rejects future, nonadjacent, overlapping and different-currency periods', async () => {
  await db.runAsync("UPDATE budgets SET currency='EUR' WHERE id=2");
  await expect(BudgetRolloverDao.save(1, 2, 10)).rejects.toThrow('rollover_unavailable');
  await db.runAsync("UPDATE budgets SET currency='PLN', period_start='2026-09-02' WHERE id=2");
  await expect(BudgetRolloverDao.save(1, 2, 10)).rejects.toThrow('rollover_unavailable');
  await db.runAsync("UPDATE budgets SET period_start='2026-09-01' WHERE id=2");
  await db.runAsync("INSERT INTO budgets (id,monthly_amount,start_date,period_start,period_end,active) VALUES (3,800,'2026-10','2026-10-01','2026-10-31',1)");
  await expect(BudgetRolloverDao.save(2, 3, 10)).rejects.toThrow('rollover_unavailable');
  await db.runAsync("INSERT INTO budgets (monthly_amount,start_date,period_start,period_end,active) VALUES (1,'2026-08','2026-08-15','2026-08-31',1)");
  await expect(BudgetRolloverDao.save(1, 2, 10)).rejects.toThrow('rollover_unavailable');
});

it('propagates an upstream deficit and prevents forwarding unsupported funds', async () => {
  await db.runAsync("INSERT INTO budgets (id,monthly_amount,start_date,period_start,period_end,active) VALUES (3,0,'2026-07','2026-07-01','2026-07-31',1)");
  await db.runAsync(`INSERT INTO budget_rollovers VALUES ('00000000-0000-4000-8000-000000000001', '2026-07-01','2026-07-31','2026-08-01','2026-08-31','PLN',2000,'2026-08-01T12:00:00Z','2026-08-01T12:00:00Z')`);
  await expect(BudgetRolloverDao.save(1, 2, 20)).rejects.toThrow('rollover_review');
  expect(await BudgetRolloverDao.status((await BudgetDao.getContainingDate('2026-08-01'))!)).toMatchObject({ incoming: 20, needsReview: true });
});

it('reopens the additive schema without losing transfers and enforces source uniqueness in SQLite', async () => {
  await BudgetRolloverDao.save(1, 2, 20);
  await db.execAsync(BUDGET_ROLLOVERS_SCHEMA_SQL);
  expect(await BudgetRolloverDao.list()).toHaveLength(1);
  await expect(db.runAsync("INSERT INTO budget_rollovers SELECT 'another',source_start,source_end,target_start,target_end,currency,amount_minor,created_at,updated_at FROM budget_rollovers")).rejects.toThrow('UNIQUE');
});
