// FN-07: Hafta içi/sonu ayrımı dil bağımsız anahtar döndürür; etiket UI'da çevrilir.
jest.mock('../database', () => ({ getDatabase: jest.fn() }));

import { getDatabase } from '../database';
import { ExpenseDao } from '../expenseDao';
import { CREATE_TABLES_SQL } from '../schema';
import { DAY_TYPE_SEGMENT_LABEL_KEY } from '../../utils/spendSegment';
import { sqliteTestDatabase } from './helpers/sqliteTestDatabase';

let db: ReturnType<typeof sqliteTestDatabase>;

beforeEach(async () => {
  db = sqliteTestDatabase();
  (getDatabase as jest.Mock).mockResolvedValue(db);
  await db.execAsync(CREATE_TABLES_SQL);
  await db.execAsync("INSERT INTO vendors (id, name) VALUES (1, 'X');");
  const add = (date: string, amount: number) => db.runAsync(
    "INSERT INTO expenses (vendor_id, total_amount, currency, date) VALUES (1, ?, 'PLN', ?)",
    [amount, date],
  );
  await add('2026-11-14', 30); // Cumartesi
  await add('2026-11-15', 20); // Pazar
  await add('2026-11-16', 15); // Pazartesi
  await add('2026-11-18', 5);  // Çarşamba
});
afterEach(async () => db.close());

it('groups by language-independent day-type keys', async () => {
  const rows = await ExpenseDao.getWeekdayVsWeekend('2026-11-01', '2026-11-30');
  expect(rows).toEqual([
    { segment: 'weekend', total: 50 },
    { segment: 'weekday', total: 20 },
  ]);
  // Her anahtarın çeviri anahtarı vardır (etiket TR/EN/AZ/RU'da çevrilir).
  rows.forEach(row => expect(DAY_TYPE_SEGMENT_LABEL_KEY[row.segment]).toBeTruthy());
});
