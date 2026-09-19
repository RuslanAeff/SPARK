jest.mock('expo-modules-core', () => ({ requireOptionalNativeModule: jest.fn() }));
import { requireOptionalNativeModule } from 'expo-modules-core';
import { readBoundedBackup, MAX_BACKUP_FILE_BYTES } from '../boundedBackupReader';
it('uses a byte-limited native reader for content providers', async () => {
  const readUtf8 = jest.fn().mockResolvedValue('{}');
  (requireOptionalNativeModule as jest.Mock).mockReturnValue({ readUtf8 });
  expect(await readBoundedBackup('content://synthetic/backup')).toBe('{}');
  expect(readUtf8).toHaveBeenCalledWith('content://synthetic/backup', MAX_BACKUP_FILE_BYTES);
});
it('fails closed without the native module', async () => {
  (requireOptionalNativeModule as jest.Mock).mockReturnValue(null);
  await expect(readBoundedBackup('file:///synthetic.json')).rejects.toThrow('INVALID_FORMAT');
});
it('normalizes oversized, invalid UTF-8 and provider failures without leaking source data', async () => {
  (requireOptionalNativeModule as jest.Mock).mockReturnValue({ readUtf8: jest.fn().mockRejectedValue(new Error('provider details')) });
  await expect(readBoundedBackup('content://synthetic/backup')).rejects.toThrow('INVALID_FORMAT');
});
