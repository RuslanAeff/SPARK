import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('../../db/goalDao', () => ({
  GoalDao: { get: jest.fn() },
}));
jest.mock('../../db/categoryLimitDao', () => ({
  CategoryLimitDao: { getForMonth: jest.fn(), getForMonthWithSpending: jest.fn() },
}));
jest.mock('../../db/categoryDao', () => ({
  CategoryDao: { getAll: jest.fn() },
}));
jest.mock('../../db/expenseDao', () => ({
  ExpenseDao: { getSpentForCategoryInRange: jest.fn() },
}));
jest.mock('../../services/limitCycle', () => ({
  resolveBudgetCycle: jest.fn(async () => ({
    cycle: { key: '2026-10', start: '2026-10-23', end: '2026-11-22', totalDays: 31, startDay: 23 },
    budget: null,
  })),
}));
jest.mock('../../services/goalFeatureSettings', () => ({
  getGoalFeaturePreferences: jest.fn(),
}));

import { GoalDao, SavingsGoalRow } from '../../db/goalDao';
import { getGoalFeaturePreferences } from '../../services/goalFeatureSettings';
import { CategoryLimitDao } from '../../db/categoryLimitDao';
import { useCategoryLimitsProgress, useGoalFeatureEnabled, useSavingsGoal } from '../useSavingsGoalData';

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

describe('useCategoryLimitsProgress (BUG-12, PERF-03)', () => {
  const { CategoryLimitDao } = jest.requireMock('../../db/categoryLimitDao');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useCategoryLimitsProgress } = require('../useSavingsGoalData');

  beforeEach(() => jest.clearAllMocks());

  it('limitleri ve harcamaları tek birleşik sorguyla, seçili aralıkla okur', async () => {
    CategoryLimitDao.getForMonthWithSpending.mockResolvedValue([
      { id: 1, category_id: 7, limit_amount: 100, category_name: 'Market', category_icon: 'cart', category_color: '#000000', spent: 120 },
      { id: 2, category_id: 8, limit_amount: 50, category_name: 'Kafe', category_icon: 'coffee', category_color: '#111111', spent: 10 },
    ]);

    const { result } = await renderHook(() => useCategoryLimitsProgress('2026-10-23', '2026-11-22'));

    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    expect(CategoryLimitDao.getForMonthWithSpending).toHaveBeenCalledTimes(1);
    expect(CategoryLimitDao.getForMonthWithSpending).toHaveBeenCalledWith(
      expect.stringMatching(/^\d{4}-\d{2}$/), '2026-10-23', '2026-11-22',
    );
    expect(result.current.rows[0]).toMatchObject({ id: 1, over_by: 20, remaining: 0 });
    expect(result.current.rows[1]).toMatchObject({ id: 2, over_by: 0, remaining: 40 });
  });

  it('sorgu hatasında yükleniyor durumunda takılmaz ve reddedilmiş promise sızdırmaz', async () => {
    CategoryLimitDao.getForMonthWithSpending.mockRejectedValue(new Error('db closed'));

    const { result } = await renderHook(() => useCategoryLimitsProgress('2026-11-01', '2026-11-30'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(result.current.refresh()).resolves.toBeUndefined();
  });
});

describe('useCategoryLimitsProgress dönemi (BUG-22)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (CategoryLimitDao.getForMonthWithSpending as jest.Mock).mockResolvedValue([]);
  });

  it('sınır verilmezse takvim ayına değil bugünkü bütçe döngüsüne bakar', async () => {
    await renderHook(() => useCategoryLimitsProgress());
    await waitFor(() => expect(CategoryLimitDao.getForMonthWithSpending)
      .toHaveBeenCalledWith('2026-10', '2026-10-23', '2026-11-22'));
  });

  it('Dashboard\'un seçili döngüsünde anahtar döngünün başladığı aydır', async () => {
    await renderHook(() => useCategoryLimitsProgress('2026-09-23', '2026-10-22'));
    await waitFor(() => expect(CategoryLimitDao.getForMonthWithSpending)
      .toHaveBeenCalledWith('2026-09', '2026-09-23', '2026-10-22'));
  });
});
