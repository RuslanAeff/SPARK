// S.P.A.R.K. — Secure API Key Storage (OS Keychain via expo-secure-store)
// Güvenlik: API anahtarı artık SQLite düz metni yerine OS anahtar zincirinde saklanır.
import * as SecureStore from 'expo-secure-store';
import { getDatabase } from '../db/database';

const SECURE_KEY = 'spark_gemini_api_key';
const SQLITE_SETTINGS_KEY = 'gemini_api_key';

/** Migrasyon bayrağı — uygulama ömründe bir kez çalışır */
let _migrationDone = false;

/**
 * SQLite'daki düz metin anahtarı SecureStore'a taşır ve SQLite'dan SİLER.
 * İdem-potent: zaten taşınmışsa tekrar çalışmaz.
 */
async function migrateKeyFromSqlite(): Promise<void> {
  if (_migrationDone) return;
  _migrationDone = true;

  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM settings WHERE key = ?`,
      [SQLITE_SETTINGS_KEY]
    );

    if (!row?.value) return; // SQLite'da key yok — taşınacak bir şey yok

    // SecureStore'da zaten varsa üzerine yazma
    const existing = await SecureStore.getItemAsync(SECURE_KEY);
    if (!existing) {
      await SecureStore.setItemAsync(SECURE_KEY, row.value);
    }

    // SQLite'dan hassas veriyi temizle
    await db.runAsync(
      `DELETE FROM settings WHERE key = ?`,
      [SQLITE_SETTINGS_KEY]
    );
  } catch (e) {
    // Migration başarısız olursa sessizce devam et — bir sonraki uygulama açılışında tekrar dener
    _migrationDone = false;
    if (__DEV__) console.warn('[SecureKeyStore] migration failed:', e);
  }
}

/**
 * API anahtarını OS anahtar zincirinden okur.
 * İlk çağrıda SQLite'dan migration yapar.
 */
export async function getSecureApiKey(): Promise<string | null> {
  await migrateKeyFromSqlite();

  try {
    const key = await SecureStore.getItemAsync(SECURE_KEY);
    return key || null;
  } catch (e) {
    if (__DEV__) console.warn('[SecureKeyStore] read failed:', e);
    return null;
  }
}

/**
 * API anahtarını OS anahtar zincirine yazar.
 * Eski SQLite kaydı varsa onu da temizler.
 */
export async function setSecureApiKey(apiKey: string): Promise<void> {
  await SecureStore.setItemAsync(SECURE_KEY, apiKey);

  // Eski SQLite kaydını temizle (varsa)
  try {
    const db = await getDatabase();
    await db.runAsync(
      `DELETE FROM settings WHERE key = ?`,
      [SQLITE_SETTINGS_KEY]
    );
  } catch {
    // Temizleme başarısız olsa bile key SecureStore'a yazıldı
  }
}

/**
 * API anahtarı var mı kontrolü (hızlı, değeri döndürmez).
 */
export async function hasSecureApiKey(): Promise<boolean> {
  const key = await getSecureApiKey();
  return !!key;
}

/**
 * API anahtarını kalıcı olarak siler.
 */
export async function deleteSecureApiKey(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SECURE_KEY);
  } catch {
    // Key zaten yoksa hata vermez
  }
}
