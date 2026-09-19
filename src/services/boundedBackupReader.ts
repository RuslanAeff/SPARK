import { requireOptionalNativeModule } from 'expo-modules-core';

export const MAX_BACKUP_FILE_BYTES = 25 * 1024 * 1024;
export async function readBoundedBackup(uri: string): Promise<string> {
  if (!/^(content:\/\/|file:\/\/\/)/.test(uri)) throw new Error('INVALID_FORMAT');
  const reader = requireOptionalNativeModule<{ readUtf8(uri: string, limit: number): Promise<string> }>('SparkBoundedFile');
  // Expo Go cannot provide this module. Never fall back to an unbounded read.
  if (!reader) throw new Error('INVALID_FORMAT');
  try {
    return await reader.readUtf8(uri, MAX_BACKUP_FILE_BYTES);
  } catch {
    throw new Error('INVALID_FORMAT');
  }
}
