import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockInit = jest.fn();
jest.mock('../../db/database', () => ({ initializeDatabase: () => mockInit() }));
jest.mock('../../utils/themeSchedule', () => ({ applyThemeFromDatabase: jest.fn(async () => undefined) }));

import { useDatabase } from '../useDatabase';

describe('useDatabase (BUG-07)', () => {
  beforeEach(() => mockInit.mockReset());

  it('exposes a failure flag without the raw error message, and retry opens again', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockInit.mockRejectedValueOnce(new Error('SQLITE_CORRUPT: /data/user/0/app/files/SQLite/spark.db'));
    mockInit.mockResolvedValueOnce(undefined);

    const { result } = await renderHook(() => useDatabase());
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(JSON.stringify(result.current)).not.toContain('SQLITE_CORRUPT');
    expect(result.current.isReady).toBe(false);

    await act(async () => { result.current.retry(); });

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.failed).toBe(false);
    expect(mockInit).toHaveBeenCalledTimes(2);
  });
});
