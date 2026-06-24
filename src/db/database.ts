// S.P.A.R.K. — Database Initialization
import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES_SQL, DEFAULT_CATEGORIES } from './schema';

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const instance = await SQLite.openDatabaseAsync('spark.db');
    await instance.execAsync('PRAGMA journal_mode = WAL;');
    await instance.execAsync('PRAGMA foreign_keys = ON;');
    // Bütünlük kontrolü (§7.5) — disk bozulmasını açılışta erken yakala. quick_check,
    // integrity_check'in hızlı varyantıdır; sağlamsa tek satır 'ok' döner. Hassas veri
    // loglanmaz (§7.6); auto-recovery yok — kullanıcı onayı olmadan veriye dokunulmaz.
    try {
      const rows = await instance.getAllAsync<Record<string, string>>('PRAGMA quick_check;');
      const ok = rows.length === 1 && Object.values(rows[0])[0] === 'ok';
      if (!ok) {
        console.warn('[DB] integrity check failed');
      } else if (__DEV__) {
        console.log('[DB] integrity ok');
      }
    } catch (e) {
      if (__DEV__) console.warn('[DB] integrity check error', e);
    }
    await instance.execAsync(CREATE_TABLES_SQL);
    try {
      await instance.execAsync('ALTER TABLE expense_items ADD COLUMN turkish_name TEXT;');
    } catch (_) {
      // Column already exists — ignore
    }
    try {
      await instance.execAsync('ALTER TABLE expense_items ADD COLUMN line_discount REAL DEFAULT 0;');
    } catch (_) {}
    try {
      await instance.execAsync('ALTER TABLE expense_items ADD COLUMN list_line_total_before_discount REAL;');
    } catch (_) {}
    try {
      await instance.execAsync(`
        CREATE TABLE IF NOT EXISTS savings_goal (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          title TEXT NOT NULL DEFAULT '',
          target_amount REAL NOT NULL DEFAULT 0,
          target_date TEXT NOT NULL,
          currency TEXT NOT NULL DEFAULT 'PLN'
        );
        CREATE TABLE IF NOT EXISTS category_limits (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
          month TEXT NOT NULL,
          limit_amount REAL NOT NULL,
          UNIQUE(category_id, month)
        );
        CREATE INDEX IF NOT EXISTS idx_category_limits_month ON category_limits(month);
      `);
    } catch (_) {
      // Already applied
    }
    try {
      await instance.execAsync(
        'ALTER TABLE categories ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0;'
      );
    } catch (_) {
      // Column already exists
    }
    // savings_goal.current_amount: kullanıcının o ana kadar biriktirdiği
    // tutarı tutar. 0 olabilir. Hedef ilerleme çubuğu bunu hedef tutara böler.
    try {
      await instance.execAsync(
        'ALTER TABLE savings_goal ADD COLUMN current_amount REAL NOT NULL DEFAULT 0;'
      );
    } catch (_) {
      // Column already exists
    }
    // vendors.default_category_id: satıcı bazlı varsayılan kategori. Eklendiğinde
    // hem manuel harcama girişi hem fiş tarama bu kategoriyi otomatik seçer.
    try {
      await instance.execAsync(
        'ALTER TABLE vendors ADD COLUMN default_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;'
      );
    } catch (_) {
      // Column already exists
    }
    // subscriptions: tekrar eden ödeme tespitinin sonuçları. CREATE_TABLES_SQL
    // tarafından üretilir ama eski kurulumlar için ayrıca burada da garanti
    // ediyoruz (bütçe / hedef tabloları gibi).
    try {
      await instance.execAsync(`
        CREATE TABLE IF NOT EXISTS subscriptions (
          id                  INTEGER PRIMARY KEY AUTOINCREMENT,
          vendor_id           INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
          amount              REAL NOT NULL,
          currency            TEXT NOT NULL,
          period_days         INTEGER NOT NULL,
          last_seen_date      TEXT NOT NULL,
          next_expected_date  TEXT NOT NULL,
          occurrences         INTEGER NOT NULL DEFAULT 0,
          status              TEXT NOT NULL DEFAULT 'active',
          updated_at          TEXT NOT NULL,
          UNIQUE(vendor_id)
        );
        CREATE INDEX IF NOT EXISTS idx_subscriptions_vendor ON subscriptions(vendor_id);
        CREATE INDEX IF NOT EXISTS idx_subscriptions_next ON subscriptions(next_expected_date);
      `);
    } catch (_) {
      // Already applied
    }
    db = instance;
    return instance;
  })();
  return initPromise;
}

