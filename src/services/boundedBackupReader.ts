import { requireOptionalNativeModule } from 'expo-modules-core';

export const MAX_BACKUP_FILE_BYTES = 25 * 1024 * 1024;
export async function readBoundedBackup(uri: string): Promise<string> {
  if (!/^(content:\/\/|file:\/\/\/)/.test(uri)) throw new Error('INVALID_FORMAT');
  const reader = requireOptionalNativeModule<{ readUtf8(uri: string, limit: number): Promise<string> }>('SparkBoundedFile');
  if (!reader) {
    // Expo Go cannot provide this module. Release builds never fall back to an
    // unbounded read; the fallback below exists only for local development.
    if (!__DEV__) throw new Error('INVALID_FORMAT');
    return readForExpoGoDev(uri);
  }
  try {
    return await reader.readUtf8(uri, MAX_BACKUP_FILE_BYTES);
  } catch {
    throw new Error('INVALID_FORMAT');
  }
}

/** DEV-only: size is checked before reading, and again on the decoded text. */
async function readForExpoGoDev(uri: string): Promise<string> {
  try {
    const FS: any = require('expo-file-system/legacy');
    const info = await FS.getInfoAsync(uri, { size: true });
    if (!info?.exists || typeof info.size !== 'number' || info.size > MAX_BACKUP_FILE_BYTES) {
      throw new Error('INVALID_FORMAT');
    }
    const text: string = await FS.readAsStringAsync(uri, { encoding: 'utf8' });
    if (text.length > MAX_BACKUP_FILE_BYTES) throw new Error('INVALID_FORMAT');
    return text;
  } catch {
    throw new Error('INVALID_FORMAT');
  }
}
