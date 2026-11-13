// SEC-01 (ürün kararı A): şifreli yedeğin dışa aktarımı ve parolayla geri yüklenmesi.
// expo-crypto AES yerine Node AES-GCM sahtesi; scrypt gerçek (@noble/hashes).
jest.mock('expo-crypto', () => require('../../test-utils/expoCryptoAesMock').expoCryptoAesMock);
jest.mock('../nativeKdf', () => {
  const actual = jest.requireActual('../nativeKdf');
  const { nativeKdfMock } = require('../../test-utils/expoCryptoAesMock');
  return {
    ...actual,
    pbkdf2Sha256: async (...args: [string, string, number, number]) => new Uint8Array(await nativeKdfMock.pbkdf2Sha256(...args)),
  };
});
jest.mock('../../db/database', () => ({ getDatabase: jest.fn() }));
jest.mock('../boundedBackupReader', () => ({ readBoundedBackup: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: 'file:///cache/' } }));
jest.mock('expo-file-system/legacy', () => ({ StorageAccessFramework: {} }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getDatabase } from '../../db/database';
import { readBoundedBackup } from '../boundedBackupReader';
import { exportBackupToFile, pickAndImportBackup } from '../backupService';

const range = { start: '2026-09-01', end: '2026-09-30' };
const EXPENSE = {
  id: 1, uid: '723e4567-e89b-42d3-a456-426614174000', vendor_id: null, category_id: null,
  total_amount: 42.5, currency: 'PLN', note: 'Gizli not', receipt_uri: null,
  container_deposit_paid: 0, container_voucher_used: 0, date: '2026-09-05',
  created_at: '2026-09-05T10:00:00.000Z', vendor_name: null, category_name: null, category_parent_name: null,
};

function exportDatabase() {
  (getDatabase as jest.Mock).mockResolvedValue({
    getAllAsync: jest.fn(async (sql: string) => (sql.includes('FROM expenses e') ? [EXPENSE] : [])),
    getFirstAsync: jest.fn().mockResolvedValue(null),
  });
}

function mockFile() {
  const file = {
    uri: 'file:///cache/synthetic.json', exists: false, size: 12,
    create: jest.fn(() => { file.exists = true; }), write: jest.fn(), delete: jest.fn(),
  };
  (File as unknown as jest.Mock).mockImplementation(() => file);
  return file;
}

async function exportEncrypted(password: string): Promise<string> {
  exportDatabase();
  const file = mockFile();
  const result = await exportBackupToFile(range, { password });
  expect(result).toMatchObject({ encrypted: true, destination: 'shared' });
  expect(result.fileName).toMatch(/_encrypted\.json$/);
  return file.write.mock.calls[0][0] as string;
}

describe('şifreli yedek akışı (SEC-01)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);
  });

  it('parola verilince dosyada düz metin finansal veri bulunmaz', async () => {
    const written = await exportEncrypted('parola-12345');
    expect(JSON.parse(written)).toMatchObject({ format: 'spark-encrypted-backup', cipher: 'aes-256-gcm' });
    expect(written).not.toContain('Gizli not');
    expect(written).not.toContain('42.5');
    expect(written).not.toContain(EXPENSE.uid);
  });

  it('yanlış parolada yeniden sorar, doğru parolayla geri yükler', async () => {
    const written = await exportEncrypted('parola-12345');
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked.json', name: 'b_encrypted.json', size: written.length }],
    });
    (readBoundedBackup as jest.Mock).mockResolvedValue(written);
    const inserted: unknown[][] = [];
    (getDatabase as jest.Mock).mockResolvedValue({
      withTransactionAsync: async (fn: () => Promise<void>) => fn(),
      getAllAsync: jest.fn(async () => []),
      getFirstAsync: jest.fn(async () => null),
      runAsync: jest.fn(async (sql: string, params: unknown[] = []) => {
        if (sql.includes('INSERT INTO expenses')) inserted.push(params);
        return { lastInsertRowId: 1, changes: 1 };
      }),
    });
    const answers = ['yanlis-parola', 'parola-12345'];
    const prompts: boolean[] = [];

    const result = await pickAndImportBackup(async (lastAttemptWrong) => {
      prompts.push(lastAttemptWrong);
      return answers.shift() ?? null;
    });

    expect(prompts).toEqual([false, true]);
    expect(result?.summary.expensesAdded).toBe(1);
    expect(inserted[0]).toEqual(expect.arrayContaining([EXPENSE.uid, 42.5, 'Gizli not']));
  });

  it('parola istenince vazgeçilirse hiçbir şey yazılmaz', async () => {
    const written = await exportEncrypted('parola-12345');
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false, assets: [{ uri: 'file:///picked.json', name: 'b.json', size: written.length }],
    });
    (readBoundedBackup as jest.Mock).mockResolvedValue(written);
    const runAsync = jest.fn();
    (getDatabase as jest.Mock).mockResolvedValue({ runAsync, withTransactionAsync: jest.fn() });

    await expect(pickAndImportBackup(async () => null)).resolves.toBeNull();
    expect(runAsync).not.toHaveBeenCalled();
  });
});
