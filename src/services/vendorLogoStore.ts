// S.P.A.R.K. — Satıcı logolarının kalıcı saklanması (BUG-27)
//
// Görsel seçicinin döndürdüğü adres uygulama önbelleğindedir; işletim sistemi
// yer açarken veya kullanıcı "önbelleği temizle" dediğinde silinir. Seçilen
// görsel bu yüzden `documentDirectory/vendor-logos/` altına kopyalanır ve
// veritabanına o yol yazılır. Bu klasördeki dosyaların sahibi yalnız bu modüldür:
// hiçbir satıcının göstermediği dosyalar (logo değişti, satıcı silindi, satıcılar
// birleşti, veri sıfırlandı) süpürmeyle silinir. Galeri asılları hiç silinmez.
import * as FS from 'expo-file-system/legacy';

import { getDatabase } from '../db/database';
import { isLocalImageUri } from '../utils/localImageUri';

const LOGO_FOLDER = 'vendor-logos/';
const OWNED_NAME = /^v\d+-\d+-[a-z0-9]+\.(jpg|jpeg|png|webp|heic|heif|gif)$/;
const IMAGE_EXT = /\.(jpg|jpeg|png|webp|heic|heif|gif)(?:[?#].*)?$/i;

/** Kopyası yazılmış ama veritabanına henüz bağlanmamış dosyalar: süpürme dokunmaz. */
const pendingLogos = new Set<string>();

function logoDirectory(): string | null {
  return FS.documentDirectory ? FS.documentDirectory + LOGO_FOLDER : null;
}

/** Yalnız bu modülün ürettiği, geçerli klasördeki logo dosyası mı? */
export function isOwnedLogoUri(uri: string | null | undefined): boolean {
  const dir = logoDirectory();
  if (!dir || typeof uri !== 'string' || !uri.startsWith(dir)) return false;
  return OWNED_NAME.test(uri.slice(dir.length));
}

function newLogoName(vendorId: number, sourceUri: string): string {
  const ext = (IMAGE_EXT.exec(sourceUri)?.[1] ?? 'jpg').toLowerCase();
  const nonce = Math.random().toString(36).slice(2, 10) || '0';
  return `v${Math.max(0, Math.trunc(vendorId))}-${Date.now()}-${nonce}.${ext}`;
}

async function copyIntoStore(vendorId: number, sourceUri: string): Promise<string> {
  const dir = logoDirectory();
  if (!dir) throw new Error('LOGO_STORAGE_UNAVAILABLE');
  await FS.makeDirectoryAsync(dir, { intermediates: true });
  const dest = dir + newLogoName(vendorId, sourceUri);
  pendingLogos.add(dest);
  try {
    await FS.copyAsync({ from: sourceUri, to: dest });
  } catch (error) {
    pendingLogos.delete(dest);
    await FS.deleteAsync(dest, { idempotent: true }).catch(() => undefined);
    throw error;
  }
  return dest;
}

async function deleteOwnedLogo(uri: string | null | undefined): Promise<void> {
  if (!uri || !isOwnedLogoUri(uri) || pendingLogos.has(uri)) return;
  try { await FS.deleteAsync(uri, { idempotent: true }); } catch { /* sonraki süpürme yeniden dener */ }
}

/**
 * Seçilen görseli kalıcı klasöre kopyalar, satıcıya bağlar ve önceki logo
 * dosyasını siler. Kopyalama veya kayıt başarısız olursa eski logo yerinde kalır.
 */
export async function setVendorLogo(vendorId: number, pickedUri: string): Promise<string> {
  if (!isLocalImageUri(pickedUri)) throw new Error('INVALID_LOGO_URI');
  const dest = await copyIntoStore(vendorId, pickedUri);
  let previous: string | null = null;
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ logo_uri: string | null }>(
      'SELECT logo_uri FROM vendors WHERE id = ?',
      [vendorId],
    );
    if (!row) throw new Error('VENDOR_NOT_FOUND');
    previous = row.logo_uri;
    await db.runAsync('UPDATE vendors SET logo_uri = ? WHERE id = ?', [dest, vendorId]);
  } catch (error) {
    pendingLogos.delete(dest);
    await deleteOwnedLogo(dest);
    throw error;
  }
  pendingLogos.delete(dest);
  if (previous !== dest) await deleteOwnedLogo(previous);
  return dest;
}

