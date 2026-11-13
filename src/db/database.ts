// S.P.A.R.K. — Database Initialization
import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { applyBusyTimeout } from './busyTimeout';
import { addRecordUidColumns, ensureRecordUids } from './recordUid';
import { ensureVendorNameKeys } from './vendorIdentity';
import { addColumnIfMissing } from './schemaColumns';
import {
  CREATE_TABLES_SQL,
  CONTAINER_DEPOSIT_SCHEMA_SQL,
  DEFAULT_CATEGORIES,
  PAYMENT_REMINDERS_SCHEMA_SQL,
  PRODUCT_IDENTITY_LINKS_SCHEMA_SQL,
  PRODUCT_IDENTITY_TABLES_SCHEMA_SQL,
} from './schema';
import { cycleForDate, getCycleForKey, normalizeCycleStartDay } from '../utils/budgetCycle';
import { getToday } from '../utils/dateUtils';
import { canonicalizeProductLabel } from '../utils/productIdentity';
import { sanitizeMeasurementUnit, type MeasurementUnit } from '../utils/measurementUnit';
import { sanitizeText } from '../utils/inputValidation';
import { logError } from '../utils/logError';

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;
const RECEIPT_MONEY_PRECISION_MIGRATION = 'migration_receipt_money_precision_v1';
export const ITEM_MEASUREMENT_UNIT_MIGRATION = 'migration_item_measurement_unit_v1';
export const BUDGET_PERIOD_SNAPSHOT_MIGRATION = 'migration_budget_period_snapshot_v1';
export const PAYMENT_REMINDERS_MIGRATION = 'migration_payment_reminders_v1';
export const PAYMENT_REMINDER_VENDOR_DETACH_MIGRATION =
  'migration_payment_reminder_vendor_detach_v2';
export const PRODUCT_IDENTITY_MIGRATION = 'migration_product_identity_v1';
export const CONTAINER_DEPOSIT_MIGRATION = 'migration_container_deposit_v1';
export const VOUCHER_EXPIRY_REPAIR_MIGRATION = 'migration_voucher_expiry_repair_v1';
export const CATEGORY_LIMIT_CYCLE_MIGRATION = 'migration_category_limit_cycle_v1';

interface SqliteTableInfoRow {
  name: string;
}

interface ProductIdentityMigrationItemRow {
  id: number;
  name: string;
  measurement_unit: MeasurementUnit | null;
  canonical_product_id: number | null;
}

interface ProductIdentityMigrationProductRow {
  id: number;
  canonical_key: string;
  measurement_unit: MeasurementUnit;
}

interface ProductIdentityMigrationAliasRow {
  canonical_product_id: number;
  normalized_alias: string;
  measurement_unit: MeasurementUnit;
}

export async function migrateContainerDepositsOnce(
  database: SQLite.SQLiteDatabase,
): Promise<void> {
  const applied = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [CONTAINER_DEPOSIT_MIGRATION],
  );
  if (applied?.value === '1') return;

  const expenseColumns = await database.getAllAsync<SqliteTableInfoRow>('PRAGMA table_info(expenses);');
  const itemColumns = await database.getAllAsync<SqliteTableInfoRow>('PRAGMA table_info(expense_items);');
  const expenseNames = new Set(expenseColumns.map(column => column.name));
  const itemNames = new Set(itemColumns.map(column => column.name));

  await database.withTransactionAsync(async () => {
    if (!expenseNames.has('container_deposit_paid')) {
      await database.execAsync(
        'ALTER TABLE expenses ADD COLUMN container_deposit_paid REAL NOT NULL DEFAULT 0 CHECK(container_deposit_paid >= 0);',
      );
    }
    if (!expenseNames.has('container_voucher_used')) {
      await database.execAsync(
        'ALTER TABLE expenses ADD COLUMN container_voucher_used REAL NOT NULL DEFAULT 0 CHECK(container_voucher_used >= 0);',
      );
    }
    if (!itemNames.has('financial_kind')) {
      await database.execAsync(
        "ALTER TABLE expense_items ADD COLUMN financial_kind TEXT NOT NULL DEFAULT 'product' CHECK(financial_kind IN ('product', 'container_deposit'));",
      );
    }
    await database.execAsync(CONTAINER_DEPOSIT_SCHEMA_SQL);
    await database.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [CONTAINER_DEPOSIT_MIGRATION, '1'],
    );
  });
}

