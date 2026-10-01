jest.mock('../database', () => ({ getDatabase: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));
jest.mock('../../utils/dateUtils', () => ({ getToday: () => '2026-09-30' }));

import { getDatabase } from '../database';
import { ContainerDepositDao } from '../containerDepositDao';
import { CREATE_TABLES_SQL } from '../schema';
import { sqliteTestDatabase } from './helpers/sqliteTestDatabase';

let db: ReturnType<typeof sqliteTestDatabase>;

beforeEach(async () => {
  db = sqliteTestDatabase();
  (getDatabase as jest.Mock).mockResolvedValue(db);
  await db.execAsync(CREATE_TABLES_SQL);
});

afterEach(async () => db.close());

it('tracks paid deposits, available vouchers, and cash recovery as separate amounts', async () => {
  await db.runAsync(
    `INSERT INTO expenses (total_amount, currency, date, container_deposit_paid)
     VALUES (25, 'PLN', '2026-09-20', 2)`,
  );
  const voucherId = await ContainerDepositDao.createVoucher({
    amount: 3.5,
    currency: 'pln',
    issuedDate: '2026-09-23',
    expiresOn: '2027-01-21',
  });

  expect(await ContainerDepositDao.getSummary('PLN')).toEqual({
    depositPaid: 2,
    recovered: 0,
    availableVoucher: 3.5,
  });

  await ContainerDepositDao.markRedeemed(voucherId, '2026-09-30');
  expect(await ContainerDepositDao.getSummary('PLN')).toEqual({
    depositPaid: 2,
    recovered: 3.5,
    availableVoucher: 0,
  });
});

it('links one exact voucher to a purchase and reverses that link when the used amount is removed', async () => {
  const voucherId = await ContainerDepositDao.createVoucher({
    amount: 4,
    currency: 'PLN',
    issuedDate: '2026-09-29',
  });
  const expense = await db.runAsync(
    `INSERT INTO expenses (total_amount, currency, date, container_voucher_used)
     VALUES (106.71, 'PLN', '2026-09-29', 4)`,
  );

  await db.withTransactionAsync(() => ContainerDepositDao.syncPurchaseRecovery(expense.lastInsertRowId));
  expect(await db.getFirstAsync(
    'SELECT status, redemption_expense_id FROM container_deposit_vouchers WHERE id = ?',
    [voucherId],
  )).toEqual({ status: 'redeemed', redemption_expense_id: expense.lastInsertRowId });
  expect(await ContainerDepositDao.getRecoveredByDateRange('2026-09-01', '2026-09-30', 'PLN')).toBe(4);

  await db.runAsync('UPDATE expenses SET container_voucher_used = 0 WHERE id = ?', [expense.lastInsertRowId]);
  await db.withTransactionAsync(() => ContainerDepositDao.syncPurchaseRecovery(expense.lastInsertRowId));
  expect(await db.getFirstAsync(
    'SELECT status, redemption_expense_id FROM container_deposit_vouchers WHERE id = ?',
    [voucherId],
  )).toEqual({ status: 'available', redemption_expense_id: null });
  expect(await ContainerDepositDao.getRecoveredByDateRange('2026-09-01', '2026-09-30', 'PLN')).toBe(0);
});

it('does not guess a voucher link when two available vouchers have the same amount', async () => {
  await ContainerDepositDao.createVoucher({ amount: 4, currency: 'PLN', issuedDate: '2026-09-20' });
  await ContainerDepositDao.createVoucher({ amount: 4, currency: 'PLN', issuedDate: '2026-09-21' });
  const expense = await db.runAsync(
    `INSERT INTO expenses (total_amount, currency, date, container_voucher_used)
     VALUES (20, 'PLN', '2026-09-29', 4)`,
  );

  await db.withTransactionAsync(() => ContainerDepositDao.syncPurchaseRecovery(expense.lastInsertRowId));

  expect(await db.getFirstAsync(
    "SELECT COUNT(*) AS count FROM container_deposit_vouchers WHERE status = 'redeemed'",
  )).toEqual({ count: 0 });
  expect(await ContainerDepositDao.getRecoveredByDateRange('2026-09-01', '2026-09-30', 'PLN')).toBe(4);
});
