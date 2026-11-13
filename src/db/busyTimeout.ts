import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Aynı dosyaya başka bir bağlantı yazarken kilit beklenir; beklemeden
 * "database is locked" hatası verilmez (BUG-05). Ayar BAĞLANTI başınadır:
 * ana bağlantıya açılışta, `withExclusiveTransactionAsync`'in her çağrıda
 * açtığı geçici bağlantıya ise görevin başında uygulanmalıdır.
 *
 * Bağımsız modül: `database.ts` testlerde sıkça bütünüyle taklit edildiği
 * için yardımcı orada olsaydı tüketicilerin testlerinde görünmezdi.
 */
export const SQLITE_BUSY_TIMEOUT_PRAGMA = 'PRAGMA busy_timeout = 3000;';

export async function applyBusyTimeout(
  connection: Pick<SQLiteDatabase, 'execAsync'>,
): Promise<void> {
  await connection.execAsync(SQLITE_BUSY_TIMEOUT_PRAGMA);
}
