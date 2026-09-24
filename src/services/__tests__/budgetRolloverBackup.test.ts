jest.mock('../../db/database', () => ({ getDatabase: jest.fn() }));
jest.mock('../boundedBackupReader', () => ({ readBoundedBackup: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: '/tmp' } }));
jest.mock('expo-file-system/legacy', () => ({ StorageAccessFramework: {} }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn() }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));
jest.mock('../../utils/dateUtils', () => ({ getToday: () => '2026-09-21' }));

import { getDatabase } from '../../db/database';
import { BudgetDao } from '../../db/budgetDao';
import { BudgetRolloverDao } from '../../db/budgetRolloverDao';
import { CREATE_TABLES_SQL, PAYMENT_REMINDERS_SCHEMA_SQL } from '../../db/schema';
import { sqliteTestDatabase } from '../../db/__tests__/helpers/sqliteTestDatabase';
import { buildBackupPayload, importBackupPayload, validateAndNormalizeBackupPayload } from '../backupService';

let db: ReturnType<typeof sqliteTestDatabase>;
async function open() {
  db = sqliteTestDatabase();
  (getDatabase as jest.Mock).mockResolvedValue(db);
  await db.execAsync(CREATE_TABLES_SQL + PAYMENT_REMINDERS_SCHEMA_SQL);
  await db.execAsync('ALTER TABLE categories ADD COLUMN is_system INTEGER DEFAULT 0; ALTER TABLE expense_items ADD COLUMN line_discount REAL DEFAULT 0; ALTER TABLE expense_items ADD COLUMN list_line_total_before_discount REAL;');
}
beforeEach(async () => {
  await open();
  await db.runAsync(`INSERT INTO budgets (id,monthly_amount,currency,start_date,period_start,period_end,cycle_start_day,active)
    VALUES (1,1000,'PLN','2026-08','2026-08-01','2026-08-31',1,1), (2,800,'PLN','2026-09','2026-09-01','2026-09-30',1,1)`);
  await db.runAsync("INSERT INTO expenses (total_amount,currency,date,created_at) VALUES (980,'PLN','2026-08-10','2026-08-10T12:00:00Z')");
  await BudgetRolloverDao.save(1, 2, 20);
});
afterEach(async () => db.close());

it('exports complete linked periods and restores them on a new database without double credit on reimport', async () => {
  const payload = await buildBackupPayload({ start: '2026-09-15', end: '2026-09-20' });
  expect(payload.range).toEqual({ start: '2026-08-01', end: '2026-09-30' });
  expect(payload.data.expenses).toHaveLength(1);
  expect(payload.data.budgets).toHaveLength(2);
  expect(payload.data.budget_rollovers).toHaveLength(1);
  expect(validateAndNormalizeBackupPayload(payload).version).toBe(5);
  await db.close(); await open();
  expect((await importBackupPayload(payload)).rolloversAdded).toBe(1);
  expect((await importBackupPayload(payload)).rolloversSkipped).toBe(1);
  expect(await BudgetRolloverDao.status((await BudgetDao.getContainingDate('2026-08-01'))!)).toMatchObject({ periodRemaining: 20, outgoing: 20, unallocated: 0 });
  expect(await BudgetRolloverDao.status((await BudgetDao.getContainingDate('2026-09-01'))!)).toMatchObject({ incoming: 20, periodRemaining: 820, needsReview: false });
});

it('rejects corrupted or incomplete transfer payloads before writing', async () => {
  const original = await buildBackupPayload({ start: '2026-09-01', end: '2026-09-30' });
  const withoutSource = JSON.parse(JSON.stringify(original));
  withoutSource.data.budgets.shift();
  expect(() => validateAndNormalizeBackupPayload(withoutSource)).toThrow('INVALID_FORMAT');
  const duplicate = JSON.parse(JSON.stringify(original));
  duplicate.data.budget_rollovers.push(duplicate.data.budget_rollovers[0]);
  expect(() => validateAndNormalizeBackupPayload(duplicate)).toThrow('INVALID_FORMAT');
  const invalid = JSON.parse(JSON.stringify(original));
  invalid.data.budget_rollovers[0].amount_minor = 1.5;
  await expect(importBackupPayload(invalid)).rejects.toThrow('INVALID_FORMAT');
  expect((await BudgetRolloverDao.list())[0].amount_minor).toBe(2000);
});

it('rolls back other imported records if an existing carryover conflicts', async () => {
  const payload = await buildBackupPayload({ start: '2026-09-01', end: '2026-09-30' });
  await BudgetRolloverDao.save(1, 2, 15);
  payload.data.extra_incomes!.push({ source_id: 1, source: 'new gift', amount: 10, currency: 'PLN', date: '2026-08-15', note: null, created_at: '2026-08-15T12:00:00Z' });
  await expect(importBackupPayload(payload)).rejects.toThrow('INVALID_FORMAT');
  expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM extra_incomes')).toEqual({ n: 0 });
  expect((await BudgetRolloverDao.list())[0].amount_minor).toBe(1500);
});

it('accepts v4 without inventing carryovers', async () => {
  const payload = await buildBackupPayload({ start: '2026-09-01', end: '2026-09-30' });
  payload.version = 4; delete payload.data.budget_rollovers;
  expect(validateAndNormalizeBackupPayload(payload).data.budget_rollovers).toEqual([]);
});
