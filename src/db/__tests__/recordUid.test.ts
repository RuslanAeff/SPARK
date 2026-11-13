// BUG-21: harcama/borç/ödeme/ek gelir kalıcı kimliği.
import { sqliteTestDatabase } from './helpers/sqliteTestDatabase';

let mockDb: ReturnType<typeof sqliteTestDatabase>;
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn(async () => mockDb) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));

beforeEach(() => { mockDb = sqliteTestDatabase(); });
afterEach(async () => mockDb.close());

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function load() {
  let m!: {
    database: typeof import('../database');
    recordUid: typeof import('../recordUid');
    validation: typeof import('../../utils/inputValidation');
  };
  jest.isolateModules(() => {
    m = {
      database: require('../database'),
      recordUid: require('../recordUid'),
      validation: require('../../utils/inputValidation'),
    };
  });
  return m;
}

describe('kalıcı kayıt kimliği (BUG-21)', () => {
  it('yeni satırlar uygulamanın her yolundan geçerli ve farklı bir UUID alır', async () => {
    const { database, validation } = load();
    const db = await database.getDatabase();
    await db.execAsync(`
      INSERT INTO expenses (total_amount, currency, date) VALUES (10, 'PLN', '2026-11-01'), (10, 'PLN', '2026-11-01');
      INSERT INTO debts (counterparty, amount, remaining, date, created_at) VALUES ('Ali', 100, 100, '2026-11-01', 'x');
      INSERT INTO debt_payments (debt_id, amount, date, created_at) VALUES (1, 10, '2026-11-02', 'x');
      INSERT INTO extra_incomes (source, amount, date, created_at) VALUES ('Bonus', 50, '2026-11-01', 'x');
    `);
    const uids: string[] = [];
    for (const table of ['expenses', 'debts', 'debt_payments', 'extra_incomes']) {
      for (const row of await db.getAllAsync<{ uid: string }>(`SELECT uid FROM ${table}`)) {
        expect(row.uid).toMatch(UUID);
        expect(validation.normalizeCanonicalUuid(row.uid)).toBe(row.uid);
        uids.push(row.uid);
      }
    }
    expect(new Set(uids).size).toBe(5);
  });

  it('eski kurulumda kolonu ekler, mevcut satırlara bir kez kimlik verir ve kimliği korur', async () => {
    const { database, recordUid } = load();
    const db = await database.getDatabase();
    await db.execAsync(`
      DROP TRIGGER trg_expenses_uid;
      INSERT INTO expenses (total_amount, currency, date) VALUES (10, 'PLN', '2026-11-01'), (20, 'PLN', '2026-11-02');
    `);
    expect(await db.getAllAsync('SELECT uid FROM expenses')).toEqual([{ uid: null }, { uid: null }]);

    await recordUid.ensureRecordUids(db);
    const first = await db.getAllAsync<{ uid: string }>('SELECT uid FROM expenses ORDER BY id');
    expect(first.every(row => UUID.test(row.uid))).toBe(true);
    expect(first[0].uid).not.toBe(first[1].uid);

    await recordUid.ensureRecordUids(db);
    expect(await db.getAllAsync('SELECT uid FROM expenses ORDER BY id')).toEqual(first);
    await expect(db.runAsync('UPDATE expenses SET uid = ? WHERE id = 2', [first[0].uid])).rejects.toThrow();
  });
});
