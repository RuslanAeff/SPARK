jest.mock('../../db/database', () => ({ getDatabase: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: 'file:///cache/' } }));
jest.mock('expo-file-system/legacy', () => ({ StorageAccessFramework: {} }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getDatabase } from '../../db/database';
import { exportBackupToFile } from '../backupService';
it.each(['unavailable', 'shared', 'share-error'])('cleans or retains the cache according to handoff: %s', async state => {
  const remove = jest.fn();
  const file = { uri: 'file:///cache/synthetic.json', exists: false, size: 12,
    create: jest.fn(() => { file.exists = true; }), write: jest.fn(), delete: remove };
  (File as unknown as jest.Mock).mockImplementation(() => file);
  (getDatabase as jest.Mock).mockResolvedValue({ getAllAsync: jest.fn().mockResolvedValue([]) });
  (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(state !== 'unavailable');
  (Sharing.shareAsync as jest.Mock).mockImplementation(async () => { if (state === 'share-error') throw new Error('synthetic'); });
  const pending = exportBackupToFile({ start: '2026-09-01', end: '2026-09-16' });
  if (state === 'share-error') await expect(pending).rejects.toThrow('synthetic');
  else await pending;
  expect(remove).toHaveBeenCalledTimes(state === 'unavailable' ? 1 : 0);
});
