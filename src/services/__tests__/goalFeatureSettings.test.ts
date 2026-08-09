jest.mock('../../db/database', () => ({ getDatabase: jest.fn() }));

import { getDatabase } from '../../db/database';
import {
  getGoalFeaturePreferences,
  setGoalDashboardFocusEnabled,
  setGoalFeatureEnabled,
} from '../goalFeatureSettings';

const getDatabaseMock = getDatabase as jest.MockedFunction<typeof getDatabase>;

describe('goal feature preferences', () => {
  const getAllAsync = jest.fn();
  const runAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    getDatabaseMock.mockResolvedValue({ getAllAsync, runAsync } as any);
  });

  it('uses one read and returns backward-compatible defaults when keys are absent', async () => {
    getAllAsync.mockResolvedValueOnce([]);

    await expect(getGoalFeaturePreferences()).resolves.toEqual({
      enabled: true,
      dashboardFocusEnabled: false,
    });
    expect(getAllAsync).toHaveBeenCalledTimes(1);
    expect(getAllAsync).toHaveBeenCalledWith(
      'SELECT key, value FROM settings WHERE key IN (?, ?)',
      ['goal_feature_enabled', 'goal_dashboard_focus_enabled'],
    );
  });

  it('fails closed only for focus while preserving the existing feature default', async () => {
    getAllAsync.mockRejectedValueOnce(new Error('db unavailable'));

    await expect(getGoalFeaturePreferences()).resolves.toEqual({
      enabled: true,
      dashboardFocusEnabled: false,
    });
    expect(getAllAsync).toHaveBeenCalledTimes(1);
  });

  it('maps persisted 1 and 0 values without additional reads', async () => {
    getAllAsync.mockResolvedValueOnce([
      { key: 'goal_feature_enabled', value: '0' },
      { key: 'goal_dashboard_focus_enabled', value: '1' },
    ]);

    await expect(getGoalFeaturePreferences()).resolves.toEqual({
      enabled: false,
      dashboardFocusEnabled: true,
    });
    expect(getAllAsync).toHaveBeenCalledTimes(1);
  });

  it.each([
    [true, '1'],
    [false, '0'],
  ])('persists the master visibility preference (%s)', async (enabled, stored) => {
    runAsync.mockResolvedValueOnce({ changes: 1 });

    await setGoalFeatureEnabled(enabled);

    expect(runAsync).toHaveBeenCalledWith(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      ['goal_feature_enabled', stored],
    );
  });

  it.each([
    [true, '1'],
    [false, '0'],
  ])('persists the dashboard focus preference (%s)', async (enabled, stored) => {
    runAsync.mockResolvedValueOnce({ changes: 1 });

    await setGoalDashboardFocusEnabled(enabled);

    expect(runAsync).toHaveBeenCalledWith(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      ['goal_dashboard_focus_enabled', stored],
    );
  });
});
