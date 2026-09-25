jest.mock('../database', () => ({ getDatabase: jest.fn() }));

import { getDatabase } from '../database';
import { BudgetDao } from '../budgetDao';
import { CREATE_TABLES_SQL } from '../schema';
import { sqliteTestDatabase } from './helpers/sqliteTestDatabase';

let db: ReturnType<typeof sqliteTestDatabase>;
beforeEach(async () => {
  db = sqliteTestDatabase();
  (getDatabase as jest.Mock).mockResolvedValue(db);
  await db.execAsync(CREATE_TABLES_SQL);
});
afterEach(async () => db.close());

async function insertBasePeriods() {
  await db.runAsync(`INSERT INTO budgets
    (id,monthly_amount,currency,start_date,period_start,period_end,cycle_start_day,active)
    VALUES (1,1000,'PLN','2026-07','2026-07-23','2026-08-22',23,1),
           (2,1100,'PLN','2026-09','2026-09-21','2026-10-20',21,1)`);
}

it('edits only the selected row amount and preserves its exact identity', async () => {
  await insertBasePeriods();
  await BudgetDao.updateBudgetAmount(1, 1250.25);
  expect(await BudgetDao.getById(1)).toMatchObject({
    monthly_amount: 1250.25,
    currency: 'PLN',
    period_start: '2026-07-23',
    period_end: '2026-08-22',
  });
  expect((await BudgetDao.getById(2))?.monthly_amount).toBe(1100);
});

it('continues the latest earlier plan forward without applying a future plan backward', async () => {
  await db.runAsync(`INSERT INTO budgets
    (id,monthly_amount,currency,start_date,period_start,period_end,cycle_start_day,active)
    VALUES (1,700,'PLN','2026-01','2026-01-01','2026-01-31',1,1),
           (2,1200,'PLN','2026-06','2026-06-01','2026-06-30',1,1)`);
  expect(await BudgetDao.getLatestAtOrBefore('2026-03-01')).toMatchObject({ id: 1, monthly_amount: 700 });
  expect(await BudgetDao.getLatestAtOrBefore('2025-12-31')).toBeNull();
});

it('repairs dates atomically but rejects invalid, overlapping and rollover-linked changes', async () => {
  await insertBasePeriods();
  await expect(BudgetDao.repairBudgetPeriod(1, '2026-08-40', '2026-09-20'))
    .rejects.toThrow('budget_repair_invalid_dates');
  await expect(BudgetDao.repairBudgetPeriod(1, '2026-09-20', '2026-09-30'))
    .rejects.toThrow('budget_repair_overlap');
  await BudgetDao.repairBudgetPeriod(1, '2026-07-24', '2026-08-23');
  expect(await BudgetDao.getById(1)).toMatchObject({
    start_date: '2026-07', period_start: '2026-07-24', period_end: '2026-08-23', cycle_start_day: 24,
  });

  await db.runAsync(`INSERT INTO budget_rollovers
    (uid,source_start,source_end,target_start,target_end,currency,amount_minor,created_at,updated_at)
    VALUES ('00000000-0000-4000-8000-000000000001','2026-07-24','2026-08-23','2026-09-21','2026-10-20','PLN',100,'x','x')`);
  await expect(BudgetDao.repairBudgetPeriod(1, '2026-07-25', '2026-08-24'))
    .rejects.toThrow('rollover_period_locked');
});

it('preserves the current 23rd-based period and creates a bridge before switching to the 21st', async () => {
  await db.runAsync(`INSERT INTO budgets
    (id,monthly_amount,currency,start_date,period_start,period_end,cycle_start_day,active)
    VALUES (1,1000,'PLN','2026-07','2026-07-23','2026-08-22',23,1)`);
  await db.runAsync("INSERT INTO settings(key,value) VALUES ('budget_cycle_start_day','23')");

  const result = await BudgetDao.applyCycleStartDayChange(21, '2026-08-21');
  expect(result.bridgeId).not.toBeNull();
  expect(await BudgetDao.getById(1)).toMatchObject({ period_start: '2026-07-23', period_end: '2026-08-22' });
  expect(await BudgetDao.getById(result.bridgeId!)).toMatchObject({
    monthly_amount: 1000, period_start: '2026-08-23', period_end: '2026-09-20', cycle_start_day: 21,
  });
  expect(await db.getFirstAsync("SELECT value FROM settings WHERE key='budget_cycle_start_day'"))
    .toEqual({ value: '21' });
});

it('does not allow a calendar transition to invent a budget when no plan exists', async () => {
  await expect(BudgetDao.applyCycleStartDayChange(21, '2026-08-21'))
    .rejects.toThrow('budget_cycle_requires_budget');
  expect(await db.getFirstAsync("SELECT value FROM settings WHERE key='budget_cycle_start_day'"))
    .toBeNull();
});

it('freezes an inherited current plan before changing the global calendar rule', async () => {
  await db.runAsync(`INSERT INTO budgets
    (monthly_amount,currency,start_date,period_start,period_end,cycle_start_day,active)
    VALUES (900,'PLN','2026-06','2026-06-23','2026-07-22',23,1)`);
  await db.runAsync("INSERT INTO settings(key,value) VALUES ('budget_cycle_start_day','23')");

  await BudgetDao.applyCycleStartDayChange(21, '2026-08-21');

  expect(await BudgetDao.getContainingDate('2026-08-21')).toMatchObject({
    monthly_amount: 900, period_start: '2026-07-23', period_end: '2026-08-22', cycle_start_day: 23,
  });
  expect(await BudgetDao.getContainingDate('2026-08-23')).toMatchObject({
    monthly_amount: 900, period_start: '2026-08-23', period_end: '2026-09-20', cycle_start_day: 21,
  });
});
