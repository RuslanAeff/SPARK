import * as FS from 'expo-file-system/legacy';

/** Only the exact picker asset used by this scan is owned; never sweep logos/gallery. */
export async function removeReceiptCopy(uri: string | null): Promise<void> {
  if (!uri || !FS.cacheDirectory || !uri.startsWith(FS.cacheDirectory)) return;
  const relative = uri.slice(FS.cacheDirectory.length);
  if (!/^ImagePicker\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|heic|heif|gif|avif|bmp|tif|tiff)$/i.test(relative)) return;
  try { await FS.deleteAsync(uri, { idempotent: true }); } catch { /* OS cache eviction remains fallback */ }
}

const activeExports = new Set<string>();
export function retainActiveExport(uri: string): void { activeExports.add(uri); }
export function releaseActiveExport(uri: string): void { activeExports.delete(uri); }

/** Sharing recipients may read after share-sheet completion: keep shared files for 24h.
 * Sweep on next app startup/export; reset removes inactive exports immediately.
 */
export async function purgeBackupCopies(reset = false): Promise<void> {
  if (!FS.cacheDirectory) return;
  try {
    for (const name of await FS.readDirectoryAsync(FS.cacheDirectory)) {
      if (!/^spark-backup_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}(?:_\d+-[a-z0-9]+)?\.json$/.test(name)) continue;
      const uri = FS.cacheDirectory + name;
      if (activeExports.has(uri)) continue;
      const info = await FS.getInfoAsync(uri);
      if (info.exists && !info.isDirectory && (reset || (info.modificationTime != null
        && info.modificationTime * 1000 < Date.now() - 24 * 60 * 60 * 1000))) {
        await FS.deleteAsync(uri, { idempotent: true });
      }
    }
  } catch { /* Best-effort cleanup must not obscure the primary operation. */ }
}