/**
 * BUG-04 onarımı: alışveriş fişinden doğrulanmadan yazılmış kupon son kullanma
 * tarihlerini (ör. "31.12.2026", "2026-02-31", fiş tarihinden önceki gün) NULL
 * yapar. Bu satırlar yedek içe aktarım sözleşmesini ihlal ettiği için o andan
 * sonra alınan tüm yedekleri geri yüklenemez yapıyordu. Yalnız bozuk tarih
 * yüzünden "expired" olmuş kupon yeniden "available" olur; "redeemed" korunur.
 */
export async function repairVoucherExpiryOnce(
  database: SQLite.SQLiteDatabase,
): Promise<void> {
  const applied = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [VOUCHER_EXPIRY_REPAIR_MIGRATION],
  );
  if (applied?.value === '1') return;

  await database.withTransactionAsync(async () => {
    await database.runAsync(`
      UPDATE container_deposit_vouchers
         SET status = CASE WHEN status = 'expired' THEN 'available' ELSE status END,
             expires_on = NULL
       WHERE expires_on IS NOT NULL
         AND (date(expires_on) IS NULL
              OR date(expires_on) <> expires_on
              OR CAST(substr(expires_on, 1, 4) AS INTEGER) NOT BETWEEN 2000 AND 2100
              OR expires_on < issued_date)
    `);
    await database.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [VOUCHER_EXPIRY_REPAIR_MIGRATION, '1'],
    );
  });
}

/**
 * BUG-22 geçişi: limitler eskiden bugünün TAKVİM ayı anahtarına yazılıyordu;
 * artık bütçe döngüsünün başladığı ayın anahtarına yazılıp okunuyor. Döngü günü
 * 1 değilse (ör. 23) iki anahtar farklıdır ve güncellemeden sonra kullanıcının
 * mevcut limitleri ekranda kaybolurdu. Bir kez: güncel takvim ayındaki limitler,
 * güncel döngünün anahtarında hiç limit yoksa oraya taşınır. Geçmiş aylara ve
 * döngü günü 1 olan kurulumlara dokunulmaz (iki anahtar aynıdır).
 */
export async function migrateCategoryLimitsToCycleOnce(
  database: SQLite.SQLiteDatabase,
  today: string = getToday(),
): Promise<void> {
  const applied = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [CATEGORY_LIMIT_CYCLE_MIGRATION],
  );
  if (applied?.value === '1') return;

  const anchorRow = await database.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'budget_cycle_start_day'",
  );
  const budget = await database.getFirstAsync<{
    period_start: string | null;
    period_end: string | null;
    cycle_start_day: number | null;
  }>(
    `SELECT period_start, period_end, cycle_start_day FROM budgets
      WHERE active = 1 AND period_start <= ? AND period_end >= ?
      ORDER BY id DESC LIMIT 1`,
    [today, today],
  );
  const cycleKey = cycleForDate(normalizeCycleStartDay(anchorRow?.value), today, budget).key;
  const calendarKey = today.slice(0, 7);

  await database.withTransactionAsync(async () => {
    if (cycleKey !== calendarKey) {
      const target = await database.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM category_limits WHERE month = ?',
        [cycleKey],
      );
      if (!target?.n) {
        await database.runAsync(
          'UPDATE category_limits SET month = ? WHERE month = ?',
          [cycleKey, calendarKey],
        );
      }
    }
    await database.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [CATEGORY_LIMIT_CYCLE_MIGRATION, '1'],
    );
  });
}

/**
 * Eski fiş kalemlerine güvenli, yalnız deterministik ürün kimliği bağlar.
 * Ham `name`/`turkish_name` alanlarına dokunulmaz. Bir alias zaten kayıtlıysa
 * o karar kullanılır; aynı kanonik anahtarda birden fazla aday varsa otomatik
 * seçim yapılmaz ve kalem kullanıcı kararına kadar NULL bırakılır.
 */
