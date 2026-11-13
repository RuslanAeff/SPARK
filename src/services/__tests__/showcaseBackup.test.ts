jest.mock('../../db/database', () => ({ getDatabase: jest.fn() }));
jest.mock('../boundedBackupReader', () => ({ readBoundedBackup: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: '/tmp' } }));
jest.mock('expo-file-system/legacy', () => ({ StorageAccessFramework: {} }));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-document-picker', () => ({}));
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));

import fs from 'node:fs';
import path from 'node:path';
import { getDatabase } from '../../db/database';
import { CREATE_TABLES_SQL, PAYMENT_REMINDERS_SCHEMA_SQL } from '../../db/schema';
import { sqliteTestDatabase } from '../../db/__tests__/helpers/sqliteTestDatabase';
import { buildBackupPayload, importBackupPayload, validateAndNormalizeBackupPayload } from '../backupService';

it('imports the fictional showcase, preserves totals and identities, and safely reimports', async () => {
  const payload = JSON.parse(fs.readFileSync(path.resolve(__dirname,
    '../../../artifacts/showcase/spark-showcase-europe_2026-05-01_2026-10-08.json'), 'utf8'));
  validateAndNormalizeBackupPayload(payload);
  for (const expense of payload.data.expenses) {
    expect(Math.round(expense.items.reduce((s: number, i: { total_price: number }) => s + i.total_price, 0) * 100))
      .toBe(Math.round(expense.total_amount * 100));
    expect(expense.date >= payload.range.start && expense.date <= payload.range.end).toBe(true);
    expect(expense.receipt_uri).toBeNull();
  }
  const db = sqliteTestDatabase();
  (getDatabase as jest.Mock).mockResolvedValue(db);
  try {
    await db.execAsync(CREATE_TABLES_SQL + PAYMENT_REMINDERS_SCHEMA_SQL);
    await db.execAsync('ALTER TABLE categories ADD COLUMN is_system INTEGER DEFAULT 0; ALTER TABLE expense_items ADD COLUMN line_discount REAL DEFAULT 0; ALTER TABLE expense_items ADD COLUMN list_line_total_before_discount REAL;');
    await importBackupPayload(payload);
    await importBackupPayload(payload);
    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM expenses')).toEqual({ n: payload.data.expenses.length });
    const sum = await db.getFirstAsync('SELECT ROUND(SUM(total_amount), 2) AS total FROM expenses');
    expect(sum.total).toBe(Math.round(payload.data.expenses.reduce((s: number, e: { total_amount: number }) => s + e.total_amount, 0) * 100) / 100);
    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM expense_items WHERE canonical_product_id IS NULL')).toEqual({ n: 0 });
    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM debt_payments')).toEqual({ n: 2 });
    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM recurring_payment_reminders')).toEqual({ n: 4 });
    const exported = await buildBackupPayload(payload.range);
    expect(() => validateAndNormalizeBackupPayload(exported)).not.toThrow();
    expect(exported.data.expenses).toHaveLength(payload.data.expenses.length);
  } finally { await db.close(); }
}, 30000);