/**
 * Hiçbir satıcının göstermediği logo dosyalarını siler. Satıcı silme, birleştirme
 * ve veri sıfırlamadan sonra; ayrıca açılışta çağrılır. Hata yutulur.
 */
export async function sweepOrphanVendorLogos(): Promise<number> {
  const dir = logoDirectory();
  if (!dir) return 0;
  let removed = 0;
  try {
    const info = await FS.getInfoAsync(dir);
    if (!info.exists) return 0;
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ logo_uri: string }>(
      'SELECT logo_uri FROM vendors WHERE logo_uri IS NOT NULL',
    );
    const referenced = new Set(rows.map(row => row.logo_uri));
    for (const name of await FS.readDirectoryAsync(dir)) {
      if (!OWNED_NAME.test(name)) continue;
      const uri = dir + name;
      if (referenced.has(uri) || pendingLogos.has(uri)) continue;
      await FS.deleteAsync(uri, { idempotent: true });
      removed += 1;
    }
  } catch { /* En iyi çaba: temizlik asıl işlemi engellemez. */ }
  return removed;
}

/**
 * Tek seferlik geçiş (her açılışta güvenle çalışır):
 * - Önbellekteki eski logo dosyası hâlâ duruyorsa kalıcı klasöre kopyalanır.
 * - Dosya artık yoksa kayıt temizlenir (satıcı baş harf avatarına döner).
 * - iOS güncellemesinde kapsayıcı yolu değişmişse kendi dosyamız yeni yola bağlanır.
 * Dönen değer güncellenen satıcı sayısıdır.
 */
export async function migrateVendorLogos(): Promise<number> {
  const dir = logoDirectory();
  if (!dir) return 0;
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: number; logo_uri: string }>(
    'SELECT id, logo_uri FROM vendors WHERE logo_uri IS NOT NULL',
  );
  let changed = 0;
  for (const row of rows) {
    const uri = row.logo_uri;
    if (isOwnedLogoUri(uri) || !isLocalImageUri(uri)) continue;
    try {
      const marker = uri.lastIndexOf('/' + LOGO_FOLDER);
      const ownName = marker >= 0 ? uri.slice(marker + LOGO_FOLDER.length + 1) : '';
      if (OWNED_NAME.test(ownName)) {
        const relocated = dir + ownName;
        const exists = (await FS.getInfoAsync(relocated)).exists;
        await db.runAsync('UPDATE vendors SET logo_uri = ? WHERE id = ?', [exists ? relocated : null, row.id]);
        changed += 1;
        continue;
      }
      if (uri.startsWith('file://') && !(await FS.getInfoAsync(uri)).exists) {
        await db.runAsync('UPDATE vendors SET logo_uri = NULL WHERE id = ?', [row.id]);
        changed += 1;
        continue;
      }
      // Yalnız uygulamanın kendi önbelleğindeki seçici kopyası taşınır; başka
      // yollar (galeri, content://) olduğu gibi bırakılır.
      if (!FS.cacheDirectory || !uri.startsWith(FS.cacheDirectory) || uri.includes('/../')) continue;
      const dest = await copyIntoStore(row.id, uri);
      try {
        await db.runAsync('UPDATE vendors SET logo_uri = ? WHERE id = ?', [dest, row.id]);
      } finally {
        pendingLogos.delete(dest);
      }
      changed += 1;
    } catch {
      // Okunamayan kaynak (ör. izni düşmüş content://): kayıt olduğu gibi kalır,
      // sonraki açılışta yeniden denenir.
    }
  }
  return changed;
}

/** Açılış bakımı: önce geçiş, sonra sahipsiz dosya süpürmesi. */
export async function maintainVendorLogos(): Promise<void> {
  try {
    await migrateVendorLogos();
  } catch { /* veritabanı açılamadıysa ana akış zaten hata gösterir */ }
  await sweepOrphanVendorLogos();
}
