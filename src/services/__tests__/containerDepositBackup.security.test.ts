jest.mock('../../db/database', () => ({ getDatabase: jest.fn() }));
jest.mock('../boundedBackupReader', () => ({ readBoundedBackup: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: '/tmp' } }));
jest.mock('expo-file-system/legacy', () => ({ StorageAccessFramework: {} }));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-document-picker', () => ({}));
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));

import { getDatabase } from '../../db/database';
import { ContainerDepositDao } from '../../db/containerDepositDao';
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
  await db.runAsync("INSERT INTO expenses (id,total_amount,container_voucher_used,currency,date,created_at) VALUES (1,100,5,'PLN','2026-10-02','2026-10-02T12:00:00Z')");
  await ContainerDepositDao.createVoucher({ amount: 5, currency: 'PLN', issuedDate: '2026-10-01', expiresOn: '2026-12-01' });
  await db.withTransactionAsync(() => ContainerDepositDao.syncPurchaseRecovery(1));
  await db.runAsync("INSERT INTO container_deposit_recoveries (uid,amount,currency,date,method,created_at) VALUES ('123e4567-e89b-42d3-a456-426614174000',2,'PLN','2026-10-02','cash','2026-10-02T12:00:00Z')");
});
afterEach(async () => db.close());

it('round-trips purchase and legacy cash without duplicating either recovery', async () => {
  const payload = await buildBackupPayload({ start: '2026-10-01', end: '2026-10-03' });
  await db.close(); await open();
  await importBackupPayload(payload);
  await importBackupPayload(payload);
  expect(await db.getAllAsync('SELECT amount,method FROM container_deposit_recoveries ORDER BY amount'))
    .toEqual([{ amount: 2, method: 'cash' }, { amount: 5, method: 'purchase_voucher' }]);
  expect(await db.getFirstAsync('SELECT total_amount-container_voucher_used AS paid FROM expenses')).toEqual({ paid: 95 });
});

it('accepts an export that omits an out-of-range redemption and preserves the local link', async () => {
  const payload = await buildBackupPayload({ start: '2026-10-03', end: '2026-10-03' });
  expect(payload.data.container_deposit_vouchers![0].redemption_expense_source_id).toBeNull();
  expect(() => validateAndNormalizeBackupPayload(payload)).not.toThrow();
  await importBackupPayload(payload);
  expect(await db.getFirstAsync('SELECT redemption_expense_id FROM container_deposit_vouchers')).toEqual({ redemption_expense_id: 1 });
});

it.each(['recovery-content', 'voucher-link', 'second-recovery'])(
  'rolls back earlier writes when existing deposit data conflicts (%s)', async kind => {
    const payload = await buildBackupPayload({ start: '2026-10-01', end: '2026-10-03' });
    payload.data.categories.push({ name: 'Synthetic rollback category', icon: 'circle', color: '#112233', parent_name: null });
    if (kind === 'recovery-content') {
      payload.data.container_deposit_recoveries!.find(r => r.method === 'cash')!.amount = 9;
    } else if (kind === 'voucher-link') {
      await db.runAsync('UPDATE container_deposit_vouchers SET redemption_expense_id = NULL');
    } else {
      payload.data.container_deposit_recoveries!.find(r => r.method === 'purchase_voucher')!.uid =
        '223e4567-e89b-42d3-a456-426614174000';
    }
    await expect(importBackupPayload(payload)).rejects.toThrow('INVALID_FORMAT');
    expect(await db.getAllAsync('SELECT * FROM categories')).toEqual([]);
    expect(await db.getAllAsync('SELECT amount FROM container_deposit_recoveries ORDER BY amount')).toEqual([{ amount: 2 }, { amount: 5 }]);
  },
);
