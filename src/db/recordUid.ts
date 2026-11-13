// S.P.A.R.K. — Harcama, borç, ödeme ve ek gelir için kalıcı kimlik (BUG-21)
//
// Yedekte bu kayıtlar eskiden yalnız içerikleriyle tanınıyordu; yedekten sonra
// tutarı/notu değişen harcama veya tamamen ödenen borç aynı yedek geri
// yüklenince ikinci kez ekleniyordu. Artık her satırın değişmeyen bir UUID'si
// var; yedek biçimi v7 eşleştirmeyi önce bu kimlikle yapar.
import { addColumnIfMissing } from './schemaColumns';
import type { SQLiteDatabase } from 'expo-sqlite';

export const RECORD_UID_TABLES = ['expenses', 'debts', 'debt_payments', 'extra_incomes'] as const;
export type RecordUidTable = typeof RECORD_UID_TABLES[number];

/**
 * SQLite içinde rastgele UUID v4 (inputValidation'daki kanonik desenle uyumlu).
 * Satır başına yeniden değerlendirilir; toplu UPDATE her satıra farklı değer verir.
 */
const SQL_UUID_V4 = `lower(
  hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
  substr(hex(randomblob(2)), 2) || '-' ||
  substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' ||
  hex(randomblob(6))
)`;

/** Kimliği olmayan satırlara kimlik verir; çağıranın transaction'ına katılır. */
export async function backfillRecordUids(db: Pick<SQLiteDatabase, 'runAsync'>): Promise<void> {
  for (const table of RECORD_UID_TABLES) {
    await db.runAsync(`UPDATE ${table} SET uid = ${SQL_UUID_V4} WHERE uid IS NULL`);
  }
}

/**
 * Eski kurulumlarda kolonu ekler. `CREATE_TABLES_SQL`'den ÖNCE çalışır: o SQL
 * uid indeksini ve tetikleyicisini kurar ve kolon yoksa açılışı kırardı. Yeni
 * kurulumda tablo henüz yoktur; atlanır ve tabloyu şema kurar. Gerçek hata
 * yutulmaz (BUG-18).
 */
export async function addRecordUidColumns(db: Pick<SQLiteDatabase, 'execAsync' | 'getAllAsync'>): Promise<void> {
  for (const table of RECORD_UID_TABLES) {
    await addColumnIfMissing(db, table, 'uid', 'TEXT');
  }
}

/**
 * Yeni satır kimliksiz eklenirse (DAO'lar, fiş kaydı, gelecekteki yollar)
 * veritabanı kendisi verir; yedekten gelen satır kendi kimliğiyle eklenir.
 * `CREATE_TABLES_SQL`'in sonuna eklenir.
 */
export const RECORD_UID_SCHEMA_SQL = RECORD_UID_TABLES.map(table => `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_${table}_uid ON ${table}(uid);
  CREATE TRIGGER IF NOT EXISTS trg_${table}_uid
  AFTER INSERT ON ${table} FOR EACH ROW WHEN NEW.uid IS NULL
  BEGIN
    UPDATE ${table} SET uid = ${SQL_UUID_V4} WHERE id = NEW.id;
  END;
`).join('');

/**
 * Açılış geçişi: kolonu garanti eder ve kimliği olmayan mevcut satırlara bir kez
 * kimlik verir. Her açılışta güvenle tekrar çalışır (yalnız NULL satırlara dokunur).
 */
export async function ensureRecordUids(db: SQLiteDatabase): Promise<void> {
  await addRecordUidColumns(db);
  await db.withTransactionAsync(async () => {
    await backfillRecordUids(db);
  });
}
