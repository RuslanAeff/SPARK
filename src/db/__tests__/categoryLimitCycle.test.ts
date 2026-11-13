// BUG-22: kategori limitleri bütçe döngüsüne bağlı (ürün kararı B, devralma yok).
import { sqliteTestDatabase } from './helpers/sqliteTestDatabase';

let mockDb: ReturnType<typeof sqliteTestDatabase>;
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn(async () => mockDb) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));

beforeEach(() => { mockDb = sqliteTestDatabase(); });
afterEach(async () => mockDb.close());

type Modules = {
  database: typeof import('../database');
  goalDao: typeof import('../goalDao');
  limitDao: typeof import('../categoryLimitDao');
  limitCycle: typeof import('../../services/limitCycle');
};

async function openApp(): Promise<Modules & { db: Awaited<ReturnType<typeof import('../database').getDatabase>>; marketId: number }> {
  let modules!: Modules;
  jest.isolateModules(() => {
    modules = {
      database: require('../database'),
      goalDao: require('../goalDao'),
      limitDao: require('../categoryLimitDao'),
      limitCycle: require('../../services/limitCycle'),
    };
  });
  const db = await modules.database.getDatabase();
  const market = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM categories WHERE name = 'Market' LIMIT 1",
  );
  return { ...modules, db, marketId: market!.id };
}

async function rearmMigration(db: Awaited<ReturnType<typeof import('../database').getDatabase>>, anchor: number) {
  await db.runAsync("DELETE FROM settings WHERE key = 'migration_category_limit_cycle_v1'");
  await db.runAsync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ('budget_cycle_start_day', ?)",
    [String(anchor)],
  );
}

describe('kategori limiti dönemi (BUG-22)', () => {
  it('kabul: döngü günü 23 iken kaydedilen limit, döngünün tüm harcamasıyla aynı satırdan okunur', async () => {
    const { db, marketId, goalDao, limitDao, limitCycle } = await openApp();
    await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('budget_cycle_start_day', '23')");
    await db.execAsync(`
      INSERT INTO expenses (total_amount, currency, date, category_id, created_at) VALUES
        (120, 'PLN', '2026-10-25', ${marketId}, 'x'),
        (80,  'PLN', '2026-11-10', ${marketId}, 'x'),
        (999, 'PLN', '2026-10-20', ${marketId}, 'x');
    `);

    const { cycle } = await limitCycle.resolveBudgetCycle('2026-11-11');
    expect(cycle).toMatchObject({ key: '2026-10', start: '2026-10-23', end: '2026-11-22' });
    await goalDao.GoalDao.saveSettings({
      goal: null, month: cycle.key, limits: [{ category_id: marketId, limit_amount: 150 }],
    });

    const rows = await limitDao.CategoryLimitDao.getForMonthWithSpending(cycle.key, cycle.start, cycle.end);
    // 25 Ekim harcaması takvim ayı dışında kalsa da döngüye girer; 20 Ekim önceki döngüdür.
    expect(rows.map(r => ({ category_id: r.category_id, limit: r.limit_amount, spent: r.spent })))
      .toEqual([{ category_id: marketId, limit: 150, spent: 200 }]);
    // Devralma yok: sonraki döngüde limit listesi boştur.
    expect(await limitDao.CategoryLimitDao.getForMonth('2026-11')).toEqual([]);
  });

  it('geçiş: takvim ayına yazılmış mevcut limitler bir kez güncel döngünün anahtarına taşınır', async () => {
    const { db, marketId, database } = await openApp();
    await rearmMigration(db, 23);
    await db.runAsync(
      "INSERT INTO category_limits (category_id, month, limit_amount) VALUES (?, '2026-11', 300), (?, '2026-09', 50)",
      [marketId, marketId],
    );

    await database.migrateCategoryLimitsToCycleOnce(db, '2026-11-11');

    expect(await db.getAllAsync('SELECT month, limit_amount FROM category_limits ORDER BY month'))
      .toEqual([{ month: '2026-09', limit_amount: 50 }, { month: '2026-10', limit_amount: 300 }]);
    expect(await db.getFirstAsync(
      "SELECT value FROM settings WHERE key = 'migration_category_limit_cycle_v1'",
    )).toEqual({ value: '1' });

    // Bir kez: sonra kullanıcının yeni takvim-ayı satırına dokunmaz.
    await db.runAsync("INSERT INTO category_limits (category_id, month, limit_amount) VALUES (?, '2026-11', 70)", [marketId]);
    await database.migrateCategoryLimitsToCycleOnce(db, '2026-11-11');
    expect(await db.getFirstAsync("SELECT limit_amount FROM category_limits WHERE month = '2026-11'"))
      .toEqual({ limit_amount: 70 });
  });

  it('geçiş: döngü anahtarında zaten limit varsa hiçbir satırı ezmez', async () => {
    const { db, marketId, database } = await openApp();
    await rearmMigration(db, 23);
    await db.runAsync(
      "INSERT INTO category_limits (category_id, month, limit_amount) VALUES (?, '2026-11', 300), (?, '2026-10', 40)",
      [marketId, marketId],
    );

    await database.migrateCategoryLimitsToCycleOnce(db, '2026-11-11');

    expect(await db.getAllAsync('SELECT month, limit_amount FROM category_limits ORDER BY month'))
      .toEqual([{ month: '2026-10', limit_amount: 40 }, { month: '2026-11', limit_amount: 300 }]);
  });

  it('geçiş: döngü günü 1 olan kurulumda hiçbir şey değişmez', async () => {
    const { db, marketId, database } = await openApp();
    await rearmMigration(db, 1);
    await db.runAsync("INSERT INTO category_limits (category_id, month, limit_amount) VALUES (?, '2026-11', 300)", [marketId]);

    await database.migrateCategoryLimitsToCycleOnce(db, '2026-11-11');

    expect(await db.getAllAsync('SELECT month FROM category_limits')).toEqual([{ month: '2026-11' }]);
  });
});
