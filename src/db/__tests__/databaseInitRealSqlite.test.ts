// Uygulamanın gerçek açılış zinciri (PRAGMA, bütünlük, şema, tüm migration'lar,
// tohumlama) bellek içi gerçek SQLite üzerinde çalıştırılır.
import { sqliteTestDatabase } from './helpers/sqliteTestDatabase';

let mockDb: ReturnType<typeof sqliteTestDatabase>;
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn(async () => mockDb) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));

async function openFresh() {
  let getDatabase!: typeof import('../database').getDatabase;
  jest.isolateModules(() => { ({ getDatabase } = require('../database')); });
  return getDatabase();
}

beforeEach(() => { mockDb = sqliteTestDatabase(); });
afterEach(async () => mockDb.close());

describe('database init on real SQLite', () => {
  it('seeds the category tree but no default budget on a clean install (BUG-23)', async () => {
    const db = await openFresh();

    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM budgets')).toEqual({ n: 0 });
    const categories = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM categories');
    expect(categories!.n).toBeGreaterThan(50);
  });

  it('does not bring back a budget the user deleted when the app opens again (BUG-23)', async () => {
    const first = await openFresh();
    await first.runAsync(`INSERT INTO budgets
      (monthly_amount, currency, start_date, period_start, period_end, cycle_start_day, active)
      VALUES (1200, 'PLN', '2026-11', '2026-11-01', '2026-11-30', 1, 1)`);
    await first.runAsync('DELETE FROM budgets');

    const reopened = await openFresh();

    expect(await reopened.getFirstAsync('SELECT COUNT(*) AS n FROM budgets')).toEqual({ n: 0 });
  });

  it('runs every migration idempotently and repairs malformed voucher expiries (BUG-04)', async () => {
    const db = await openFresh();
    await db.runAsync(`INSERT INTO container_deposit_vouchers
      (uid, amount, currency, issued_date, expires_on, status, created_at)
      VALUES ('11111111-1111-4111-8111-111111111111', 2, 'PLN', '2026-08-23', '31.12.2026', 'available', 'x')`);
    await db.runAsync("DELETE FROM settings WHERE key = 'migration_voucher_expiry_repair_v1'");

    const reopened = await openFresh();

    expect(await reopened.getFirstAsync('SELECT expires_on FROM container_deposit_vouchers'))
      .toEqual({ expires_on: null });
  });
});
