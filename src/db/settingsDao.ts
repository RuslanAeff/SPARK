// S.P.A.R.K. — Anahtar-değer ayarları DAO'su (UI denetimi CQ-03)
//
// `settings` tablosuna ekran, context ve servislerden elle SQL yazılıyordu;
// bildirim deposu ile yedek bilgisinde aynı `getSetting`/`setSetting` iki kez
// tanımlıydı. Yeni kod ayarları yalnız buradan okur/yazar. İşlem (transaction)
// içinden çağıran, o işlemin bağlantısını `db` olarak geçirir.
//
// SQL metinleri projedeki mevcut kalıpla birebir aynıdır (davranış ve test
// taklitleriyle uyum).
import { getDatabase } from './database';

type SettingsDb = Pick<Awaited<ReturnType<typeof getDatabase>>, 'getFirstAsync' | 'runAsync'>;

async function resolve(db?: SettingsDb): Promise<SettingsDb> {
  return db ?? getDatabase();
}

export const SettingsDao = {
  async get(key: string, db?: SettingsDb): Promise<string | null> {
    const conn = await resolve(db);
    const row = await conn.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      [key],
    );
    return row?.value ?? null;
  },

  async set(key: string, value: string, db?: SettingsDb): Promise<void> {
    const conn = await resolve(db);
    await conn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  },

  async delete(key: string, db?: SettingsDb): Promise<void> {
    const conn = await resolve(db);
    await conn.runAsync('DELETE FROM settings WHERE key = ?', [key]);
  },

  /** Bozuk veya eksik JSON'da `null` döner; çağıran varsayılana düşer. */
  async getJson<T = unknown>(key: string, db?: SettingsDb): Promise<T | null> {
    const raw = await SettingsDao.get(key, db);
    if (raw == null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  async setJson(key: string, value: unknown, db?: SettingsDb): Promise<void> {
    await SettingsDao.set(key, JSON.stringify(value), db);
  },
};
