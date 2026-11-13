// BUG-22 kabul kriteri (bildirim tarafı): döngü günü 23 iken kaydedilen limit,
// bildirim motorunda da limit ayarı/Dashboard/Analiz ile AYNI anahtar ve AYNI
// tarih aralığıyla okunur. Eskiden motor 2026-10'u, ekranlar 2026-11'i okuyordu.
import type { InAppNotification, RulesState } from '../types';

let mockStoredFeed: InAppNotification[] = [];
let mockStoredRules: RulesState = {};

jest.mock('../../db/debtDao', () => ({ DebtDao: { listAll: jest.fn(async () => []) } }));
jest.mock('../../db/recurringPaymentReminderDao', () => ({
  RecurringPaymentReminderDao: { listAll: jest.fn(async () => []) },
}));
jest.mock('../../db/subscriptionDao', () => ({ SubscriptionDao: { getActive: jest.fn(async () => []) } }));
jest.mock('../../services/subscriptionDetector', () => ({ syncSubscriptions: jest.fn(async () => undefined) }));
jest.mock('../../db/budgetRolloverDao', () => ({ BudgetRolloverDao: {
  effectiveAmount: jest.fn(async () => 0),
} }));
jest.mock('../../db/budgetDao', () => ({
  BudgetDao: {
    getForMonth: jest.fn(async () => null),
    getContainingDate: jest.fn(async () => null),
    getLatestAtOrBefore: jest.fn(async () => null),
  },
}));
jest.mock('../../db/expenseDao', () => ({
  ExpenseDao: {
    getCashSpentByDateRange: jest.fn(async () => 0),
    getSpentForCategoryInRange: jest.fn(async () => 450),
    getCategorySpending: jest.fn(async () => []),
  },
}));
jest.mock('../../db/goalDao', () => ({ GoalDao: { get: jest.fn(async () => null) } }));
jest.mock('../../db/categoryLimitDao', () => ({
  CategoryLimitDao: {
    getForMonth: jest.fn(async (month: string) => (
      month === '2026-10' ? [{ id: 1, category_id: 7, month, limit_amount: 400 }] : []
    )),
  },
}));
jest.mock('../../db/categoryDao', () => ({
  CategoryDao: { getById: jest.fn(async () => ({ id: 7, name: 'Market' })) },
}));
jest.mock('../../services/geminiService', () => ({ hasApiKey: jest.fn(async () => true) }));
jest.mock('../../services/scanSession', () => ({ getScanSessionError: jest.fn(() => null) }));
jest.mock('../../services/budgetCycleSettings', () => ({ getCycleStartDay: jest.fn(async () => 23) }));
jest.mock('../../services/backupMeta', () => ({
  loadBackupMeta: jest.fn(async () => ({ lastAt: null, reminderInterval: 'off' })),
  isBackupOverdue: jest.fn(() => false),
}));
jest.mock('../receiptNotifications', () => ({
  reconcileReceiptSavedNotificationsFromDatabase: async (feed: InAppNotification[]) => feed,
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

import { CategoryLimitDao } from '../../db/categoryLimitDao';
import { ExpenseDao } from '../../db/expenseDao';
import { runNotificationSync } from '../buildNotifications';

describe('runNotificationSync kategori limiti dönemi (BUG-22)', () => {
  beforeEach(() => {
    mockStoredFeed = [];
    mockStoredRules = {};
    jest.useFakeTimers().setSystemTime(new Date(2026, 10, 11, 9, 0, 0));
  });
  afterEach(() => jest.useRealTimers());

  it('döngü günü 23 iken limit uyarısı döngü anahtarı ve aralığıyla üretilir', async () => {
    const result = await runNotificationSync({});

    expect(CategoryLimitDao.getForMonth).toHaveBeenCalledWith('2026-10');
    expect(ExpenseDao.getSpentForCategoryInRange).toHaveBeenCalledWith(7, '2026-10-23', '2026-11-22');
    expect(result.feed.map(item => item.id)).toContain('catlim-2026-10-7-over');
  });
});
