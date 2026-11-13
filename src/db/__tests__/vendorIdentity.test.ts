// BUG-14: harf farkına dayanıklı satıcı kimliği. Gerçek SQLite, tam açılış zinciri.
import { sqliteTestDatabase } from './helpers/sqliteTestDatabase';

let mockDb: ReturnType<typeof sqliteTestDatabase>;
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn(async () => mockDb) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));

beforeEach(() => { mockDb = sqliteTestDatabase(); });
afterEach(async () => mockDb.close());

function load() {
  let m!: {
    database: typeof import('../database');
    vendors: typeof import('../vendorDao');
    identity: typeof import('../vendorIdentity');
  };
  jest.isolateModules(() => {
    m = {
      database: require('../database'),
      vendors: require('../vendorDao'),
      identity: require('../vendorIdentity'),
    };
  });
  return m;
}

describe('satıcı kimliği (BUG-14)', () => {
  it('kabul: findOrCreate("ŻABKA") ardından findOrCreate("żabka") aynı kimliği döndürür', async () => {
    const { database, vendors } = load();
    await database.getDatabase();
    const first = await vendors.VendorDao.findOrCreate('ŻABKA');
    expect(await vendors.VendorDao.findOrCreate('żabka')).toBe(first);
    expect(await vendors.VendorDao.findOrCreate(' Żabka ')).toBe(first);
    const sok = await vendors.VendorDao.findOrCreate('ŞOK');
    expect(await vendors.VendorDao.findOrCreate('Şok')).toBe(sok);
    expect(await vendors.VendorDao.findOrCreate('Sok')).not.toBe(sok);
  });

  it('veritabanı aynı anahtarla ikinci satıcıya izin vermez', async () => {
    const { database, vendors } = load();
    const db = await database.getDatabase();
    await vendors.VendorDao.create({ name: 'Lidl' });
    await expect(db.runAsync("INSERT INTO vendors (name, name_key) VALUES ('LIDL', 'lidl')")).rejects.toThrow();
  });

  it('eski kopyaları bağlarıyla birlikte tek satıcıda birleştirir', async () => {
    const { database, identity } = load();
    const db = await database.getDatabase();
    // Güncelleme öncesi durumu kur: anahtarsız üç kopya.
    await db.execAsync(`
      DROP INDEX idx_vendors_name_key;
      INSERT INTO vendors (id, name, logo_uri, default_category_id) VALUES
        (101, 'ŞOK', NULL, NULL), (102, 'Şok', NULL, NULL), (103, 'şok', 'file:///logo.png', NULL),
        (104, 'Biedronka', NULL, NULL);
      INSERT INTO expenses (vendor_id, total_amount, currency, date) VALUES
        (101, 1, 'PLN', '2026-11-01'), (102, 2, 'PLN', '2026-11-02'), (102, 3, 'PLN', '2026-11-03'),
        (103, 4, 'PLN', '2026-11-04'), (104, 5, 'PLN', '2026-11-05');
      INSERT INTO subscriptions (vendor_id, amount, currency, period_days, last_seen_date, next_expected_date, occurrences, status, updated_at)
        VALUES (102, 30, 'PLN', 30, '2026-11-01', '2026-12-01', 3, 'active', 'x'),
               (103, 30, 'PLN', 30, '2026-11-01', '2026-12-01', 3, 'dismissed', 'x');
      INSERT INTO recurring_payment_reminders
        (uid, title, vendor_id, currency, anchor_date, next_due_date, recurrence_unit, recurrence_interval,
         reminder_days_before, reminder_time, status, source, created_at, updated_at)
        VALUES ('11111111-1111-4111-8111-111111111111', 'A', 101, 'PLN', '2026-11-01', '2026-12-01', 'month', 1, 3, '09:00', 'active', 'detected', 'x', 'x'),
               ('22222222-2222-4222-8222-222222222222', 'B', 102, 'PLN', '2026-11-01', '2026-12-01', 'month', 1, 3, '09:00', 'active', 'detected', 'x', 'x');
    `);

    await identity.ensureVendorNameKeys(db);

    // En çok harcaması olan (102) tutulur; logo kopyadan gelir.
    expect(await db.getAllAsync('SELECT id, name, name_key, logo_uri FROM vendors WHERE id > 100 ORDER BY id'))
      .toEqual([
        { id: 102, name: 'Şok', name_key: 'şok', logo_uri: 'file:///logo.png' },
        { id: 104, name: 'Biedronka', name_key: 'biedronka', logo_uri: null },
      ]);
    expect(await db.getAllAsync('SELECT vendor_id, COUNT(*) AS n FROM expenses GROUP BY vendor_id ORDER BY vendor_id'))
      .toEqual([{ vendor_id: 102, n: 4 }, { vendor_id: 104, n: 1 }]);
    // "Abonelik değil" kararı korunur; satıcı başına tek satır.
    expect(await db.getAllAsync('SELECT vendor_id, status FROM subscriptions')).toEqual([{ vendor_id: 102, status: 'dismissed' }]);
    // Satıcı başına tek algılanan plan; diğeri kaybolmaz, kullanıcı planına döner.
    expect(await db.getAllAsync('SELECT title, vendor_id, source FROM recurring_payment_reminders ORDER BY title'))
      .toEqual([
        { title: 'A', vendor_id: 102, source: 'manual' },
        { title: 'B', vendor_id: 102, source: 'detected' },
      ]);

    // İkinci çalışma bir şey değiştirmez ve tekil indeks kurulmuştur.
    await identity.ensureVendorNameKeys(db);
    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM vendors WHERE id > 100')).toEqual({ n: 2 });
    await expect(db.runAsync("INSERT INTO vendors (name, name_key) VALUES ('SOK', 'şok')")).rejects.toThrow();
  });
});
