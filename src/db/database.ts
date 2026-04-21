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
    db = instance;
    return instance;
  })();
  return initPromise;
}

/** Varsayılan kategori ağacını tamamlar: eksik üst/alt kategoriler + is_system bayrağı */
export async function ensureDefaultCategoryTree(database: SQLite.SQLiteDatabase): Promise<void> {
  for (const cat of DEFAULT_CATEGORIES) {
    let parentRow = await database.getFirstAsync<{ id: number }>(
      `SELECT id FROM categories WHERE name = ? AND parent_id IS NULL`,
      [cat.name]
    );
    let parentId: number;
    if (!parentRow) {
      const r = await database.runAsync(
        `INSERT INTO categories (name, icon, color, parent_id, is_system) VALUES (?, ?, ?, NULL, 1)`,
        [cat.name, cat.icon, cat.color]
      );
      parentId = Number(r.lastInsertRowId);
    } else {
      parentId = parentRow.id;
      await database.runAsync(`UPDATE categories SET is_system = 1 WHERE id = ?`, [parentId]);
    }
    for (const child of cat.children || []) {
      const ex = await database.getFirstAsync<{ id: number }>(
        `SELECT id FROM categories WHERE parent_id = ? AND name = ?`,
        [parentId, child.name]
      );
      if (!ex) {
        await database.runAsync(
          `INSERT INTO categories (name, icon, color, parent_id, is_system) VALUES (?, ?, ?, ?, 1)`,
          [child.name, child.icon, child.color, parentId]
        );
      } else {
        await database.runAsync(`UPDATE categories SET is_system = 1 WHERE id = ?`, [ex.id]);
      }
    }
  }
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
