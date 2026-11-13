import { applyBusyTimeout, SQLITE_BUSY_TIMEOUT_PRAGMA } from '../busyTimeout';

describe('applyBusyTimeout (BUG-05)', () => {
  it('bağlantıya kilit bekleme süresini tek PRAGMA ile uygular', async () => {
    const execAsync = jest.fn().mockResolvedValue(undefined);

    await applyBusyTimeout({ execAsync } as any);

    expect(SQLITE_BUSY_TIMEOUT_PRAGMA).toBe('PRAGMA busy_timeout = 3000;');
    expect(execAsync).toHaveBeenCalledWith(SQLITE_BUSY_TIMEOUT_PRAGMA);
  });
});
