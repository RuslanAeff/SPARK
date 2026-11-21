// S.P.A.R.K. — Anahtar-değer ayarları DAO'su (UI denetimi CQ-03)
//
// `settings` tablosuna ekran, context ve servislerden elle SQL yazılıyordu;
// bildirim deposu ile yedek bilgisinde aynı `getSetting`/`setSetting` iki kez
// tanımlıydı. Yeni kod ayarları yalnız buradan okur/yazar. İşlem (transaction)
// içinden çağıran, o işlemin bağlantısını `db` olarak geçirir.
//
// SQL metinleri projedeki mevcut kalıpla birebir aynıdır (davranış ve test
// taklitleriyle uyum).
//
// Anahtarlar `settingsKeys.ts` listesinden gelir; listede olmayan bir metin
// derlemede reddedilir.
import { getDatabase } from './database';
import type { SettingKey } from './settingsKeys';

type Connection = Awaited<ReturnType<typeof getDatabase>>;
/** Her işlem yalnız ihtiyaç duyduğu bağlantı yöntemini ister (işlem içi `txn` de geçer). */
type Reader = Pick<Connection, 'getFirstAsync'>;
type BulkReader = Pick<Connection, 'getAllAsync'>;
type Writer = Pick<Connection, 'runAsync'>;
export type SettingsDb = Reader & BulkReader & Writer;

async function resolve<T>(db?: T): Promise<T | Connection> {
  return db ?? getDatabase();
}

export const SettingsDao = {
  async get(key: SettingKey, db?: Reader): Promise<string | null> {
    const conn = await resolve(db);
    const row = await conn.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      [key],
    );
    return row?.value ?? null;
  },

  async set(key: SettingKey, value: string, db?: Writer): Promise<void> {
    const conn = await resolve(db);
    await conn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  },

  async delete(key: SettingKey, db?: Writer): Promise<void> {
    const conn = await resolve(db);
    await conn.runAsync('DELETE FROM settings WHERE key = ?', [key]);
  },

  /**
   * Birden çok ilişkili anahtarı tek sorguda okur (ör. tema: otomatik, manuel,
   * vurgu). Olmayan anahtar haritada yer almaz.
   */
  async getMany(keys: readonly SettingKey[], db?: BulkReader): Promise<Map<SettingKey, string>> {
    if (keys.length === 0) return new Map();
    const conn = await resolve(db);
    const rows = await conn.getAllAsync<{ key: SettingKey; value: string }>(
      `SELECT key, value FROM settings WHERE key IN (${keys.map(() => '?').join(', ')})`,
      [...keys],
    );
    return new Map(rows.map(row => [row.key, row.value]));
  },

  /** Bozuk veya eksik JSON'da `null` döner; çağıran varsayılana düşer. */
  async getJson<T = unknown>(key: SettingKey, db?: Reader): Promise<T | null> {
    const raw = await SettingsDao.get(key, db);
    if (raw == null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  async setJson(key: SettingKey, value: unknown, db?: Writer): Promise<void> {
    await SettingsDao.set(key, JSON.stringify(value), db);
  },
};
