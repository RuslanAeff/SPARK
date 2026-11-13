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
    mockCategoryGetAll.mockResolvedValue([
      { id: 1, name: 'Diğer', parent_id: null },
      { id: 7, name: 'Market', parent_id: null },
    ]);
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

  describe('voucher_issued.expires_on (BUG-04)', () => {
    const voucherInsertParams = () => {
      const call = mockDbRun.mock.calls.find(([sql]) => String(sql).includes('container_deposit_vouchers'));
      expect(call).toBeDefined();
      return call![1] as unknown[];
    };

    it.each([
      ['31.12.2026'],
      ['2026-12-31T00:00'],
      ['2026-02-31'],
      ['2026-08-22'],
    ])('stores NULL instead of unsupported or pre-receipt expiry %s', async (expiresOn) => {
      await expect(processReceipt({
        ...validReceipt,
        voucher_issued: { amount: 2, expires_on: expiresOn },
      })).resolves.toBe(41);

      expect(voucherInsertParams()[4]).toBeNull();
    });

    it('keeps a valid expiry on or after the receipt date', async () => {
      await processReceipt({
        ...validReceipt,
        voucher_issued: { amount: 2, expires_on: '2026-08-23' },
      });

      expect(voucherInsertParams()[4]).toBe('2026-08-23');
    });
  });


  describe('category resolution queries (PERF-04)', () => {
    it('reads categories once for the whole receipt instead of per item', async () => {
      const items = Array.from({ length: 60 }, (_, index) => ({
        ...validReceipt.items[0],
        name: `Item ${index}`,
        category_key: index % 2 === 0 ? ('market' as const) : undefined,
        suggested_category: index % 2 === 0 ? 'Market' : 'Nonexistent',
      }));

      await processReceipt({ ...validReceipt, total: 375, items });

      expect(mockCategoryGetAll).toHaveBeenCalledTimes(1);
      expect(mockCategoryFindByName).not.toHaveBeenCalled();
      const ids = mockExpenseAddItem.mock.calls.map(([item]) => item.category_id);
      expect(ids.filter(id => id === 7)).toHaveLength(30);
      expect(ids.filter(id => id === 1)).toHaveLength(30);
    });
  });

  it('rejects a receipt dated more than two days in the future before writing (BUG-17)', async () => {
    await expect(processReceipt({ ...validReceipt, date: '2062-08-23' }))
      .rejects.toThrow('INVALID_RECEIPT_future_date');
    expect(mockDbTransaction).not.toHaveBeenCalled();
  });

  it('keeps the original foreign amount in the note of a converted receipt (BUG-01)', async () => {
    await processReceipt({ ...validReceipt, currency: 'PLN', original: { currency: 'EUR', total: 50 } });

    expect(mockExpenseCreate).toHaveBeenCalledWith(expect.objectContaining({
      currency: 'PLN',
      note: 'Fiş: Shop · 50.00 EUR',
    }));
  });
});
