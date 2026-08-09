import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('../../db/goalDao', () => ({
  GoalDao: { get: jest.fn() },
}));
jest.mock('../../db/categoryLimitDao', () => ({
  CategoryLimitDao: { getForMonth: jest.fn() },
}));
jest.mock('../../db/categoryDao', () => ({
  CategoryDao: { getAll: jest.fn() },
}));
jest.mock('../../db/expenseDao', () => ({
  ExpenseDao: { getSpentForCategoryInRange: jest.fn() },
}));
jest.mock('../../services/goalFeatureSettings', () => ({
  getGoalFeaturePreferences: jest.fn(),
}));

import { GoalDao, SavingsGoalRow } from '../../db/goalDao';
import { getGoalFeaturePreferences } from '../../services/goalFeatureSettings';
import { useGoalFeatureEnabled, useSavingsGoal } from '../useSavingsGoalData';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const goal = (currentAmount: number): SavingsGoalRow => ({
  id: 1,
  title: 'Emergency fund',
  target_amount: 1000,
  target_date: '2026-12-31',
  currency: 'PLN',
  current_amount: currentAmount,
});

describe('useSavingsGoal refresh görünürlüğü', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads initially, then preserves the existing goal while a refresh is pending', async () => {
    const initial = deferred<SavingsGoalRow | null>();
    (GoalDao.get as jest.Mock).mockImplementationOnce(() => initial.promise);

    const { result } = await renderHook(() => useSavingsGoal());

    expect(result.current.loading).toBe(true);
    expect(result.current.goal).toBeNull();

    await act(async () => {
      initial.resolve(goal(250));
      await initial.promise;
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.goal).toEqual(goal(250));

    const refresh = deferred<SavingsGoalRow | null>();
    (GoalDao.get as jest.Mock).mockImplementationOnce(() => refresh.promise);
    let refreshPromise!: Promise<void>;

    await act(async () => {
      refreshPromise = result.current.refresh();
      await Promise.resolve();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.goal).toEqual(goal(250));

    await act(async () => {
      refresh.resolve(goal(400));
      await refreshPromise;
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.goal).toEqual(goal(400));
    });
  });
});

describe('useGoalFeatureEnabled refresh görünürlüğü', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads preferences initially, then keeps them visible until refresh resolves', async () => {
    const initial = deferred<{ enabled: boolean; dashboardFocusEnabled: boolean }>();
    (getGoalFeaturePreferences as jest.Mock).mockImplementationOnce(() => initial.promise);

    const { result } = await renderHook(() => useGoalFeatureEnabled());

    expect(result.current.loading).toBe(true);
    expect(result.current.enabled).toBe(true);
    expect(result.current.dashboardFocusEnabled).toBe(false);

    await act(async () => {
      initial.resolve({ enabled: true, dashboardFocusEnabled: false });
      await initial.promise;
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.enabled).toBe(true);
    expect(result.current.dashboardFocusEnabled).toBe(false);

    const refresh = deferred<{ enabled: boolean; dashboardFocusEnabled: boolean }>();
    (getGoalFeaturePreferences as jest.Mock).mockImplementationOnce(() => refresh.promise);
    let refreshPromise!: Promise<void>;

    await act(async () => {
      refreshPromise = result.current.refresh();
      await Promise.resolve();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.enabled).toBe(true);
    expect(result.current.dashboardFocusEnabled).toBe(false);

    await act(async () => {
      refresh.resolve({ enabled: true, dashboardFocusEnabled: true });
      await refreshPromise;
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.enabled).toBe(true);
      expect(result.current.dashboardFocusEnabled).toBe(true);
    });
  });
});
