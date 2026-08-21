import type { Budget, Debt, RecurringPaymentReminder } from '../../db/schema';
import type { SavingsGoalRow } from '../../db/goalDao';

const mockDebtListAll = jest.fn();
const mockRecurringListAll = jest.fn();
const mockGoalGet: jest.Mock<Promise<SavingsGoalRow | null>, []> = jest.fn(async () => null);
const mockBudgetGetContainingDate: jest.Mock<Promise<Budget | null>, [string]> = jest.fn(
  async (_date: string) => null,
);
const mockBudgetGetLatestActive: jest.Mock<Promise<Budget | null>, []> = jest.fn(async () => null);
const mockGetCycleStartDay: jest.Mock<Promise<number>, []> = jest.fn(async () => 1);
const mockLoadRulesState = jest.fn(async () => ({}));
const mockIsReminderDismissed = jest.fn((_id?: string, _rules?: unknown) => false);
const mockReconcile = jest.fn(async (items: unknown[], _options?: unknown) => ({
  status: 'ready',
  scheduledIds: items.map((_: unknown, index: number) => String(index)),
  canceledIds: [],
  failedScheduleIds: [],
  failedCancelIds: [],
}));

jest.mock('../../db/debtDao', () => ({
  DebtDao: { listAll: (...args: unknown[]) => mockDebtListAll(...args) },
}));

jest.mock('../../db/recurringPaymentReminderDao', () => ({
  RecurringPaymentReminderDao: {
    listAll: (...args: unknown[]) => mockRecurringListAll(...args),
  },
}));

jest.mock('../../db/goalDao', () => ({
  GoalDao: { get: () => mockGoalGet() },
}));

jest.mock('../../db/budgetDao', () => ({
  BudgetDao: {
    getContainingDate: (date: string) => mockBudgetGetContainingDate(date),
    getLatestActive: () => mockBudgetGetLatestActive(),
  },
}));

jest.mock('../budgetCycleSettings', () => ({
  getCycleStartDay: () => mockGetCycleStartDay(),
}));

jest.mock('../../notifications/storage', () => ({
  loadRulesStateStrict: () => mockLoadRulesState(),
  isReminderNotificationDismissed: (id: string, rules: unknown) =>
    mockIsReminderDismissed(id, rules),
}));

jest.mock('../androidNotificationsSetup', () => ({
  reconcileAndroidReminderSchedules: (items: unknown[], options: unknown) =>
    mockReconcile(items, options),
}));

import { syncAndroidReminderSchedules } from '../reminderScheduler';

const debt: Debt = {
  id: 7,
  direction: 'borrowed',
  counterparty: 'Private counterparty',
  amount: 120,
  remaining: 80,
  currency: 'PLN',
  date: '2026-08-01',
  status: 'open',
  due_date: '2026-08-20',
  reminder_enabled: 1,
  reminder_days_before: 3,
  reminder_time: '09:00',
  linked_expense_id: null,
  note: null,
  created_at: '2026-08-01T00:00:00.000Z',
};

const recurring: RecurringPaymentReminder = {
  id: 4,
  uid: '123e4567-e89b-42d3-a456-426614174000',
  title: 'Internet',
  vendor_id: null,
  expected_amount: 50,
  currency: 'PLN',
  anchor_date: '2026-08-22',
  next_due_date: '2026-08-22',
  recurrence_unit: 'month',
  recurrence_interval: 1,
  reminder_days_before: 2,
  reminder_time: '08:30',
  status: 'active',
  source: 'manual',
  note: null,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
};

