const mockOpen = jest.fn();
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: (...args: unknown[]) => mockOpen(...args) }));

describe('getDatabase init failure (BUG-07)', () => {
  beforeEach(() => mockOpen.mockReset());

  it('does not cache a rejected init: the next call opens the database again', async () => {
    mockOpen.mockRejectedValue(new Error('disk I/O error'));
    let getDatabase!: typeof import('../database').getDatabase;
    jest.isolateModules(() => { ({ getDatabase } = require('../database')); });

    await expect(getDatabase()).rejects.toThrow('disk I/O error');
    await expect(getDatabase()).rejects.toThrow('disk I/O error');

    expect(mockOpen).toHaveBeenCalledTimes(2);
  });

  it('closes a half-initialized connection before allowing a retry', async () => {
    const closeAsync = jest.fn().mockResolvedValue(undefined);
    const execAsync = jest.fn().mockRejectedValue(new Error('migration failed'));
    mockOpen.mockResolvedValue({ execAsync, closeAsync });
    let getDatabase!: typeof import('../database').getDatabase;
    jest.isolateModules(() => { ({ getDatabase } = require('../database')); });

    await expect(getDatabase()).rejects.toThrow('migration failed');

    expect(closeAsync).toHaveBeenCalledTimes(1);
  });
});
