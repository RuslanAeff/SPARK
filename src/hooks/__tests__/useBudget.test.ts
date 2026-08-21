import { act, renderHook, waitFor } from '@testing-library/react-native';

import { BudgetDao } from '../../db/budgetDao';
import { DebtDao } from '../../db/debtDao';
import { ExpenseDao } from '../../db/expenseDao';
import { IncomeDao } from '../../db/incomeDao';
import { useBudget } from '../useBudget';

jest.mock('../../db/budgetDao', () => ({
  BudgetDao: {
    getForMonth: jest.fn(),
    getContainingDate: jest.fn(),
    getLatestActive: jest.fn(),
  },
}));

jest.mock('../../db/expenseDao', () => ({
  ExpenseDao: {
    getTotalByDateRange: jest.fn(),
  },
}));

jest.mock('../../db/debtDao', () => ({
  DebtDao: {
    getBorrowedTotalByDateRange: jest.fn(),
    getRepaidTotalByDateRange: jest.fn(),
    getOutstandingTotal: jest.fn(),
  },
}));

jest.mock('../../db/incomeDao', () => ({
  IncomeDao: {
    getTotalByDateRange: jest.fn(),
  },
}));

jest.mock('../../services/budgetCycleSettings', () => ({
  getCycleStartDay: jest.fn(async () => 1),
}));

jest.mock('../../utils/budgetCycle', () => {
  const cycle = {
    key: '2026-07',
    start: '2026-07-01',
    end: '2026-07-31',
    totalDays: 31,
  };
  return {
    getCurrentCycle: jest.fn(() => cycle),
    getCycleForKey: jest.fn(() => cycle),
    getCycleProgress: jest.fn(() => ({ dayOfCycle: 10, daysRemaining: 21 })),
  };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('useBudget refresh sıralaması', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (BudgetDao.getForMonth as jest.Mock).mockResolvedValue({
      monthly_amount: 1000,
      currency: 'PLN',
    });
    (BudgetDao.getContainingDate as jest.Mock).mockResolvedValue({
      monthly_amount: 1000,
      currency: 'PLN',
      period_start: null,
      period_end: null,
      cycle_start_day: null,
    });
    (BudgetDao.getLatestActive as jest.Mock).mockResolvedValue(null);
    (DebtDao.getBorrowedTotalByDateRange as jest.Mock).mockResolvedValue(0);
    (DebtDao.getRepaidTotalByDateRange as jest.Mock).mockResolvedValue(0);
    (DebtDao.getOutstandingTotal as jest.Mock).mockResolvedValue(0);
    (IncomeDao.getTotalByDateRange as jest.Mock).mockResolvedValue(0);
  });

  it('geç biten eski sorgu, daha yeni bütçe sonucunu ezmez', async () => {
    const firstExpenseQuery = deferred<number>();
    (ExpenseDao.getTotalByDateRange as jest.Mock)
      .mockImplementationOnce(() => firstExpenseQuery.promise)
      .mockResolvedValueOnce(200);

    const { result } = await renderHook(() => useBudget());

    await waitFor(() => {
      expect(ExpenseDao.getTotalByDateRange).toHaveBeenCalledTimes(1);
      expect(result.current).not.toBeNull();
    });

    await act(async () => {
      await result.current!.refresh();
    });
    expect(result.current!.budget.totalSpent).toBe(200);

    await act(async () => {
      firstExpenseQuery.resolve(100);
      await firstExpenseQuery.promise;
      await Promise.resolve();
    });

    expect(result.current!.budget.totalSpent).toBe(200);
    expect(result.current!.budget.remaining).toBe(800);
  });
});