export async function migrateProductIdentityOnce(
  database: SQLite.SQLiteDatabase,
): Promise<void> {
  const applied = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [PRODUCT_IDENTITY_MIGRATION],
  );
  if (applied?.value === '1') return;

  const columns = await database.getAllAsync<SqliteTableInfoRow>(
    'PRAGMA table_info(expense_items);',
  );
  const hasCanonicalProductId = columns.some(column => column.name === 'canonical_product_id');
  const hasUserLabel = columns.some(column => column.name === 'user_label');

  await database.withTransactionAsync(async () => {
    await database.execAsync(PRODUCT_IDENTITY_TABLES_SCHEMA_SQL);
    if (!hasCanonicalProductId) {
      await database.execAsync(
        `ALTER TABLE expense_items
           ADD COLUMN canonical_product_id INTEGER
           REFERENCES canonical_products(id) ON DELETE SET NULL;`,
      );
    }
    if (!hasUserLabel) {
      await database.execAsync(
        `ALTER TABLE expense_items
           ADD COLUMN user_label TEXT
           CHECK(user_label IS NULL OR length(user_label) <= 500);`,
      );
    }
    await database.execAsync(PRODUCT_IDENTITY_LINKS_SCHEMA_SQL);

    const products = await database.getAllAsync<ProductIdentityMigrationProductRow>(
      `SELECT id, canonical_key, measurement_unit
         FROM canonical_products
        ORDER BY id ASC`,
    );
    const aliases = await database.getAllAsync<ProductIdentityMigrationAliasRow>(
      `SELECT canonical_product_id, normalized_alias, measurement_unit
         FROM product_aliases
        ORDER BY id ASC`,
    );
    const items = await database.getAllAsync<ProductIdentityMigrationItemRow>(
      `SELECT id, name, measurement_unit, canonical_product_id
         FROM expense_items
        WHERE canonical_product_id IS NULL
        ORDER BY id ASC`,
    );

    const productIdsByKey = new Map<string, number[]>();
    const aliasToProductId = new Map<string, number>();
    const identityKey = (key: string, unit: MeasurementUnit) => `${unit}::${key}`;
    for (const product of products) {
      const unit = sanitizeMeasurementUnit(product.measurement_unit);
      const key = identityKey(product.canonical_key, unit);
      const ids = productIdsByKey.get(key) ?? [];
      ids.push(product.id);
      productIdsByKey.set(key, ids);
    }
    for (const alias of aliases) {
      const unit = sanitizeMeasurementUnit(alias.measurement_unit);
      aliasToProductId.set(identityKey(alias.normalized_alias, unit), alias.canonical_product_id);
    }

    for (const item of items) {
      const unit = sanitizeMeasurementUnit(item.measurement_unit);
      const identity = canonicalizeProductLabel(item.name, unit);
      const canonicalKey = sanitizeText(identity.canonicalKey, 500);
      const normalizedAlias = sanitizeText(identity.normalizedAlias, 500);
      const canonicalName = sanitizeText(identity.canonicalName, 500);
      if (!canonicalKey || !normalizedAlias || !canonicalName) continue;

      const aliasKey = identityKey(normalizedAlias, unit);
      let productId = aliasToProductId.get(aliasKey) ?? null;
      if (productId == null) {
        const productKey = identityKey(canonicalKey, unit);
        const candidates = productIdsByKey.get(productKey) ?? [];
        if (candidates.length > 1) continue;
        if (candidates.length === 1) {
          productId = candidates[0];
        } else {
          const now = new Date().toISOString();
          const inserted = await database.runAsync(
            `INSERT INTO canonical_products
               (uid, canonical_name, canonical_key, measurement_unit, brand,
                variant, package_descriptor, created_at, updated_at)
             VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?)`,
            [Crypto.randomUUID(), canonicalName, canonicalKey, unit, now, now],
          );
          productId = Number(inserted.lastInsertRowId);
          productIdsByKey.set(productKey, [productId]);
        }
        const aliasCreatedAt = new Date().toISOString();
        await database.runAsync(
          `INSERT INTO product_aliases
             (canonical_product_id, normalized_alias, measurement_unit,
              source, confidence, created_at)
           VALUES (?, ?, ?, 'deterministic', NULL, ?)`,
          [productId, normalizedAlias, unit, aliasCreatedAt],
        );
        aliasToProductId.set(aliasKey, productId);
      }

      await database.runAsync(
        'UPDATE expense_items SET canonical_product_id = ? WHERE id = ? AND canonical_product_id IS NULL',
        [productId, item.id],
      );
    }

    await database.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [PRODUCT_IDENTITY_MIGRATION, '1'],
    );
  });
}

/**
 * Kalem miktarını ölçü boyutuyla birlikte saklar. Eski kayıtlarda açık `kg`
 * ibaresi veya kesirli miktar, ağırlıklı ürün için güvenli geriye-dönük sinyal
 * kabul edilir; diğer bütün satırlar adet olarak kalır.
 */
