const mockSyncPurchaseRecovery = jest.fn();
jest.mock('../../db/containerDepositDao', () => ({ ContainerDepositDao: { syncPurchaseRecovery: (...args: unknown[]) => mockSyncPurchaseRecovery(...args) } }));
const mockVendorFindByName = jest.fn();
const mockCategoryFindByName = jest.fn();
const mockCategoryGetAll = jest.fn();
const mockVendorFindOrCreate = jest.fn();
const mockExpenseCreate = jest.fn();
const mockExpenseAddItem = jest.fn();
const mockDbGetAll = jest.fn();
const mockDbRun = jest.fn();
const mockDbTransaction = jest.fn(async (operation: () => Promise<void>) => operation());

jest.mock('../../db/vendorDao', () => ({
  VendorDao: {
    findByName: (...args: unknown[]) => mockVendorFindByName(...args),
    findOrCreate: (...args: unknown[]) => mockVendorFindOrCreate(...args),
  },
}));

jest.mock('../../db/categoryDao', () => ({
  CategoryDao: {
    findByName: (...args: unknown[]) => mockCategoryFindByName(...args),
    getAll: (...args: unknown[]) => mockCategoryGetAll(...args),
  },
}));

jest.mock('../../db/database', () => ({ getDatabase: jest.fn(async () => ({
  getAllAsync: (...args: unknown[]) => mockDbGetAll(...args),
  runAsync: (...args: unknown[]) => mockDbRun(...args),
  withTransactionAsync: (operation: () => Promise<void>) => mockDbTransaction(operation),
})) }));
jest.mock('../../db/expenseDao', () => ({ ExpenseDao: {
  create: (...args: unknown[]) => mockExpenseCreate(...args),
  addItem: (...args: unknown[]) => mockExpenseAddItem(...args),
} }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '123e4567-e89b-42d3-a456-426614174000' }));
jest.mock('../../notifications/receiptNotifications', () => ({ appendReceiptSavedNotification: jest.fn() }));

import { processReceipt } from '../receiptParser';
import type { ParsedReceipt } from '../geminiService';

const validReceipt: ParsedReceipt = {
  vendor_name: 'Shop',
  date: '2026-08-23',
  translation_language: 'en',
  currency: 'USD',
  total: 12.5,
  items: [{
    name: 'Bread',
    turkish_name: 'Bread',
    category_key: 'market',
    suggested_category: 'Market',
    quantity: 1,
    measurement_unit: 'piece',
    unit_price: 12.5,
    total_price: 12.5,
  }],
};

describe('receiptParser prefill quality and currency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVendorFindByName.mockResolvedValue(null);
    mockCategoryFindByName.mockImplementation(async (name: string) => (
      name === 'Market' ? { id: 7, name: 'Market' } : null
    ));
    mockCategoryGetAll.mockResolvedValue([{ id: 1, name: 'Diğer' }]);
    mockVendorFindOrCreate.mockResolvedValue(3);
    mockExpenseCreate.mockResolvedValue(41);
    mockExpenseAddItem.mockResolvedValue(51);
    mockDbGetAll.mockResolvedValue([]);
    mockDbRun.mockResolvedValue({ changes: 1, lastInsertRowId: 61 });
  });

  it('persists deposit rows and voucher use in the same receipt transaction', async () => {
    mockDbGetAll.mockResolvedValue([{ id: 8 }]);
    const receipt: ParsedReceipt = {
      ...validReceipt,
      total: 17,
      container_deposit_paid: 0.5,
      container_voucher_used: 4,
      items: [
        validReceipt.items[0],
        {
          name: 'Butelka kaucja', quantity: 1, measurement_unit: 'piece',
          unit_price: 0.5, total_price: 0.5, financial_kind: 'container_deposit',
          category_key: 'other', suggested_category: 'Diğer',
        },
      ],
    };

    await expect(processReceipt(receipt)).resolves.toBe(41);

    expect(mockDbTransaction).toHaveBeenCalledTimes(1);
    expect(mockExpenseCreate).toHaveBeenCalledWith(expect.objectContaining({
      container_deposit_paid: 0.5,
      container_voucher_used: 4,
    }));
    expect(mockExpenseAddItem).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Butelka kaucja',
      financial_kind: 'container_deposit',
    }));
    expect(mockSyncPurchaseRecovery).toHaveBeenCalledWith(41);
  });

});
