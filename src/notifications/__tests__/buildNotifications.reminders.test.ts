import type { Debt, RecurringPaymentReminder } from '../../db/schema';
import type { InAppNotification, RulesState } from '../types';

let mockStoredFeed: InAppNotification[] = [];
let mockStoredRules: RulesState = {};
let mockDebtRows: Debt[] = [];
let mockPlanRows: RecurringPaymentReminder[] = [];
let mockInferredRows: Array<Record<string, unknown>> = [];
const mockReconcileReceiptSavedNotifications = jest.fn(async (feed: InAppNotification[]) => feed);

jest.mock('../../db/debtDao', () => ({
  DebtDao: { listAll: jest.fn(async () => mockDebtRows) },
}));
jest.mock('../../db/recurringPaymentReminderDao', () => ({
  RecurringPaymentReminderDao: { listAll: jest.fn(async () => mockPlanRows) },
}));
jest.mock('../../db/subscriptionDao', () => ({
  SubscriptionDao: { getActive: jest.fn(async () => mockInferredRows) },
}));
jest.mock('../../services/subscriptionDetector', () => ({
  syncSubscriptions: jest.fn(async () => undefined),
}));
jest.mock('../../db/budgetDao', () => ({
  BudgetDao: {
    getForMonth: jest.fn(async () => null),
    getContainingDate: jest.fn(async () => null),
    getLatestActive: jest.fn(async () => null),
  },
}));
jest.mock('../../db/expenseDao', () => ({
  ExpenseDao: {
    getTotalByDateRange: jest.fn(async () => 0),
    getSpentForCategoryInRange: jest.fn(async () => 0),
    getCategorySpending: jest.fn(async () => []),
  },
}));
jest.mock('../../db/goalDao', () => ({ GoalDao: { get: jest.fn(async () => null) } }));
jest.mock('../../db/categoryLimitDao', () => ({
  CategoryLimitDao: { getForMonth: jest.fn(async () => []) },
}));
jest.mock('../../db/categoryDao', () => ({ CategoryDao: { getById: jest.fn() } }));
jest.mock('../../services/geminiService', () => ({ hasApiKey: jest.fn(async () => true) }));
jest.mock('../../services/pendingReceiptDraft', () => ({
  peekPendingReceiptDraft: jest.fn(() => null),
}));
jest.mock('../../services/scanSession', () => ({ getScanSessionError: jest.fn(() => null) }));
jest.mock('../../services/budgetCycleSettings', () => ({
  getCycleStartDay: jest.fn(async () => 1),
}));
jest.mock('../../services/backupMeta', () => ({
  loadBackupMeta: jest.fn(async () => ({ reminderEnabled: false })),
  isBackupOverdue: jest.fn(() => false),
}));
jest.mock('../receiptNotifications', () => ({
  reconcileReceiptSavedNotificationsFromDatabase: (feed: InAppNotification[]) =>
    mockReconcileReceiptSavedNotifications(feed),
}));
jest.mock('../storage', () => {
  const actual = jest.requireActual('../storage');
  return {
    ...actual,
    loadFeedStrict: jest.fn(async () => mockStoredFeed),
    loadRulesStateStrict: jest.fn(async () => mockStoredRules),
    saveNotificationSnapshot: jest.fn(async (feed, rules) => {
      mockStoredFeed = feed;
      mockStoredRules = rules;
    }),
  };
});

import { runNotificationSync } from '../buildNotifications';

const UID = '123e4567-e89b-42d3-a456-426614174000';