export async function migrateItemMeasurementUnitsOnce(
  database: SQLite.SQLiteDatabase,
): Promise<void> {
  const applied = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [ITEM_MEASUREMENT_UNIT_MIGRATION],
  );
  if (applied?.value === '1') return;

  const columns = await database.getAllAsync<SqliteTableInfoRow>(
    'PRAGMA table_info(expense_items);',
  );
  const hasColumn = columns.some(column => column.name === 'measurement_unit');
  await database.withTransactionAsync(async () => {
    if (!hasColumn) {
      await database.execAsync(
        "ALTER TABLE expense_items ADD COLUMN measurement_unit TEXT NOT NULL DEFAULT 'piece';",
      );
    }
    await database.runAsync(`
      UPDATE expense_items
         SET measurement_unit = 'kg'
       WHERE measurement_unit = 'piece'
         AND (
           LOWER(name) LIKE '%(kg)%'
           OR LOWER(COALESCE(turkish_name, '')) LIKE '%(kg)%'
           OR (quantity > 0 AND quantity < 50 AND ABS(quantity - ROUND(quantity)) > 0.000001)
         )
    `);
    await database.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [ITEM_MEASUREMENT_UNIT_MIGRATION, '1'],
    );
  });
}

/** Mevcut bütçelerin tarih aralığını o anda kayıtlı döngü gününe göre dondurur. */
export async function migrateBudgetPeriodSnapshotsOnce(
  database: SQLite.SQLiteDatabase,
): Promise<void> {
  const applied = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [BUDGET_PERIOD_SNAPSHOT_MIGRATION],
  );
  if (applied?.value === '1') return;

  const columns = await database.getAllAsync<SqliteTableInfoRow>('PRAGMA table_info(budgets);');
  const existing = new Set(columns.map((column) => column.name));
  const anchorRow = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    ['budget_cycle_start_day'],
  );
  const anchor = normalizeCycleStartDay(anchorRow?.value ?? 1);

  await database.withTransactionAsync(async () => {
    if (!existing.has('period_start')) {
      await database.execAsync('ALTER TABLE budgets ADD COLUMN period_start TEXT;');
    }
    if (!existing.has('period_end')) {
      await database.execAsync('ALTER TABLE budgets ADD COLUMN period_end TEXT;');
    }
    if (!existing.has('cycle_start_day')) {
      await database.execAsync('ALTER TABLE budgets ADD COLUMN cycle_start_day INTEGER;');
    }
    const rows = await database.getAllAsync<{ id: number; start_date: string }>(
      'SELECT id, start_date FROM budgets WHERE period_start IS NULL OR period_end IS NULL',
    );
    for (const row of rows) {
      const key = row.start_date.slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(key)) continue;
      const cycle = getCycleForKey(anchor, key);
      await database.runAsync(
        'UPDATE budgets SET period_start = ?, period_end = ?, cycle_start_day = ? WHERE id = ?',
        [cycle.start, cycle.end, anchor, row.id],
      );
    }
    await database.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [BUDGET_PERIOD_SNAPSHOT_MIGRATION, '1'],
    );
  });
}

/**
 * Mevcut borç tablosunu vade alanlarıyla genişletir ve düzenli ödeme
 * hatırlatıcılarını kurar. Kolon keşfi, yarıda kalmış eski bir denemeyi de
 * güvenle tamamlar; marker yalnız bütün DDL başarıyla bittikten sonra yazılır.
 */
