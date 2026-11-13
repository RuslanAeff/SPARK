jest.mock('../../db/database', () => ({ getDatabase: jest.fn() }));
jest.mock('../boundedBackupReader', () => ({ readBoundedBackup: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: '/tmp' } }));
jest.mock('expo-file-system/legacy', () => ({ StorageAccessFramework: {} }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn() }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));

import { getDatabase } from '../../db/database';
import { CREATE_TABLES_SQL, PAYMENT_REMINDERS_SCHEMA_SQL } from '../../db/schema';
import { sqliteTestDatabase } from '../../db/__tests__/helpers/sqliteTestDatabase';
import { buildBackupPayload, validateAndNormalizeBackupPayload } from '../backupService';

let db: ReturnType<typeof sqliteTestDatabase>;

beforeEach(async () => {
  db = sqliteTestDatabase();
  (getDatabase as jest.Mock).mockResolvedValue(db);
  await db.execAsync(CREATE_TABLES_SQL + PAYMENT_REMINDERS_SCHEMA_SQL);
  await db.execAsync('ALTER TABLE categories ADD COLUMN is_system INTEGER DEFAULT 0; ALTER TABLE expense_items ADD COLUMN line_discount REAL DEFAULT 0; ALTER TABLE expense_items ADD COLUMN list_line_total_before_discount REAL;');
  await db.runAsync("INSERT INTO categories (id, name, icon, color) VALUES (5, 'Market', 'cart', '#00FF66')");
  await db.runAsync(`INSERT INTO expenses (id, total_amount, currency, date, created_at) VALUES
    (1, 10, 'PLN', '2026-09-02', '2026-09-02T10:00:00Z'),
    (2, 20, 'PLN', '2026-09-03', '2026-09-03T10:00:00Z'),
    (3, 0, 'PLN', '2026-09-04', '2026-09-04T10:00:00Z'),
    (4, 99, 'PLN', '2026-10-01', '2026-10-01T10:00:00Z')`);
  await db.runAsync(`INSERT INTO expense_items (id, expense_id, name, quantity, unit_price, total_price, category_id) VALUES
    (12, 2, 'B2', 1, 15, 15, 5),
    (10, 1, 'A1', 1, 10, 10, NULL),
    (11, 2, 'B1', 1, 5, 5, NULL),
    (40, 4, 'Out of range', 1, 99, 99, NULL)`);
});
afterEach(async () => db.close());

describe('buildBackupPayload item query (PERF-02)', () => {
  it('loads all items for the range with one query and keeps each expense\'s items in id order', async () => {
    const getAll = jest.spyOn(db, 'getAllAsync');

    const payload = await buildBackupPayload({ start: '2026-09-01', end: '2026-09-30' });

    const itemQueries = getAll.mock.calls.filter(([sql]) => String(sql).includes('FROM expense_items'));
    expect(itemQueries).toHaveLength(1);
    expect(payload.data.expenses.map(e => [e.source_id, e.items.map(i => i.source_id)])).toEqual([
      [1, [10]],
      [2, [11, 12]],
      [3, []],
    ]);
    expect(payload.data.expenses[1].items[1].category_name).toBe('Market');
    expect(payload.data.categories.map(c => c.name)).toContain('Market');
    expect(() => validateAndNormalizeBackupPayload(JSON.parse(JSON.stringify(payload)))).not.toThrow();
  });
});

describe('importBackupPayload duplicate item reads (PERF-09)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { importBackupPayload } = require('../backupService');

  it('re-importing the same backup reads existing items once, only for matching expenses', async () => {
    // Aralık dışı, eşleşmesi imkânsız eski harcama: kalemleri okunmamalı.
    await db.runAsync("INSERT INTO expenses (id, total_amount, currency, date, created_at) VALUES (5, 3, 'PLN', '2025-01-01', '2025-01-01T10:00:00Z')");
    await db.runAsync("INSERT INTO expense_items (id, expense_id, name, quantity, unit_price, total_price) VALUES (50, 5, 'Old', 1, 3, 3)");
    const payload = JSON.parse(JSON.stringify(
      await buildBackupPayload({ start: '2026-09-01', end: '2026-09-30' }),
    ));
    const before = await db.getFirstAsync('SELECT COUNT(*) AS n FROM expense_items');
    const getAll = jest.spyOn(db, 'getAllAsync');

    const summary = await importBackupPayload(payload);

    const itemReads = getAll.mock.calls.filter(([sql]) => String(sql).includes('FROM expense_items'));
    expect(itemReads).toHaveLength(1);
    expect(itemReads[0][1]).not.toContain(5);
    expect(summary.expensesAdded).toBe(0);
    expect(summary.expensesSkipped).toBe(3);
    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM expense_items')).toEqual(before);
  });

  it('keeps locally edited items of a duplicate expense and does not add the old copy (BUG-20)', async () => {
    const payload = JSON.parse(JSON.stringify(
      await buildBackupPayload({ start: '2026-09-01', end: '2026-09-30' }),
    ));
    await db.runAsync('UPDATE expense_items SET name = ? WHERE id = 11', ['B1 changed']);

    const summary = await importBackupPayload(payload);

    expect(summary).toMatchObject({ expensesAdded: 0, expensesSkipped: 3, itemsAdded: 0, keptLocal: 1 });
    expect(await db.getAllAsync('SELECT id, name FROM expense_items WHERE expense_id = 2 ORDER BY id'))
      .toEqual([{ id: 11, name: 'B1 changed' }, { id: 12, name: 'B2' }]);
  });
});

describe('backup export privacy (SEC-01)', () => {
  it('never writes local device file paths into the backup', async () => {
    await db.runAsync("INSERT INTO vendors (id, name, logo_uri) VALUES (7, 'Biedronka', 'file:///data/user/0/app/cache/ImagePicker/logo.jpg')");
    await db.runAsync("UPDATE expenses SET vendor_id = 7, receipt_uri = 'content://media/external/images/42' WHERE id = 1");

    const payload = await buildBackupPayload({ start: '2026-09-01', end: '2026-09-30' });
    const json = JSON.stringify(payload);

    expect(json).not.toMatch(/file:\/\/|content:\/\//);
    expect(payload.data.vendors.find(v => v.name === 'Biedronka')?.logo_uri).toBeNull();
    expect(payload.data.expenses.find(e => e.source_id === 1)?.receipt_uri).toBeNull();
  });
});

describe('backup import category appearance (SEC-09)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { importBackupPayload } = require('../backupService');

  it('replaces malformed category icon and color with safe defaults instead of persisting them', async () => {
    await db.runAsync("UPDATE categories SET icon = 'not-an-icon', color = 'url(x);red' WHERE id = 5");
    const payload = JSON.parse(JSON.stringify(
      await buildBackupPayload({ start: '2026-09-01', end: '2026-09-30' }),
    ));
    await db.close();
    db = sqliteTestDatabase();
    (getDatabase as jest.Mock).mockResolvedValue(db);
    await db.execAsync(CREATE_TABLES_SQL + PAYMENT_REMINDERS_SCHEMA_SQL);
    await db.execAsync('ALTER TABLE categories ADD COLUMN is_system INTEGER DEFAULT 0; ALTER TABLE expense_items ADD COLUMN line_discount REAL DEFAULT 0; ALTER TABLE expense_items ADD COLUMN list_line_total_before_discount REAL;');

    await importBackupPayload(payload);

    expect(await db.getFirstAsync("SELECT icon, color FROM categories WHERE name = 'Market'"))
      .toEqual({ icon: 'tag-outline', color: '#7C6BFF' });
  });
});
