jest.mock('../database', () => ({ getDatabase: jest.fn() }));

import { getDatabase } from '../database';
import { ExpenseDao } from '../expenseDao';
import { CREATE_TABLES_SQL } from '../schema';
import { sqliteTestDatabase } from './helpers/sqliteTestDatabase';

let db: ReturnType<typeof sqliteTestDatabase>;

beforeEach(async () => {
  db = sqliteTestDatabase();
  (getDatabase as jest.Mock).mockResolvedValue(db);
  await db.execAsync(CREATE_TABLES_SQL);
  // Basılı toplam 68.80; yapay zekâ bir satırı atladı, kalemler 60.00.
  await db.execAsync(`
    INSERT INTO expenses (id, total_amount, currency, date, created_at) VALUES (9, 68.80, 'PLN', '2026-11-01', 'x'), (8, 1, 'PLN', '2026-11-01', 'x');
    INSERT INTO expense_items (id, expense_id, name, quantity, unit_price, total_price) VALUES
      (1, 9, 'MLEKO', 150, 0.4, 60.00),
      (2, 8, 'Başka fiş', 1, 1, 1);
  `);
});
afterEach(async () => db.close());

describe('ExpenseDao.updateItemLabel (BUG-03)', () => {
  it('changes only the label: printed total and money fields stay exactly the same', async () => {
    await ExpenseDao.updateItemLabel(9, 1, 'Süt');

    expect(await db.getFirstAsync('SELECT total_amount FROM expenses WHERE id = 9')).toEqual({ total_amount: 68.8 });
    expect(await db.getFirstAsync('SELECT user_label, quantity, unit_price, total_price FROM expense_items WHERE id = 1'))
      .toEqual({ user_label: 'Süt', quantity: 150, unit_price: 0.4, total_price: 60 });
  });

  it('refuses an item that belongs to another expense', async () => {
    await expect(ExpenseDao.updateItemLabel(9, 2, 'x')).rejects.toThrow('Receipt item does not belong to expense');
  });
});