export async function migratePaymentRemindersOnce(
  database: SQLite.SQLiteDatabase,
): Promise<void> {
  const applied = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [PAYMENT_REMINDERS_MIGRATION],
  );
  const detachApplied = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [PAYMENT_REMINDER_VENDOR_DETACH_MIGRATION],
  );
  if (applied?.value === '1' && detachApplied?.value === '1') return;

  const columns = applied?.value === '1'
    ? []
    : await database.getAllAsync<SqliteTableInfoRow>('PRAGMA table_info(debts);');
  const existingColumns = new Set(columns.map((column) => column.name));
  const missingColumnSql: Array<[string, string]> = [
    ['due_date', 'ALTER TABLE debts ADD COLUMN due_date TEXT;'],
    [
      'reminder_enabled',
      `ALTER TABLE debts ADD COLUMN reminder_enabled INTEGER NOT NULL DEFAULT 0 CHECK(
        reminder_enabled IN (0, 1)
        AND (reminder_enabled = 0 OR due_date IS NOT NULL)
      );`,
    ],
    [
      'reminder_days_before',
      'ALTER TABLE debts ADD COLUMN reminder_days_before INTEGER NOT NULL DEFAULT 3 CHECK(reminder_days_before BETWEEN 0 AND 365);',
    ],
    [
      'reminder_time',
      `ALTER TABLE debts ADD COLUMN reminder_time TEXT NOT NULL DEFAULT '09:00' CHECK(
        length(reminder_time) = 5
        AND substr(reminder_time, 3, 1) = ':'
        AND substr(reminder_time, 1, 2) GLOB '[0-2][0-9]'
        AND CAST(substr(reminder_time, 1, 2) AS INTEGER) BETWEEN 0 AND 23
        AND substr(reminder_time, 4, 2) GLOB '[0-5][0-9]'
      );`,
    ],
  ];

  await database.withTransactionAsync(async () => {
    if (applied?.value !== '1') {
      for (const [columnName, sql] of missingColumnSql) {
        if (!existingColumns.has(columnName)) {
          await database.execAsync(sql);
        }
      }
    }
    await database.execAsync(PAYMENT_REMINDERS_SCHEMA_SQL);
    if (applied?.value !== '1') {
      await database.runAsync(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        [PAYMENT_REMINDERS_MIGRATION, '1'],
      );
    }
    await database.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [PAYMENT_REMINDER_VENDOR_DETACH_MIGRATION, '1'],
    );
  });
}

/**
 * Eski REAL kayıtlarındaki binary float artıklarını bir kez kanonik para
 * hassasiyetine çeker. Header yeniden item toplamına eşitlenmez; basılı fiş
 * toplamını koruyan ADR-004 değişmezi aynen korunur.
 */
export async function normalizeReceiptMoneyPrecisionOnce(
  database: SQLite.SQLiteDatabase,
): Promise<void> {
  const applied = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [RECEIPT_MONEY_PRECISION_MIGRATION],
  );
  if (applied?.value === '1') return;

  await database.withTransactionAsync(async () => {
    await database.runAsync('UPDATE expenses SET total_amount = ROUND(total_amount, 2)');
    await database.runAsync(`
      UPDATE expense_items
      SET unit_price = ROUND(unit_price, 4),
          total_price = ROUND(total_price, 2),
          line_discount = CASE
            WHEN line_discount IS NULL THEN NULL
            ELSE ROUND(line_discount, 2)
          END,
          list_line_total_before_discount = CASE
            WHEN list_line_total_before_discount IS NULL THEN NULL
            ELSE ROUND(list_line_total_before_discount, 2)
          END
    `);
    await database.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [RECEIPT_MONEY_PRECISION_MIGRATION, '1'],
    );
  });
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  if (initPromise) return initPromise;
  const attempt = (async () => {
    const instance = await SQLite.openDatabaseAsync('spark.db');
    try {
      await prepareDatabase(instance);
    } catch (error) {
      // Yarım açılmış bağlantı açık kalmasın; yeniden denemede ikinci bağlantı oluşmasın.
      try { await instance.closeAsync(); } catch { /* zaten kapalı */ }
      throw error;
    }
    db = instance;
    return instance;
  })();
  initPromise = attempt;
  // BUG-07: reddedilen açılış önbellekte kalmaz; sonraki getDatabase() yeniden dener.
  attempt.catch(() => {
    if (initPromise === attempt) initPromise = null;
  });
  return attempt;
}

