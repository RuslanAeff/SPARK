// BUG-21: aynı üst altında aynı adlı ikinci kategori açılamaz (yedekte ayırt edilemez).
jest.mock('../database', () => ({ getDatabase: jest.fn() }));

import { getDatabase } from '../database';
import { CategoryDao } from '../categoryDao';
import { CREATE_TABLES_SQL } from '../schema';
import { sqliteTestDatabase } from './helpers/sqliteTestDatabase';

let db: ReturnType<typeof sqliteTestDatabase>;

beforeEach(async () => {
  db = sqliteTestDatabase();
  (getDatabase as jest.Mock).mockResolvedValue(db);
  await db.execAsync(CREATE_TABLES_SQL);
  await db.execAsync(`
    ALTER TABLE categories ADD COLUMN is_system INTEGER DEFAULT 0;
    INSERT INTO categories (id, name, parent_id) VALUES (1, 'Hobi', NULL), (2, 'Ulaşım', NULL), (3, 'Kitap', 1);
  `);
});
afterEach(async () => db.close());

describe('CategoryDao.create aynı ad kuralı (BUG-21)', () => {
  it('aynı üst altında aynı adı (büyük/küçük harf ve boşluk farkıyla da) reddeder', async () => {
    await expect(CategoryDao.create({ name: 'Kitap', parent_id: 1 })).rejects.toThrow('CATEGORY_NAME_EXISTS');
    await expect(CategoryDao.create({ name: '  kitap ', parent_id: 1 })).rejects.toThrow('CATEGORY_NAME_EXISTS');
    await expect(CategoryDao.create({ name: 'hobi', parent_id: null })).rejects.toThrow('CATEGORY_NAME_EXISTS');
    // BUG-14: ASCII dışı büyük/küçük harf de aynı ad sayılır.
    await db.runAsync("INSERT INTO categories (id, name, parent_id) VALUES (4, 'Şarküteri', NULL)");
    await expect(CategoryDao.create({ name: 'ŞARKÜTERİ', parent_id: null })).rejects.toThrow('CATEGORY_NAME_EXISTS');
    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM categories')).toEqual({ n: 4 });
  });

  it('farklı üst altında aynı ada izin verir', async () => {
    const id = await CategoryDao.create({ name: 'Kitap', parent_id: 2 });
    expect(await db.getFirstAsync('SELECT parent_id FROM categories WHERE id = ?', [id])).toEqual({ parent_id: 2 });
  });
});
