jest.mock('../database', () => ({ getDatabase: jest.fn() }));

import { getDatabase } from '../database';
import { GoalDao } from '../goalDao';

const getDatabaseMock = getDatabase as jest.MockedFunction<typeof getDatabase>;

describe('GoalDao clear contract', () => {
  const runAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    getDatabaseMock.mockResolvedValue({ runAsync } as any);
  });

  it('returns true only when a persisted goal was actually removed', async () => {
    runAsync.mockResolvedValueOnce({ changes: 1 });

    await expect(GoalDao.clear()).resolves.toBe(true);
    expect(runAsync).toHaveBeenCalledWith('DELETE FROM savings_goal WHERE id = 1');
  });

  it('returns false when there is no goal to remove', async () => {
    runAsync.mockResolvedValueOnce({ changes: 0 });

    await expect(GoalDao.clear()).resolves.toBe(false);
  });
});
