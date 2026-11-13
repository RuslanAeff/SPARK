jest.mock('../../db/database', () => ({ getDatabase: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: 'file:///cache/' } }));
jest.mock('expo-file-system/legacy', () => ({ StorageAccessFramework: {} }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getDatabase } from '../../db/database';
import {
  BACKUP_EXPORT_INVALID,
  BACKUP_EXPORT_TOO_LARGE,
  BACKUP_FORMAT_VERSION,
  assertBackupJsonRestorable,
  exportBackupToFile,
  validateAndNormalizeBackupPayload,
} from '../backupService';

const range = { start: '2026-09-01', end: '2026-09-30' };

function voucherRow(expiresOn: string | null) {
  return {
    id: 1,
    uid: '123e4567-e89b-42d3-a456-426614174000',
    amount: 2,
    currency: 'PLN',
    issued_date: '2026-09-10',
    expires_on: expiresOn,
    status: 'available',
    redeemed_date: null,
    redemption_expense_id: null,
    note: null,
    created_at: '2026-09-10T10:00:00.000Z',
  };
}

function mockDatabase(vouchers: unknown[]) {
  (getDatabase as jest.Mock).mockResolvedValue({
    getAllAsync: jest.fn(async (sql: string) => (
      sql.startsWith('SELECT * FROM container_deposit_vouchers') ? vouchers : []
    )),
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

describe('backup export self-check (BUG-19)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);
  });

  it('refuses to produce a file that import would reject and names the collection', async () => {
    mockDatabase([voucherRow('31.12.2026')]);
    const file = mockFile();

    await expect(exportBackupToFile(range)).rejects.toMatchObject({
      message: BACKUP_EXPORT_INVALID,
      section: 'container_deposit_vouchers',
    });
    expect(File).not.toHaveBeenCalled();
    expect(file.write).not.toHaveBeenCalled();
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('still exports a restorable file', async () => {
    mockDatabase([voucherRow('2026-12-31')]);
    const file = mockFile();

    await expect(exportBackupToFile(range)).resolves.toMatchObject({ destination: 'shared' });
    const written = JSON.parse(file.write.mock.calls[0][0]);
    expect(() => validateAndNormalizeBackupPayload(written)).not.toThrow();
  });

  it('rejects output larger than the import byte limit', () => {
    const json = JSON.stringify({ padding: 'ğ'.repeat(13 * 1024 * 1024) });
    expect(() => assertBackupJsonRestorable(json)).toThrow(BACKUP_EXPORT_TOO_LARGE);
  });

  it('accepts SQLite datetime timestamps without relying on Date.parse', () => {
    const payload = {
      version: BACKUP_FORMAT_VERSION,
      app: 'S.P.A.R.K.',
      exportedAt: '2026-09-30T10:00:00.000Z',
      range,
      data: {
        expenses: [{
          source_id: 1, uid: '723e4567-e89b-42d3-a456-426614174000',
          created_at: '2026-09-05 09:00:00', date: '2026-09-05',
          total_amount: 10, currency: 'PLN', note: null, receipt_uri: null,
          vendor_name: null, category_name: null, items: [],
          container_deposit_paid: 0, container_voucher_used: 0,
        }],
        categories: [], vendors: [], budgets: [], dismissed_subscriptions: [],
        debts: [], debt_payments: [], extra_incomes: [], recurring_payment_reminders: [],
        canonical_products: [], product_aliases: [], budget_rollovers: [],
        container_deposit_vouchers: [], container_deposit_recoveries: [],
      },
    };
    const parse = jest.spyOn(Date, 'parse').mockReturnValue(Number.NaN);
    try {
      expect(() => validateAndNormalizeBackupPayload(payload)).not.toThrow();
      payload.data.expenses[0].created_at = '2026-09-05 25:00:00';
      expect(() => validateAndNormalizeBackupPayload(payload)).toThrow('INVALID_FORMAT');
    } finally {
      parse.mockRestore();
    }
  });
});

describe('backup share dialog title (BUG-30)', () => {
  it('uses the caller-provided localized dialog title', async () => {
    (getDatabase as jest.Mock).mockResolvedValue({
      getAllAsync: jest.fn(async () => []),
      getFirstAsync: jest.fn().mockResolvedValue(null),
    });
    const file = {
      uri: 'file:///cache/synthetic.json', exists: false, size: 12,
      create: jest.fn(() => { file.exists = true; }), write: jest.fn(), delete: jest.fn(),
    };
    (File as unknown as jest.Mock).mockImplementation(() => file);
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);

    await exportBackupToFile(range, { dialogTitle: 'S.P.A.R.K. yedeği' });

    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      file.uri,
      expect.objectContaining({ dialogTitle: 'S.P.A.R.K. yedeği' }),
    );
  });
});
