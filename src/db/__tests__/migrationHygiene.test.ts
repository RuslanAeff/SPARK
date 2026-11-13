// BUG-18: kolon geçişleri gerçek hatayı yutmaz; ilk kurulum tohumlaması atomiktir.
import { sqliteTestDatabase } from './helpers/sqliteTestDatabase';
import { addColumnIfMissing } from '../schemaColumns';
import { DEFAULT_CATEGORIES } from '../schema';

let mockDb: ReturnType<typeof sqliteTestDatabase>;
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn(async () => mockDb) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));

beforeEach(() => { mockDb = sqliteTestDatabase(); });
afterEach(async () => mockDb.close());

const DEFAULT_CATEGORY_COUNT = DEFAULT_CATEGORIES.reduce(
  (sum, category) => sum + 1 + (category.children?.length ?? 0), 0,
);

/** Test SQLite'ı expo-sqlite yüzeyine uyarlanır (yalnız tür). */
const asDb = () => mockDb as unknown as Parameters<typeof addColumnIfMissing>[0];

function loadDatabaseModule(): typeof import('../database') {
  let mod!: typeof import('../database');
  jest.isolateModules(() => { mod = require('../database'); });
  return mod;
}

describe('addColumnIfMissing', () => {
  it('adds a missing column once and skips an existing one', async () => {
    await mockDb.execAsync('CREATE TABLE t (id INTEGER PRIMARY KEY);');
    expect(await addColumnIfMissing(asDb(), 't', 'note', 'TEXT')).toBe(true);
    expect(await addColumnIfMissing(asDb(), 't', 'note', 'TEXT')).toBe(false);
    const columns: Array<{ name: string }> = await mockDb.getAllAsync('PRAGMA table_info(t);');
    expect(columns.map(c => c.name)).toEqual(['id', 'note']);
  });

  it('leaves a not-yet-created table to the schema', async () => {
    expect(await addColumnIfMissing(asDb(), 'missing_table', 'uid', 'TEXT')).toBe(false);
  });

  it('surfaces a real ALTER failure instead of swallowing it', async () => {
    await mockDb.execAsync('CREATE TABLE t (id INTEGER PRIMARY KEY); INSERT INTO t (id) VALUES (1);');
    // Dolu tabloya SQLite NOT NULL kolonu varsayılansız ekleyemez: "kolon zaten var" değil, gerçek hata.
    await expect(addColumnIfMissing(asDb(), 't', 'broken', 'TEXT NOT NULL')).rejects.toThrow();
  });

  it('rejects unsafe identifiers', async () => {
    await expect(addColumnIfMissing(asDb(), 't; DROP TABLE x', 'a', 'TEXT')).rejects.toThrow('Invalid schema identifier');
  });
});

describe('first-run category seeding', () => {
  it('writes either the whole default tree or nothing, then recovers on the next launch', async () => {
    const realRun = mockDb.runAsync;
    let categoryInserts = 0;
    mockDb.runAsync = (async (sql: string, params?: unknown[]) => {
      if (/INSERT INTO categories/.test(sql) && ++categoryInserts === 30) {
        throw new Error('simulated crash mid-seed');
      }
      return realRun(sql, params);
    }) as typeof mockDb.runAsync;

    await expect(loadDatabaseModule().getDatabase()).rejects.toThrow('simulated crash mid-seed');
    const afterCrash = await mockDb.getFirstAsync('SELECT COUNT(*) AS n FROM categories');
    expect(afterCrash).toEqual({ n: 0 });

    // Sonraki açılış (aynı veritabanı) tohumlamayı baştan ve eksiksiz yapar.
    mockDb.runAsync = realRun;
    const db = await loadDatabaseModule().getDatabase();
    const count = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM categories');
    expect(count?.n).toBe(DEFAULT_CATEGORY_COUNT);
  });

  it('opens an existing database twice without migration errors', async () => {
    const first = await loadDatabaseModule().getDatabase();
    await first.runAsync("INSERT INTO vendors (name, name_key) VALUES ('Żabka', 'żabka')");
    const second = await loadDatabaseModule().getDatabase();
    const vendor = await second.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM vendors');
    expect(vendor?.n).toBe(1);
    const categories = await second.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM categories');
    expect(categories?.n).toBe(DEFAULT_CATEGORY_COUNT);
  });
});
