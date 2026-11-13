// BUG-31 (ürün kararı A): birikim hedefi, kategori limitleri ve döngü günü
// yedeğe girer (v7). Gerçek SQLite ve uygulamanın tam açılış zinciri.
import { sqliteTestDatabase } from '../../db/__tests__/helpers/sqliteTestDatabase';

let mockDb: ReturnType<typeof sqliteTestDatabase>;
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn(async () => mockDb) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));
jest.mock('../boundedBackupReader', () => ({ readBoundedBackup: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: '/tmp' } }));
jest.mock('expo-file-system/legacy', () => ({ StorageAccessFramework: {} }));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-document-picker', () => ({}));

beforeEach(() => { mockDb = sqliteTestDatabase(); });
afterEach(async () => mockDb.close());

function load() {
  let m!: {
    database: typeof import('../../db/database');
    backup: typeof import('../backupService');
    goal: typeof import('../../db/goalDao');
  };
  jest.isolateModules(() => {
    m = {
      database: require('../../db/database'),
      backup: require('../backupService'),
      goal: require('../../db/goalDao'),
    };
  });
  return m;
}

async function seedSource() {
  const { database, backup, goal } = load();
  const db = await database.getDatabase();
  const market = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM categories WHERE name = 'Market' LIMIT 1",
  );
  await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('budget_cycle_start_day', '23')");
  await goal.GoalDao.saveSettings({
    goal: { title: 'Tatil', target_amount: 5000, target_date: '2027-06-01', currency: 'PLN', current_amount: 750 },
    month: '2026-10',
    limits: [{ category_id: market!.id, limit_amount: 400 }],
  });
  // Aralık dışında kalan eski döngünün limiti yedeğe girmez.
  await db.runAsync(
    "INSERT INTO category_limits (category_id, month, limit_amount) VALUES (?, '2025-01', 99)",
    [market!.id],
  );
  const payload = JSON.parse(JSON.stringify(
    await backup.buildBackupPayload({ start: '2026-10-01', end: '2026-11-30' }),
  ));
  // Kaynak cihaz kapanır; sonraki load() yeni, boş bir cihaz açar.
  await mockDb.close();
  mockDb = sqliteTestDatabase();
  return payload;
}

describe('yedek kapsamı: hedef, limitler, döngü günü (BUG-31)', () => {
  it('yeni cihaza geri yüklemede üçü de gelir; ikinci yükleme bir şey eklemez', async () => {
    const payload = await seedSource();
    expect(payload.data.savings_goal).toMatchObject({ title: 'Tatil', current_amount: 750 });
    expect(payload.data.category_limits).toEqual([
      { category_name: 'Market', category_parent_name: 'Yeme-İçme', month: '2026-10', limit_amount: 400 },
    ]);
    expect(payload.data.budget_cycle_start_day).toBe(23);

    const { database, backup } = load();
    const db = await database.getDatabase();
    const first = await backup.importBackupPayload(payload);
    expect(first).toMatchObject({ savingsGoalAdded: 1, categoryLimitsAdded: 1, cycleDayRestored: 1 });
    expect(await db.getFirstAsync('SELECT title, target_amount, current_amount FROM savings_goal'))
      .toEqual({ title: 'Tatil', target_amount: 5000, current_amount: 750 });
    expect(await db.getAllAsync(
      `SELECT c.name, cl.month, cl.limit_amount FROM category_limits cl JOIN categories c ON c.id = cl.category_id`,
    )).toEqual([{ name: 'Market', month: '2026-10', limit_amount: 400 }]);
    expect(await db.getFirstAsync("SELECT value FROM settings WHERE key = 'budget_cycle_start_day'"))
      .toEqual({ value: '23' });

    const second = await backup.importBackupPayload(payload);
    expect(second).toMatchObject({
      savingsGoalAdded: 0, categoryLimitsAdded: 0, categoryLimitsSkipped: 1, cycleDayRestored: 0, keptLocal: 0,
    });
  });

  it('cihazda farklı hedef, limit ve döngü günü varsa cihazdakiler korunur', async () => {
    const payload = await seedSource();

    const { database, backup, goal } = load();
    const db = await database.getDatabase();
    const market = await db.getFirstAsync<{ id: number }>("SELECT id FROM categories WHERE name = 'Market' LIMIT 1");
    await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('budget_cycle_start_day', '10')");
    await goal.GoalDao.saveSettings({
      goal: { title: 'Araba', target_amount: 20000, target_date: '2028-01-01', currency: 'PLN', current_amount: 100 },
      month: '2026-10',
      limits: [{ category_id: market!.id, limit_amount: 250 }],
    });

    const summary = await backup.importBackupPayload(payload);

    expect(summary).toMatchObject({ savingsGoalAdded: 0, categoryLimitsAdded: 0, cycleDayRestored: 0, keptLocal: 3 });
    expect(await db.getFirstAsync('SELECT title FROM savings_goal')).toEqual({ title: 'Araba' });
    expect(await db.getAllAsync('SELECT limit_amount FROM category_limits')).toEqual([{ limit_amount: 250 }]);
    expect(await db.getFirstAsync("SELECT value FROM settings WHERE key = 'budget_cycle_start_day'"))
      .toEqual({ value: '10' });
  });

  it('"Tüm veriler" aralığı en eski kayıttan bugüne (veya ileri tarihli son kayda) uzanır', async () => {
    const { database, backup } = load();
    const db = await database.getDatabase();
    expect(await backup.getAllDataRange('2026-11-13')).toEqual({ start: '2026-11-13', end: '2026-11-13' });
    await db.execAsync(`
      INSERT INTO expenses (total_amount, currency, date) VALUES (10, 'PLN', '2025-02-10'), (10, 'PLN', '2026-11-15');
      INSERT INTO extra_incomes (source, amount, date, created_at) VALUES ('Bonus', 50, '2024-07-01', 'x');
    `);
    expect(await backup.getAllDataRange('2026-11-13')).toEqual({ start: '2024-07-01', end: '2026-11-15' });
  });
});
