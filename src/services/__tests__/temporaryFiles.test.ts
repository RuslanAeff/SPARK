jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/', deleteAsync: jest.fn(), readDirectoryAsync: jest.fn(), getInfoAsync: jest.fn(),
}));
import * as FS from 'expo-file-system/legacy';
import { removeReceiptCopy, purgeBackupCopies, retainActiveExport, releaseActiveExport } from '../temporaryFiles';
beforeEach(() => jest.clearAllMocks());
it('deletes only an owned picker file, preserving gallery originals and path traversal', async () => {
  for (const uri of ['content://media/1', 'file:///gallery/original.jpg', 'file:///cache/ImagePicker/../logo.jpg', 'file:///cache/logo.jpg']) await removeReceiptCopy(uri);
  expect(FS.deleteAsync).not.toHaveBeenCalled();
  for (const extension of ['jpg', 'gif', 'avif', 'heif']) {
    await removeReceiptCopy(`file:///cache/ImagePicker/synthetic.${extension}`);
  }
  expect(FS.deleteAsync).toHaveBeenCalledTimes(4);
});
it('retains active exports and fresh shared files, expires only old owned backups', async () => {
  const name = 'spark-backup_2026-09-01_2026-09-16_123-test.json';
  const uri = FS.cacheDirectory + name;
  (FS.readDirectoryAsync as jest.Mock).mockResolvedValue([name, 'unrelated.json']);
  (FS.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, isDirectory: false, modificationTime: 1 });
  retainActiveExport(uri);
  await purgeBackupCopies(true);
  expect(FS.deleteAsync).not.toHaveBeenCalled();
  releaseActiveExport(uri);
  (FS.getInfoAsync as jest.Mock).mockResolvedValueOnce({ exists: true, isDirectory: false, modificationTime: Date.now() / 1000 });
  await purgeBackupCopies();
  expect(FS.deleteAsync).not.toHaveBeenCalled();
  await purgeBackupCopies();
  expect(FS.deleteAsync).toHaveBeenCalledWith(uri, { idempotent: true });
});
