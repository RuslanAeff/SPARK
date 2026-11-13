// BUG-21 kabul kriteri: v7 yedeği alındıktan sonra tutarı değiştirilen harcama ve
// tamamen ödenen borç, aynı yedek geri yüklenince çoğalmaz. Gerçek SQLite ve
// uygulamanın tam açılış zinciri.
import { sqliteTestDatabase } from '../../db/__tests__/helpers/sqliteTestDatabase';

let mockDb: ReturnType<typeof sqliteTestDatabase>;
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn(async () => mockDb) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));
jest.mock('../boundedBackupReader', () => ({ readBoundedBackup: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: '/tmp' } }));
jest.mock('expo-file-system/legacy', () => ({ StorageAccessFramework: {} }));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-document-picker', () => ({}));

beforeEach(() => { mockDb = sqliteTestDatabase(); });
afterEach(async () => mockDb.close());

function load() {
  let m!: {
    database: typeof import('../../db/database');
    backup: typeof import('../backupService');
    debts: typeof import('../../db/debtDao');
    incomes: typeof import('../../db/incomeDao');
  };
  jest.isolateModules(() => {
    m = {
      database: require('../../db/database'),
      backup: require('../backupService'),
      debts: require('../../db/debtDao'),
      incomes: require('../../db/incomeDao'),
    };
  });
  return m;
}

const RANGE = { start: '2026-10-01', end: '2026-10-31' };