/** Varsayılan kategori ağacını tamamlar: eksik üst/alt kategoriler + is_system bayrağı.
 *  Performans (§8.2/1, P1/P14): her açılışta ~108 sıralı sorgu yerine TEK `SELECT` ile
 *  tüm kategoriler Map'e yüklenir; yalnızca gerçekten eksik satır veya yanlış `is_system`
 *  bayrağı için yazma yapılır. Sağlıklı bir dönüş kullanıcısında 1 SELECT + 0 yazma →
 *  `isReady` (ilk render) gecikmesi belirgin azalır. Yazmalar tek `withTransactionAsync`
 *  içinde (§7.3). Fonksiyon idempotent ve self-healing kalır; davranış birebir aynıdır. */
export async function ensureDefaultCategoryTree(database: SQLite.SQLiteDatabase): Promise<void> {
  const rows = await database.getAllAsync<{
    id: number; name: string; parent_id: number | null; is_system: number;
  }>('SELECT id, name, parent_id, is_system FROM categories');

  const parents = new Map<string, { id: number; is_system: number }>();
  const children = new Map<string, { id: number; is_system: number }>(); // key: `${parent_id}|${name}`
  for (const r of rows) {
    if (r.parent_id === null) parents.set(r.name, { id: r.id, is_system: r.is_system });
    else children.set(`${r.parent_id}|${r.name}`, { id: r.id, is_system: r.is_system });
  }

  // Eksik kök kategoriler (id'leri çocuklar için transaction içinde gerekli).
  const missingParents = DEFAULT_CATEGORIES.filter((c) => !parents.has(c.name));
  // Mevcut köklerin eksik çocukları (parentId zaten biliniyor).
  const childInserts: Array<{ parentId: number; child: { name: string; icon: string; color: string } }> = [];
  // is_system != 1 olan mevcut satırlar için bayrak düzeltmesi.
  const flagFixes: number[] = [];

  for (const cat of DEFAULT_CATEGORIES) {
    const ex = parents.get(cat.name);
    if (!ex) continue; // eksik kök + çocukları aşağıda transaction içinde eklenir
    if (ex.is_system !== 1) flagFixes.push(ex.id);
    for (const child of cat.children || []) {
      const existing = children.get(`${ex.id}|${child.name}`);
      if (!existing) childInserts.push({ parentId: ex.id, child });
      else if (existing.is_system !== 1) flagFixes.push(existing.id);
    }
  }

  // Sağlıklı dönüş kullanıcısı: yapılacak yazma yok → transaction açma.
  if (missingParents.length === 0 && childInserts.length === 0 && flagFixes.length === 0) return;

  await database.withTransactionAsync(async () => {
    for (const cat of missingParents) {
      const r = await database.runAsync(
        `INSERT INTO categories (name, icon, color, parent_id, is_system) VALUES (?, ?, ?, NULL, 1)`,
        [cat.name, cat.icon, cat.color]
      );
      const parentId = Number(r.lastInsertRowId);
      for (const child of cat.children || []) {
        await database.runAsync(
          `INSERT INTO categories (name, icon, color, parent_id, is_system) VALUES (?, ?, ?, ?, 1)`,
          [child.name, child.icon, child.color, parentId]
        );
      }
    }
    for (const { parentId, child } of childInserts) {
      await database.runAsync(
        `INSERT INTO categories (name, icon, color, parent_id, is_system) VALUES (?, ?, ?, ?, 1)`,
        [child.name, child.icon, child.color, parentId]
      );
    }
    for (const id of flagFixes) {
      await database.runAsync(`UPDATE categories SET is_system = 1 WHERE id = ?`, [id]);
    }
  });
}

export async function initializeDatabase(): Promise<void> {
  const database = await getDatabase();

  const result = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories'
  );

  if (result && result.count === 0) {
    await seedDefaultCategories(database);
  }

  await ensureDefaultCategoryTree(database);

  const budget = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM budgets WHERE active = 1'
  );
  if (budget && budget.count === 0) {
    const today = new Date().toISOString().split('T')[0];
    await database.runAsync(
      'INSERT INTO budgets (monthly_amount, currency, start_date, active) VALUES (?, ?, ?, 1)',
      [5000, 'PLN', today]
    );
  }
}

async function seedDefaultCategories(database: SQLite.SQLiteDatabase): Promise<void> {
  for (const cat of DEFAULT_CATEGORIES) {
    const parentResult = await database.runAsync(
      'INSERT INTO categories (name, icon, color, parent_id, is_system) VALUES (?, ?, ?, NULL, 1)',
      [cat.name, cat.icon, cat.color]
    );
    const parentId = parentResult.lastInsertRowId;

    if (cat.children) {
      for (const child of cat.children) {
        await database.runAsync(
          'INSERT INTO categories (name, icon, color, parent_id, is_system) VALUES (?, ?, ?, ?, 1)',
          [child.name, child.icon, child.color, parentId]
        );
      }
    }
  }
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
    initPromise = null;
  }
}
