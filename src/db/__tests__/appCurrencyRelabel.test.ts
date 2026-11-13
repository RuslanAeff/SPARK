import { sqliteTestDatabase } from './helpers/sqliteTestDatabase';

let mockDb: ReturnType<typeof sqliteTestDatabase>;
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn(async () => mockDb) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));

beforeEach(() => { mockDb = sqliteTestDatabase(); });
afterEach(async () => mockDb.close());

const TABLES = [
  'expenses', 'budgets', 'debts', 'extra_incomes', 'container_deposit_vouchers',
  'container_deposit_recoveries', 'budget_rollovers', 'recurring_payment_reminders',
  'subscriptions', 'savings_goal',
];

describe('setAppCurrency (BUG-01 6b): currency is a label for every record', () => {
  it('relabels every currency column and the setting in one transaction, keeping amounts', async () => {
    let getDatabase!: typeof import('../database').getDatabase;
    let setAppCurrency!: typeof import('../appCurrencyDao').setAppCurrency;
    jest.isolateModules(() => {
      ({ getDatabase } = require('../database'));
      ({ setAppCurrency } = require('../appCurrencyDao'));
    });
    const db = await getDatabase();
    await db.execAsync(`
      INSERT INTO vendors (id, name) VALUES (1, 'Netflix');
      INSERT INTO expenses (id, total_amount, currency, date, created_at) VALUES (1, 49.99, 'PLN', '2026-11-01', 'x');
      INSERT INTO budgets (id, monthly_amount, currency, start_date, period_start, period_end, cycle_start_day, active)
        VALUES (1, 3000, 'PLN', '2026-10', '2026-10-01', '2026-10-31', 1, 1),
               (2, 3000, 'PLN', '2026-11', '2026-11-01', '2026-11-30', 1, 1);
      INSERT INTO debts (id, counterparty, amount, remaining, currency, date, created_at) VALUES (1, 'Ali', 100, 100, 'PLN', '2026-11-01', 'x');
      INSERT INTO extra_incomes (id, source, amount, currency, date, created_at) VALUES (1, 'Bonus', 50, 'PLN', '2026-11-01', 'x');
      INSERT INTO container_deposit_vouchers (id, uid, amount, currency, issued_date, status, created_at)
        VALUES (1, '11111111-1111-4111-8111-111111111111', 2, 'PLN', '2026-11-01', 'available', 'x');
      INSERT INTO container_deposit_recoveries (uid, amount, currency, date, method, created_at)
        VALUES ('22222222-2222-4222-8222-222222222222', 1, 'PLN', '2026-11-01', 'cash', 'x');
      INSERT INTO budget_rollovers (uid, source_start, source_end, target_start, target_end, currency, amount_minor, created_at, updated_at)
        VALUES ('33333333-3333-4333-8333-333333333333', '2026-10-01', '2026-10-31', '2026-11-01', '2026-11-30', 'PLN', 1000, 'x', 'x');
      INSERT INTO subscriptions (vendor_id, amount, currency, period_days, last_seen_date, next_expected_date, occurrences, status, updated_at)
        VALUES (1, 49.99, 'PLN', 30, '2026-11-01', '2026-12-01', 3, 'active', 'x');
      INSERT INTO recurring_payment_reminders
        (uid, title, expected_amount, currency, anchor_date, next_due_date, recurrence_unit, recurrence_interval,
         reminder_days_before, reminder_time, status, source, created_at, updated_at)
        VALUES ('44444444-4444-4444-8444-444444444444', 'Kira', 2000, 'PLN', '2026-11-01', '2026-12-01', 'month', 1,
         3, '09:00', 'active', 'manual', 'x', 'x');
      INSERT INTO savings_goal (id, title, target_amount, target_date, currency, current_amount) VALUES (1, 'Tatil', 1000, '2027-06-01', 'PLN', 10);
    `);

    await setAppCurrency('EUR');

    for (const table of TABLES) {
      const rows = await db.getAllAsync<{ currency: string }>(`SELECT currency FROM ${table}`);
      expect({ table, hasRows: rows.length > 0 }).toEqual({ table, hasRows: true });
      expect(rows.every(row => row.currency === 'EUR')).toBe(true);
    }
    expect(await db.getFirstAsync('SELECT total_amount FROM expenses WHERE id = 1')).toEqual({ total_amount: 49.99 });
    expect(await db.getFirstAsync("SELECT value FROM settings WHERE key = 'display_currency'")).toEqual({ value: 'EUR' });
  });

  it('rejects a malformed currency code without writing', async () => {
    let setAppCurrency!: typeof import('../appCurrencyDao').setAppCurrency;
    jest.isolateModules(() => { ({ setAppCurrency } = require('../appCurrencyDao')); });
    await expect(setAppCurrency('euro' as any)).rejects.toThrow('INVALID_CURRENCY');
  });
});
