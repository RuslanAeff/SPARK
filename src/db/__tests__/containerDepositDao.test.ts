jest.mock('../database', () => ({ getDatabase: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));
jest.mock('../../utils/dateUtils', () => ({ getToday: () => '2026-09-30' }));

import { getDatabase } from '../database';
import { ExpenseDao } from '../expenseDao';
import { computeDebtAdjustedBudget } from '../../utils/debtMath';
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

  await db.runAsync("UPDATE container_deposit_vouchers SET status = 'redeemed' WHERE id = ?", [voucherId]);
  await db.runAsync("INSERT INTO container_deposit_recoveries (uid, voucher_id, amount, currency, date, method, created_at) VALUES ('00000000-0000-4000-8000-000000000001', ?, 3.5, 'PLN', '2026-09-30', 'cash', '2026-09-30')", [voucherId]);
  expect(await ContainerDepositDao.getCashRecoveredByDateRange('2026-09-01', '2026-09-30', 'PLN')).toBe(3.5);
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


it('spends voucher value on the purchase date without increasing the budget or discounting the receipt', async () => {
  const voucher = await ContainerDepositDao.createVoucher({ amount: 5, currency: 'PLN', issuedDate: '2026-08-20' });
  expect(await ContainerDepositDao.getCashRecoveredByDateRange('2026-08-01', '2026-08-31', 'PLN')).toBe(0);
  const expense = await db.runAsync("INSERT INTO expenses (total_amount, currency, date, container_voucher_used) VALUES (100, 'PLN', '2026-09-20', 5)");
  await db.withTransactionAsync(() => ContainerDepositDao.syncPurchaseRecovery(expense.lastInsertRowId, voucher));
  const cash = await ExpenseDao.getCashSpentByDateRange('2026-09-01', '2026-09-30');
  expect(cash).toBe(95);
  expect(await ExpenseDao.getCashSpendingByDays('2026-09-01', '2026-09-30')).toEqual([{ date: '2026-09-20', total: 95 }]);
  expect(await ExpenseDao.getTotalByDateRange('2026-09-01', '2026-09-30')).toBe(100);
  const refund = await ContainerDepositDao.getCashRecoveredByDateRange('2026-09-01', '2026-09-30', 'PLN');
  expect(refund).toBe(0);
  expect(computeDebtAdjustedBudget({ monthlyBudget: 1000, totalSpent: cash, borrowedIn: 0, repaidIn: 0, depositRecoveredIn: refund }))
    .toMatchObject({ effectiveBudget: 1000, remaining: 905, percentage: 10 });
  await db.withTransactionAsync(() => ContainerDepositDao.syncPurchaseRecovery(expense.lastInsertRowId));
  expect(await ContainerDepositDao.getSummary('PLN')).toMatchObject({ availableVoucher: 0, recovered: 5 });
  await db.runAsync('UPDATE expenses SET container_voucher_used = 0 WHERE id = ?', [expense.lastInsertRowId]);
  await db.withTransactionAsync(() => ContainerDepositDao.syncPurchaseRecovery(expense.lastInsertRowId));
  expect(await ExpenseDao.getCashSpentByDateRange('2026-09-01', '2026-09-30')).toBe(100);
  expect((await ContainerDepositDao.getById(voucher))?.status).toBe('available');
});

it('uses the selected voucher even when amounts match, and rejects repeat use atomically', async () => {
  const first = await ContainerDepositDao.createVoucher({ amount: 5, currency: 'PLN', issuedDate: '2026-09-01' });
  const selected = await ContainerDepositDao.createVoucher({ amount: 5, currency: 'PLN', issuedDate: '2026-09-01' });
  const expense = await db.runAsync("INSERT INTO expenses (total_amount, currency, date, container_voucher_used) VALUES (5, 'PLN', '2026-09-20', 5)");
  await db.withTransactionAsync(() => ContainerDepositDao.syncPurchaseRecovery(expense.lastInsertRowId, selected));
  expect((await ContainerDepositDao.getById(first))?.status).toBe('available');
  expect((await ContainerDepositDao.getById(selected))?.status).toBe('redeemed');
  expect(await ExpenseDao.getCashSpentByDateRange('2026-09-01', '2026-09-30')).toBe(0);
  await expect(db.withTransactionAsync(async () => {
    const next = await db.runAsync("INSERT INTO expenses (total_amount, currency, date, container_voucher_used) VALUES (10, 'PLN', '2026-09-21', 5)");
    await ContainerDepositDao.syncPurchaseRecovery(next.lastInsertRowId, selected);
  })).rejects.toThrow('CONTAINER_VOUCHER_NOT_AVAILABLE');
  expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM expenses')).toEqual({ n: 1 });
});

it.each([
  ['2026-09-21', null, 'PLN', 5],
  ['2026-09-01', '2026-09-19', 'PLN', 5],
  ['2026-09-01', null, 'USD', 5],
  ['2026-09-01', null, 'PLN', 4],
])('rejects incompatible selected vouchers (%s, %s, %s, %s)', async (issued, expiry, currency, amount) => {
  const id = await ContainerDepositDao.createVoucher({ amount: Number(amount), currency: currency!, issuedDate: issued!, expiresOn: expiry });
  await expect(db.withTransactionAsync(async () => {
    const expense = await db.runAsync("INSERT INTO expenses (total_amount, currency, date, container_voucher_used) VALUES (20, 'PLN', '2026-09-20', 5)");
    await ContainerDepositDao.syncPurchaseRecovery(expense.lastInsertRowId, id);
  })).rejects.toThrow('CONTAINER_VOUCHER_NOT_AVAILABLE');
  expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM expenses')).toEqual({ n: 0 });
});
