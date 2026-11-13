// S.P.A.R.K. — Satıcı kimliği: harf farkına dayanıklı tekil anahtar (BUG-14)
//
// SQLite `LOWER` yalnız ASCII çevirdiği için "ŞOK" ile "Şok" iki satıcı oluyordu.
// `vendors.name_key` JS'te `nameIdentityKey` ile üretilir ve tekil indekslidir.
// Mevcut kopyalar açılışta birleştirilir: harcamalar, hatırlatıcılar ve abonelik
// kararı tutulan satıcıya taşınır; logo/varsayılan kategori boşsa kopyadan alınır.
import type { SQLiteDatabase } from 'expo-sqlite';

import { nameIdentityKey } from '../utils/searchText';
import { addColumnIfMissing } from './schemaColumns';

type Db = Pick<SQLiteDatabase, 'runAsync' | 'getAllAsync' | 'getFirstAsync'>;

interface VendorRow {
  id: number;
  name: string;
  name_key: string | null;
  logo_uri: string | null;
  default_category_id: number | null;
  expense_count: number;
}

/** `dup` satıcısının bütün bağlarını `keeper`a taşır ve `dup`ı siler. */
export async function mergeVendorInto(db: Db, keeperId: number, dupId: number): Promise<void> {
  await db.runAsync('UPDATE expenses SET vendor_id = ? WHERE vendor_id = ?', [keeperId, dupId]);
  // Satıcı başına tek "algılanan" plan kuralı (tekil indeks): tutulanın zaten
  // algılanan planı varsa kopyanınki silinmez, kullanıcı planına dönüşür.
  await db.runAsync(
    `UPDATE recurring_payment_reminders
        SET source = 'manual', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE vendor_id = ? AND source = 'detected'
        AND EXISTS (SELECT 1 FROM recurring_payment_reminders
                     WHERE vendor_id = ? AND source = 'detected')`,
    [dupId, keeperId],
  );
  await db.runAsync('UPDATE recurring_payment_reminders SET vendor_id = ? WHERE vendor_id = ?', [keeperId, dupId]);
  // Abonelik (satıcı başına tek satır): kullanıcının "abonelik değil" kararı korunur;
  // aktif tespit sonraki senkronda yeniden üretilir.
  await db.runAsync(
    `UPDATE subscriptions SET status = 'dismissed'
      WHERE vendor_id = ?
        AND EXISTS (SELECT 1 FROM subscriptions WHERE vendor_id = ? AND status = 'dismissed')`,
    [keeperId, dupId],
  );
  await db.runAsync(
    `UPDATE subscriptions SET vendor_id = ?
      WHERE vendor_id = ? AND NOT EXISTS (SELECT 1 FROM subscriptions WHERE vendor_id = ?)`,
    [keeperId, dupId, keeperId],
  );
  await db.runAsync('DELETE FROM subscriptions WHERE vendor_id = ?', [dupId]);
  await db.runAsync(
    `UPDATE vendors
        SET logo_uri = COALESCE(logo_uri, (SELECT logo_uri FROM vendors WHERE id = ?)),
            default_category_id = COALESCE(default_category_id, (SELECT default_category_id FROM vendors WHERE id = ?))
      WHERE id = ?`,
    [dupId, dupId, keeperId],
  );
  await db.runAsync('DELETE FROM vendors WHERE id = ?', [dupId]);
}

/**
 * Anahtarı olmayan satırlara anahtar verir; aynı anahtara düşen satıcıları
 * birleştirir (en çok harcaması olan, eşitse en eski kalır). Çağıranın
 * transaction'ına katılır. Birleştirilen kopya sayısını döndürür.
 */
export async function normalizeVendorKeys(db: Db): Promise<number> {
  const pending = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM vendors WHERE name_key IS NULL',
  );
  if (!pending?.n) return 0;
  const rows = await db.getAllAsync<VendorRow>(
    `SELECT v.id, v.name, v.name_key, v.logo_uri, v.default_category_id,
            (SELECT COUNT(*) FROM expenses e WHERE e.vendor_id = v.id) AS expense_count
       FROM vendors v ORDER BY v.id ASC`,
  );
  const groups = new Map<string, VendorRow[]>();
  for (const row of rows) {
    const key = nameIdentityKey(row.name);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  let merged = 0;
  for (const [key, group] of groups) {
    const keeper = group.reduce((best, row) => (
      row.expense_count > best.expense_count ? row : best
    ));
    for (const dup of group) {
      if (dup.id === keeper.id) continue;
      await mergeVendorInto(db, keeper.id, dup.id);
      merged += 1;
    }
    if (keeper.name_key !== key) {
      await db.runAsync('UPDATE vendors SET name_key = ? WHERE id = ?', [key, keeper.id]);
    }
  }
  return merged;
}

/**
 * Açılış geçişi: kolonu ekler, kopyaları birleştirir, tekil indeksi kurar.
 * Her açılışta güvenle çalışır; işi yoksa tek bir sayım sorgusudur.
 */
export async function ensureVendorNameKeys(db: SQLiteDatabase): Promise<void> {
  await addColumnIfMissing(db, 'vendors', 'name_key', 'TEXT');
  await db.withTransactionAsync(async () => {
    await normalizeVendorKeys(db);
  });
  await db.execAsync('CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_name_key ON vendors(name_key);');
}