function debt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: 7,
    direction: 'borrowed',
    counterparty: 'Ali',
    amount: 120,
    remaining: 100,
    currency: 'PLN',
    date: '2026-01-01',
    status: 'open',
    due_date: '2026-08-14',
    reminder_enabled: 1,
    reminder_days_before: 3,
    reminder_time: '09:00',
    linked_expense_id: null,
    note: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function plan(overrides: Partial<RecurringPaymentReminder> = {}): RecurringPaymentReminder {
  return {
    id: 5,
    uid: UID,
    title: 'İnternet',
    vendor_id: 42,
    expected_amount: 79.9,
    currency: 'PLN',
    anchor_date: '2026-01-14',
    next_due_date: '2026-08-14',
    recurrence_unit: 'month',
    recurrence_interval: 1,
    reminder_days_before: 3,
    reminder_time: '09:00',
    status: 'active',
    source: 'detected',
    note: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const NON_REMINDER_MUTES = {
  budget: true,
  category_limit: true,
  goal: true,
  receipt: true,
  system: true,
  backup: true,
};

describe('runNotificationSync reminder integration', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 11, 9, 0, 0));
    mockStoredFeed = [];
    mockStoredRules = {};
    mockDebtRows = [debt()];
    mockPlanRows = [plan()];
    mockReconcileReceiptSavedNotifications.mockImplementation(async (feed) => feed);
    mockInferredRows = [{
      vendor_id: 42,
      vendor_name: 'İnternet',
      next_expected_date: '2026-08-14',
    }];
  });

  afterEach(() => jest.useRealTimers());

  it('creates separate debt and confirmed-plan records and suppresses duplicate inference', async () => {
    const first = await runNotificationSync(NON_REMINDER_MUTES);
    expect(first.feed.map((item) => item.id).sort()).toEqual([
      'debt-due-v1-7-2026-08-14-3-0900-upcoming',
      `payplan-due-v1-${UID}-2026-08-14-3-0900-upcoming`,
    ].sort());
    expect(first.feed.some((item) => item.id.startsWith('sub-'))).toBe(false);
    expect(first.createdIds).toHaveLength(2);

    const second = await runNotificationSync(NON_REMINDER_MUTES);
    expect(second.createdIds).toEqual([]);
    expect(second.feed).toHaveLength(2);
  });

  it('retires an existing inferred card when its vendor becomes a confirmed plan', async () => {
    const inferredId = 'sub-due-42-2026-08-14';
    mockStoredFeed = [{
      id: inferredId,
      severity: 'info',
      titleKey: 'notif_sub_due_t',
      bodyKey: 'notif_sub_due_b',
      params: { vendor: 'İnternet' },
      createdAt: 1,
      read: false,
    }];
    mockStoredRules = { subscriptionDueLast: { '42': '2026-08-14' } };

    const result = await runNotificationSync(NON_REMINDER_MUTES);

    expect(result.feed.some((item) => item.id === inferredId)).toBe(false);
    expect(result.retiredIds).toContain(inferredId);
    expect(mockStoredRules.subscriptionDueLast).toEqual({});
    expect(result.feed.some((item) => item.id.startsWith('payplan-due-v1-'))).toBe(true);
  });

  it('retires feed derivatives when debt settles and plan pauses', async () => {
    const first = await runNotificationSync(NON_REMINDER_MUTES);
    mockDebtRows = [debt({ status: 'settled', remaining: 0, reminder_enabled: 0 })];
    mockPlanRows = [plan({ status: 'paused' })];

    const second = await runNotificationSync(NON_REMINDER_MUTES);
    expect(second.feed).toEqual([]);
    expect(second.retiredIds.sort()).toEqual(first.feed.map((item) => item.id).sort());
    expect(mockStoredRules.debtDueLast).toEqual({});
    expect(mockStoredRules.paymentPlanDueLast).toEqual({});
  });

  it('retires a saved-receipt card when its expense was deleted', async () => {
    const receiptId = 'receipt-saved-88';
    mockStoredFeed = [{
      id: receiptId,
      severity: 'info',
      titleKey: 'notif_receipt_saved_t',
      bodyKey: 'notif_receipt_saved_b',
      params: { vendor: 'Eski işlem' },
      createdAt: 1,
      read: false,
    }];
    mockDebtRows = [];
    mockPlanRows = [];
    mockInferredRows = [];
    mockReconcileReceiptSavedNotifications.mockResolvedValueOnce([]);

    const result = await runNotificationSync(NON_REMINDER_MUTES);

    expect(result.feed).toEqual([]);
    expect(result.createdIds).toEqual([]);
    expect(result.retiredIds).toContain(receiptId);
  });
});
