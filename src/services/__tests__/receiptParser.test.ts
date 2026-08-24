const mockVendorFindByName = jest.fn();
const mockCategoryFindByName = jest.fn();
const mockCategoryGetAll = jest.fn();

jest.mock('../../db/vendorDao', () => ({
  VendorDao: {
    findByName: (...args: unknown[]) => mockVendorFindByName(...args),
  },
}));

jest.mock('../../db/categoryDao', () => ({
  CategoryDao: {
    findByName: (...args: unknown[]) => mockCategoryFindByName(...args),
    getAll: (...args: unknown[]) => mockCategoryGetAll(...args),
  },
}));

jest.mock('../../db/database', () => ({ getDatabase: jest.fn() }));
jest.mock('../../db/expenseDao', () => ({ ExpenseDao: {} }));

import { getPrefillFromParsedReceipt } from '../receiptParser';
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
  });

  it('fiş para birimini düzenleme ön dolumuna taşır', async () => {
    await expect(getPrefillFromParsedReceipt(validReceipt)).resolves.toMatchObject({
      amount: '12.50',
      currency: 'USD',
      categoryId: 7,
    });
  });

  it('geçersiz sıfır fişi DAO sorgusundan önce reddeder', async () => {
    await expect(getPrefillFromParsedReceipt({
      ...validReceipt,
      total: 0,
      items: [{ ...validReceipt.items[0], unit_price: 0, total_price: 0 }],
    })).rejects.toThrow('INVALID_RECEIPT_invalid_item');

    expect(mockVendorFindByName).not.toHaveBeenCalled();
    expect(mockCategoryFindByName).not.toHaveBeenCalled();
  });
});
