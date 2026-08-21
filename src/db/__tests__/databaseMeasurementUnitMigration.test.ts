import { ITEM_MEASUREMENT_UNIT_MIGRATION, migrateItemMeasurementUnitsOnce } from '../database';

describe('item measurement unit migration', () => {
  it('kolonu ekler, eski kesirli ağırlıkları dönüştürür ve markerı atomik yazar', async () => {
    const getFirstAsync = jest.fn().mockResolvedValue(null);
    const getAllAsync = jest.fn().mockResolvedValue([{ name: 'quantity' }]);
    const execAsync = jest.fn();
    const runAsync = jest.fn();
    const withTransactionAsync = jest.fn(async (operation: () => Promise<void>) => operation());
    const database = { getFirstAsync, getAllAsync, execAsync, runAsync, withTransactionAsync } as any;

    await migrateItemMeasurementUnitsOnce(database);

    expect(execAsync).toHaveBeenCalledWith(expect.stringContaining('ADD COLUMN measurement_unit'));
    expect(runAsync.mock.calls[0][0]).toContain("SET measurement_unit = 'kg'");
    expect(runAsync.mock.calls[1]).toEqual([
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [ITEM_MEASUREMENT_UNIT_MIGRATION, '1'],
    ]);
  });

  it('marker varsa tekrar çalışmaz', async () => {
    const getFirstAsync = jest.fn().mockResolvedValue({ value: '1' });
    const database = { getFirstAsync, getAllAsync: jest.fn(), withTransactionAsync: jest.fn() } as any;
    await migrateItemMeasurementUnitsOnce(database);
    expect(database.getAllAsync).not.toHaveBeenCalled();
    expect(database.withTransactionAsync).not.toHaveBeenCalled();
  });
});