describe('kalıcı kimlikle içe aktarım (BUG-21)', () => {
  it('yedekten sonra değişen harcama, ödenen borç ve düzenlenen gelir çoğalmaz', async () => {
    const { database, backup, debts, incomes } = load();
    const db = await database.getDatabase();
    await db.runAsync(
      "INSERT INTO expenses (total_amount, currency, date, note, created_at) VALUES (40, 'PLN', '2026-10-05', 'market', '2026-10-05T10:00:00Z')",
    );
    const debtId = await debts.DebtDao.create({
      counterparty: 'Ali', amount: 100, date: '2026-10-06',
      dueDate: '2026-12-01', reminderEnabled: true,
    });
    await debts.DebtDao.repay(debtId, 30, '2026-10-07');
    await incomes.IncomeDao.create({ source: 'Bonus', amount: 50, date: '2026-10-08' });
    const payload = JSON.parse(JSON.stringify(await backup.buildBackupPayload(RANGE)));
    expect(payload.version).toBe(7);
    expect(payload.data.expenses[0].uid).toMatch(/^[0-9a-f-]{36}$/);

    // Yedekten sonra: tutar ve not değişti, borç tamamen ödendi (hatırlatıcı kapandı),
    // gelirin tutarı düzeltildi.
    await db.runAsync("UPDATE expenses SET total_amount = 45, note = 'market + ekmek'");
    await debts.DebtDao.repay(debtId, 70, '2026-10-20');
    await db.runAsync('UPDATE extra_incomes SET amount = 55');

    const summary = await backup.importBackupPayload(payload);

    expect(summary).toMatchObject({
      expensesAdded: 0, debtsAdded: 0, debtPaymentsAdded: 0, extraIncomesAdded: 0,
    });
    expect(summary.keptLocal).toBeGreaterThanOrEqual(3);
    expect(await db.getAllAsync('SELECT total_amount, note FROM expenses'))
      .toEqual([{ total_amount: 45, note: 'market + ekmek' }]);
    expect(await db.getAllAsync('SELECT status, remaining FROM debts'))
      .toEqual([{ status: 'settled', remaining: 0 }]);
    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM debt_payments')).toEqual({ n: 2 });
    expect(await db.getAllAsync('SELECT amount FROM extra_incomes')).toEqual([{ amount: 55 }]);
  });

  it('yeni cihaza geri yüklenen kayıtlar yedekteki kimliği taşır; ikinci yükleme bir şey eklemez', async () => {
    const { database, backup, debts } = load();
    const db = await database.getDatabase();
    await db.runAsync(
      "INSERT INTO expenses (total_amount, currency, date, created_at) VALUES (40, 'PLN', '2026-10-05', '2026-10-05T10:00:00Z')",
    );
    const debtId = await debts.DebtDao.create({ counterparty: 'Ali', amount: 100, date: '2026-10-06' });
    await debts.DebtDao.repay(debtId, 30, '2026-10-07');
    const payload = JSON.parse(JSON.stringify(await backup.buildBackupPayload(RANGE)));
    await mockDb.close();

    mockDb = sqliteTestDatabase();
    const fresh = load();
    const freshDb = await fresh.database.getDatabase();
    const first = await fresh.backup.importBackupPayload(payload);
    expect(first).toMatchObject({ expensesAdded: 1, debtsAdded: 1, debtPaymentsAdded: 1 });
    expect(await freshDb.getFirstAsync('SELECT uid FROM expenses')).toEqual({ uid: payload.data.expenses[0].uid });
    expect(await freshDb.getFirstAsync('SELECT uid FROM debts')).toEqual({ uid: payload.data.debts[0].uid });
    expect(await freshDb.getFirstAsync('SELECT uid FROM debt_payments')).toEqual({ uid: payload.data.debt_payments[0].uid });

    const second = await fresh.backup.importBackupPayload(payload);
    expect(second).toMatchObject({ expensesAdded: 0, debtsAdded: 0, debtPaymentsAdded: 0, keptLocal: 0 });
  });

  it('aynı adlı alt kategoriler üst kategori adıyla ayrılır', async () => {
    const { database, backup } = load();
    const db = await database.getDatabase();
    const roots = await db.getAllAsync<{ id: number; name: string }>(
      "SELECT id, name FROM categories WHERE parent_id IS NULL AND name IN ('Yeme-İçme', 'Ulaşım') ORDER BY name DESC",
    );
    expect(roots).toHaveLength(2);
    const ids: number[] = [];
    for (const root of roots) {
      const r = await db.runAsync(
        "INSERT INTO categories (name, icon, color, parent_id, is_system) VALUES ('Ortak', 'tag-outline', '#7C6BFF', ?, 0)",
        [root.id],
      );
      ids.push(Number(r.lastInsertRowId));
    }
    // İkinci "Ortak" (Ulaşım altında) kullanılan kategori.
    await db.runAsync(
      "INSERT INTO expenses (total_amount, currency, date, category_id, created_at) VALUES (40, 'PLN', '2026-10-05', ?, '2026-10-05T10:00:00Z')",
      [ids[1]],
    );
    const payload = JSON.parse(JSON.stringify(await backup.buildBackupPayload(RANGE)));
    expect(payload.data.expenses[0]).toMatchObject({ category_name: 'Ortak', category_parent_name: 'Ulaşım' });

    // Aynı cihazda harcama silinip yedek geri yüklenir: doğru "Ortak"a bağlanmalı.
    await db.runAsync('DELETE FROM expenses');
    await backup.importBackupPayload(payload);
    expect(await db.getFirstAsync('SELECT category_id FROM expenses')).toEqual({ category_id: ids[1] });
  });

  it('yedekteki "Şok" cihazdaki "ŞOK" satıcısına bağlanır; kopya satıcı oluşmaz (BUG-14)', async () => {
    const { database, backup } = load();
    const db = await database.getDatabase();
    await db.runAsync("INSERT INTO vendors (name, name_key) VALUES ('Şok', 'şok')");
    await db.runAsync(
      "INSERT INTO expenses (vendor_id, total_amount, currency, date, created_at) VALUES (1, 40, 'PLN', '2026-10-05', '2026-10-05T10:00:00Z')",
    );
    const payload = JSON.parse(JSON.stringify(await backup.buildBackupPayload(RANGE)));
    payload.data.vendors[0].name = 'ŞOK';
    payload.data.expenses[0].vendor_name = 'ŞOK';
    payload.data.expenses[0].uid = '623e4567-e89b-42d3-a456-426614174000';
    await db.runAsync('DELETE FROM expenses');

    const summary = await backup.importBackupPayload(payload);

    expect(summary).toMatchObject({ vendorsAdded: 0, expensesAdded: 1 });
    expect(await db.getAllAsync('SELECT name FROM vendors')).toEqual([{ name: 'Şok' }]);
    expect(await db.getFirstAsync('SELECT vendor_id FROM expenses')).toEqual({ vendor_id: 1 });
  });
});