/** Açılış adımları: PRAGMA, bütünlük kontrolü, şema, migration'lar ve tohumlama. */
async function prepareDatabase(instance: SQLite.SQLiteDatabase): Promise<void> {
    await instance.execAsync('PRAGMA journal_mode = WAL;');
    await instance.execAsync('PRAGMA foreign_keys = ON;');
    await applyBusyTimeout(instance);
    // Bütünlük kontrolü (§7.5) — disk bozulmasını açılışta erken yakala. quick_check,
    // integrity_check'in hızlı varyantıdır; sağlamsa tek satır 'ok' döner. Hassas veri
    // loglanmaz (§7.6); auto-recovery yok — kullanıcı onayı olmadan veriye dokunulmaz.
    try {
      const rows = await instance.getAllAsync<Record<string, string>>('PRAGMA quick_check;');
      const ok = rows.length === 1 && Object.values(rows[0])[0] === 'ok';
      if (!ok) {
        logError('DB integrity check failed');
      } else if (__DEV__) {
        console.log('[DB] integrity ok');
      }
    } catch (e) {
      logError('DB integrity check error', e);
    }
    // BUG-21: şema uid indeksini/tetikleyicisini kurar; eski tablolarda kolon önce eklenir.
    await addRecordUidColumns(instance);
    await instance.execAsync(CREATE_TABLES_SQL);
    await migrateBudgetPeriodSnapshotsOnce(instance);
    await migratePaymentRemindersOnce(instance);
    // BUG-18: kolon geçişleri önce varlığı kontrol eder; gerçek hata açılışı durdurur.
    await addColumnIfMissing(instance, 'expense_items', 'turkish_name', 'TEXT');
    await addColumnIfMissing(instance, 'expense_items', 'line_discount', 'REAL DEFAULT 0');
    await addColumnIfMissing(instance, 'expense_items', 'list_line_total_before_discount', 'REAL');
    await migrateContainerDepositsOnce(instance);
    await repairVoucherExpiryOnce(instance);
    await migrateItemMeasurementUnitsOnce(instance);
    await migrateProductIdentityOnce(instance);
    await normalizeReceiptMoneyPrecisionOnce(instance);
    await migrateCategoryLimitsToCycleOnce(instance);
    await addColumnIfMissing(instance, 'categories', 'is_system', 'INTEGER NOT NULL DEFAULT 0');
    // savings_goal.current_amount: kullanıcının o ana kadar biriktirdiği
    // tutarı tutar. 0 olabilir. Hedef ilerleme çubuğu bunu hedef tutara böler.
    await addColumnIfMissing(instance, 'savings_goal', 'current_amount', 'REAL NOT NULL DEFAULT 0');
    // vendors.default_category_id: satıcı bazlı varsayılan kategori. Eklendiğinde
    // hem manuel harcama girişi hem fiş tarama bu kategoriyi otomatik seçer.
    await addColumnIfMissing(
      instance,
      'vendors',
      'default_category_id',
      'INTEGER REFERENCES categories(id) ON DELETE SET NULL',
    );
    // subscriptions, debts, debt_payments, extra_incomes, savings_goal ve
    // category_limits tabloları CREATE_TABLES_SQL ile kurulur (BUG-18: hatası
    // yutulan tekrar blokları kaldırıldı).
    // BUG-14: satıcı adı harf farkına dayanıklı tekil anahtar; mevcut kopyalar birleşir.
    await ensureVendorNameKeys(instance);
    // BUG-21: harcama/borç/ödeme/ek gelir kalıcı kimliği (eski tablolara kolon +
    // mevcut satırlara bir kez UUID + tekillik indeksi).
    await ensureRecordUids(instance);
    // İlk kurulum tohumlaması init promise'in İÇİNDE: getDatabase() çağıran her
    // tüketici (onboarding/tema okuması vb.) tohumlama BİTENE kadar bekler.
    // Aksi halde seed transaction'ı (ensureDefaultCategoryTree) ile eşzamanlı bir
    // SELECT, expo-sqlite'ta "shared object already released" çökmesi veriyordu —
    // yalnız TEMİZ kurulumda (seed yalnız o zaman çalışır), bu yüzden mevcut
    // veritabanlı cihazlarda görülmüyordu.
    await seedIfNeeded(instance);
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
  // Tüm tohumlama artık getDatabase() init promise'i içinde (seedIfNeeded).
  // Bu fonksiyon geriye dönük uyum için kalıyor; getDatabase'i beklemek yeterli.
  await getDatabase();
}

/** İlk kurulum tohumlaması (yalnız kategori ağacı), idempotent.
 *  getDatabase() init promise'i İÇİNDE çağrılır → tohumlama sırasında başka
 *  hiçbir tüketici sorgu çalıştıramaz (eşzamanlı erişim çökmesi engellenir). */
async function seedIfNeeded(database: SQLite.SQLiteDatabase): Promise<void> {
  const result = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories'
  );
  if (result && result.count === 0) {
    await seedDefaultCategories(database);
  }

  await ensureDefaultCategoryTree(database);
  // BUG-23 (ürün kararı A): varsayılan bütçe tohumlanmaz. Bütçe yalnız kullanıcının
  // onboarding'de veya Ayarlar'da girdiği değerdir; silinen bütçe açılışta geri gelmez.
}

/** BUG-18: 60 ekleme tek transaction'da; yarıda kalırsa hiçbiri yazılmaz ve
 *  bir sonraki açılış tohumlamayı baştan yapar. */
async function seedDefaultCategories(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.withTransactionAsync(async () => {
    await insertDefaultCategories(database);
  });
}

async function insertDefaultCategories(database: SQLite.SQLiteDatabase): Promise<void> {
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
