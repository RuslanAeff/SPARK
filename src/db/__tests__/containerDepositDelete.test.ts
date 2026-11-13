jest.mock('../database', () => ({ getDatabase: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));

import { getDatabase } from '../database';
import { ContainerDepositDao } from '../containerDepositDao';
import { CONTAINER_DEPOSIT_SCHEMA_SQL, CREATE_TABLES_SQL } from '../schema';
import { sqliteTestDatabase } from './helpers/sqliteTestDatabase';

let db: ReturnType<typeof sqliteTestDatabase>;

beforeEach(async () => {
  db = sqliteTestDatabase();
  (getDatabase as jest.Mock).mockResolvedValue(db);
  await db.execAsync(CREATE_TABLES_SQL + CONTAINER_DEPOSIT_SCHEMA_SQL);
  await db.execAsync(`
    INSERT INTO expenses (id, total_amount, currency, date, created_at, container_voucher_used)
      VALUES (1, 10, 'PLN', '2026-11-05', 'x', 2);
    INSERT INTO container_deposit_vouchers (id, uid, amount, currency, issued_date, expires_on, status, redeemed_date, redemption_expense_id, created_at) VALUES
      (1, '11111111-1111-4111-8111-111111111111', 2, 'PLN', '2026-11-01', NULL, 'available', NULL, NULL, 'x'),
      (2, '22222222-2222-4222-8222-222222222222', 2, 'PLN', '2026-10-01', '2026-10-31', 'expired', NULL, NULL, 'x'),
      (3, '33333333-3333-4333-8333-333333333333', 2, 'PLN', '2026-11-01', NULL, 'redeemed', '2026-11-05', 1, 'x');
  `);
});
afterEach(async () => db.close());

describe('ContainerDepositDao.deleteVoucher (BUG-28)', () => {
  it.each([[1], [2]])('deletes an unused voucher (id %s)', async (id) => {
    await ContainerDepositDao.deleteVoucher(id);
    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM container_deposit_vouchers WHERE id = ?', [id])).toEqual({ n: 0 });
  });

  it('refuses to delete a redeemed voucher that pays for an expense', async () => {
    await expect(ContainerDepositDao.deleteVoucher(3)).rejects.toThrow('VOUCHER_NOT_DELETABLE');
    expect(await db.getFirstAsync('SELECT status FROM container_deposit_vouchers WHERE id = 3')).toEqual({ status: 'redeemed' });
  });

  it('reports a missing voucher', async () => {
    await expect(ContainerDepositDao.deleteVoucher(99)).rejects.toThrow('VOUCHER_NOT_DELETABLE');
  });
});
