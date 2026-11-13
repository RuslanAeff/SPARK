// S.P.A.R.K. — Kolon ekleme geçişleri (BUG-18)
//
// Eski geçişler `ALTER TABLE ... ADD COLUMN`'u `catch (_) {}` ile sarıyordu:
// "kolon zaten var" dışındaki gerçek hatalar (disk dolu, bozuk şema, yazım hatası)
// da sessizce geçiliyor, uygulama eksik şemayla açılıyordu. Burada önce
// `PRAGMA table_info` ile bakılır; yalnız eksikse eklenir ve hata yukarı çıkar.
import type { SQLiteDatabase } from 'expo-sqlite';

type Db = Pick<SQLiteDatabase, 'getAllAsync' | 'execAsync'>;

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

/**
 * Tabloda kolon yoksa ekler. Tablo henüz yoksa (yeni kurulum) hiçbir şey yapmaz
 * ve `false` döner: tabloyu şema kendi kolonlarıyla kuracak. Eklediyse `true`.
 * `definition` kolon adından sonraki tür ve kısıtlardır (ör. `TEXT`, `REAL DEFAULT 0`).
 */
export async function addColumnIfMissing(
  db: Db,
  table: string,
  column: string,
  definition: string,
): Promise<boolean> {
  if (!IDENTIFIER.test(table) || !IDENTIFIER.test(column)) {
    throw new Error(`Invalid schema identifier: ${table}.${column}`);
  }
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table});`);
  if (columns.length === 0) return false;
  if (columns.some(info => info.name === column)) return false;
  await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  return true;
}
