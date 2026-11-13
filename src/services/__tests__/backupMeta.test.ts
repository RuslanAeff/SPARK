jest.mock('../../db/database', () => ({ getDatabase: jest.fn() }));

import { getDatabase } from '../../db/database';
import { loadBackupMeta, recordBackupSuccess } from '../backupMeta';

const getDatabaseMock = getDatabase as jest.MockedFunction<typeof getDatabase>;

describe('backupMeta DB access (BUG-12)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('recordBackupSuccess writes all keys of a full backup inside one transaction', async () => {
    let inTransaction = false;
    const writesInTx: string[] = [];
    const runAsync = jest.fn(async (_sql: string, params: unknown[]) => {
      if (inTransaction) writesInTx.push(String(params[0]));
      return { changes: 1, lastInsertRowId: 0 };
    });
    const withTransactionAsync = jest.fn(async (work: () => Promise<void>) => {
      inTransaction = true;
      try { await work(); } finally { inTransaction = false; }
    });
    getDatabaseMock.mockResolvedValue({ runAsync, withTransactionAsync } as any);

    await recordBackupSuccess({ expenseCount: 3, itemCount: 9, rangeStart: '2026-11-01', rangeEnd: '2026-11-30', fullRange: true });

    expect(withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(runAsync).toHaveBeenCalledTimes(6);
    expect(writesInTx).toHaveLength(6);
  });

  it('loadBackupMeta reads settings one at a time on the shared connection', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const getFirstAsync = jest.fn(async (_sql: string, params: unknown[]) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight--;
      return params[0] === 'backup_reminder_interval' ? { value: 'weekly' } : null;
    });
    getDatabaseMock.mockResolvedValue({ getFirstAsync } as any);

    const meta = await loadBackupMeta();

    expect(getFirstAsync).toHaveBeenCalledTimes(7);
    expect(maxInFlight).toBe(1);
    expect(meta.lastAt).toBeNull();
  });
});