describe('future reminder scheduler orchestration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDebtListAll.mockResolvedValue([debt]);
    mockRecurringListAll.mockResolvedValue([recurring]);
    mockGoalGet.mockResolvedValue(null);
    mockBudgetGetContainingDate.mockResolvedValue(null);
    mockBudgetGetLatestActive.mockResolvedValue(null);
    mockGetCycleStartDay.mockResolvedValue(1);
    mockIsReminderDismissed.mockImplementation(() => false);
  });

  it('reads the shared SQLite-backed DAOs serially and emits localized warning schedules', async () => {
    let releaseDebts: ((value: Debt[]) => void) | undefined;
    mockDebtListAll.mockReturnValueOnce(new Promise<Debt[]>((resolve) => {
      releaseDebts = resolve;
    }));
    const now = new Date(2026, 7, 11, 8, 0, 0, 0).getTime();
    const t = jest.fn((key: string, params?: Record<string, string | number>) =>
      `${key}:${String(params?.date ?? '')}`,
    );

    const pending = syncAndroidReminderSchedules(t, {}, now);
    await Promise.resolve();
    expect(mockDebtListAll).toHaveBeenCalledWith('borrowed');
    expect(mockRecurringListAll).not.toHaveBeenCalled();

    releaseDebts?.([debt]);
    await pending;

    expect(mockRecurringListAll).toHaveBeenCalledTimes(1);
    const desired = mockReconcile.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(desired.length).toBeGreaterThanOrEqual(4);
    expect(desired.every((item) => item.severity === 'warning')).toBe(true);
    expect(desired.every((item) => typeof item.revision === 'string')).toBe(true);
    expect(desired.every((item) => Number(item.triggerAt) > now)).toBe(true);
    expect(mockReconcile).toHaveBeenCalledWith(desired, { now, mutes: {} });
  });

  it('uses channel mutes to cancel the muted domain from desired state', async () => {
    const now = new Date(2026, 7, 11, 8, 0, 0, 0).getTime();
    const t = (key: string) => key;

    await syncAndroidReminderSchedules(t, { debt: true }, now);
    const withoutDebt = mockReconcile.mock.calls[0][0] as Array<{ scheduleId: string }>;
    expect(withoutDebt).not.toEqual([]);
    expect(withoutDebt.every((item) => item.scheduleId.startsWith('plan:'))).toBe(true);

    mockReconcile.mockClear();
    await syncAndroidReminderSchedules(t, { payment_plan: true }, now);
    const withoutPlans = mockReconcile.mock.calls[0][0] as Array<{ scheduleId: string }>;
    expect(withoutPlans).not.toEqual([]);
    expect(withoutPlans.every((item) => item.scheduleId.startsWith('debt:'))).toBe(true);
  });

  it('keeps explicitly dismissed reminder stages out of native desired state', async () => {
    const now = new Date(2026, 7, 11, 8, 0, 0, 0).getTime();
    mockIsReminderDismissed.mockImplementation((id?: string) =>
      Boolean(id?.includes('debt-due-v1-7-')),
    );

    await syncAndroidReminderSchedules((key: string) => key, {}, now);

    const desired = mockReconcile.mock.calls[0][0] as Array<{
      notificationId: string;
      scheduleId: string;
    }>;
    expect(desired).not.toEqual([]);
    expect(desired.every((item) => item.scheduleId.startsWith('plan:'))).toBe(true);
    expect(desired.every((item) => !item.notificationId.includes('debt-due-v1-7-')))
      .toBe(true);
  });

  it('revises an existing future request when the localized native copy changes', async () => {
    const now = new Date(2026, 7, 11, 8, 0, 0, 0).getTime();
    const firstLanguage = (key: string) => `first:${key}`;
    const secondLanguage = (key: string) => `second:${key}`;

    await syncAndroidReminderSchedules(firstLanguage, {}, now);
    const first = mockReconcile.mock.calls[0][0] as Array<{
      scheduleId: string;
      title: string;
      body: string;
      revision: string;
    }>;
    mockReconcile.mockClear();

    await syncAndroidReminderSchedules(secondLanguage, {}, now);
    const second = mockReconcile.mock.calls[0][0] as typeof first;

    expect(second.map((item) => item.scheduleId)).toEqual(
      first.map((item) => item.scheduleId),
    );
    expect(second[0].title).not.toBe(first[0].title);
    expect(second[0].body).not.toBe(first[0].body);
    expect(second[0].revision).not.toBe(first[0].revision);
  });

  it('adds dated goal and budget attention alarms and removes them through channel mutes', async () => {
    const now = new Date(2026, 7, 1, 8, 0, 0, 0).getTime();
    mockGoalGet.mockResolvedValue({
      id: 1,
      title: 'Emergency fund',
      target_amount: 5_000,
      current_amount: 1_200,
      target_date: '2026-10-30',
      currency: 'PLN',
    });
    mockBudgetGetContainingDate.mockResolvedValue({
      id: 2,
      monthly_amount: 3_600,
      currency: 'PLN',
      start_date: '2026-08-01',
      period_start: '2026-08-01',
      period_end: '2026-08-31',
      cycle_start_day: 1,
      active: 1,
    });

    await syncAndroidReminderSchedules((key: string) => key, {}, now);
    const desired = mockReconcile.mock.calls[0][0] as Array<{ scheduleId: string }>;
    expect(desired.some((item) => item.scheduleId.startsWith('goal:'))).toBe(true);
    expect(desired.some((item) => item.scheduleId.startsWith('budget:'))).toBe(true);

    mockReconcile.mockClear();
    await syncAndroidReminderSchedules(
      (key: string) => key,
      { goal: true, budget: true },
      now,
    );
    const muted = mockReconcile.mock.calls[0][0] as Array<{ scheduleId: string }>;
    expect(muted.some((item) => item.scheduleId.startsWith('goal:'))).toBe(false);
    expect(muted.some((item) => item.scheduleId.startsWith('budget:'))).toBe(false);
    expect(muted.some((item) => item.scheduleId.startsWith('debt:'))).toBe(true);
    expect(muted.some((item) => item.scheduleId.startsWith('plan:'))).toBe(true);
  });
});
