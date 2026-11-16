// CQ-03: elle harcama kaydı ve depozito eşitlemesi tek işlem.
const mockCalls: string[] = [];
jest.mock('../../db/database', () => ({
  getDatabase: jest.fn(async () => ({
    withTransactionAsync: async (work: () => Promise<void>) => {
      mockCalls.push('begin');
      await work();
      mockCalls.push('commit');
    },
  })),
}));
jest.mock('../../db/expenseDao', () => ({
  ExpenseDao: {
    create: jest.fn(async () => { mockCalls.push('create'); return 41; }),
    update: jest.fn(async () => { mockCalls.push('update'); }),
  },
}));
jest.mock('../../db/containerDepositDao', () => ({
  ContainerDepositDao: { syncPurchaseRecovery: jest.fn(async () => { mockCalls.push('sync'); }) },
}));

import { ExpenseDao } from '../../db/expenseDao';
import { ContainerDepositDao } from '../../db/containerDepositDao';
import { saveManualExpense } from '../manualExpenseService';

const input = {
  total_amount: 25, currency: 'PLN', note: null, date: '2026-11-16', vendor_id: 3,
  category_id: 7, container_deposit_paid: 0.5, container_voucher_used: 0,
};

beforeEach(() => { mockCalls.length = 0; jest.clearAllMocks(); });

it('creates the expense and syncs deposit recovery inside one transaction', async () => {
  await expect(saveManualExpense(input, { voucherId: 9 })).resolves.toBe(41);
  expect(mockCalls).toEqual(['begin', 'create', 'sync', 'commit']);
  expect(ExpenseDao.create).toHaveBeenCalledWith({ ...input, receipt_uri: null });
  expect(ContainerDepositDao.syncPurchaseRecovery).toHaveBeenCalledWith(41, 9);
});

it('updates an existing expense when an id is given', async () => {
  await expect(saveManualExpense(input, { expenseId: 12 })).resolves.toBe(12);
  expect(mockCalls).toEqual(['begin', 'update', 'sync', 'commit']);
  expect(ExpenseDao.update).toHaveBeenCalledWith(12, input);
  expect(ContainerDepositDao.syncPurchaseRecovery).toHaveBeenCalledWith(12, undefined);
});
