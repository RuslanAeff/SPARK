import type { InAppNotification } from '../types';

const mockGetNotificationSubjectsByIds = jest.fn();
const mockLoadFeedStrict = jest.fn();
const mockLoadMutesStrict = jest.fn();
const mockSaveFeed = jest.fn();
const mockEnqueueNotificationMutation = jest.fn(
  async (task: () => Promise<unknown>) => task(),
);

jest.mock('../../db/expenseDao', () => ({
  ExpenseDao: {
    getNotificationSubjectsByIds: (...args: unknown[]) =>
      mockGetNotificationSubjectsByIds(...args),
  },
}));

jest.mock('../storage', () => ({
  enqueueNotificationMutation: (task: () => Promise<unknown>) =>
    mockEnqueueNotificationMutation(task),
  loadFeedStrict: () => mockLoadFeedStrict(),
  loadMutesStrict: () => mockLoadMutesStrict(),
  mergeFeedItem: (
    feed: InAppNotification[],
    item: Omit<InAppNotification, 'read'> & { read?: boolean },
  ) => {
    if (feed.some((existing) => existing.id === item.id)) return feed;
    return [{ ...item, read: item.read ?? false }, ...feed];
  },
  saveFeed: (feed: InAppNotification[]) => mockSaveFeed(feed),
}));

import {
  receiptSavedExpenseId,
  receiptSavedExpenseIds,
  reconcileReceiptSavedNotifications,
  reconcileReceiptSavedNotificationsFromDatabase,
  refreshReceiptSavedNotification,
  appendReceiptSavedNotification,
} from '../receiptNotifications';

function notification(
  id: string,
  vendor = 'Eski AI adı',
  read = false,
): InAppNotification {
  return {
    id,
    severity: 'info',
    titleKey: 'notif_receipt_saved_t',
    bodyKey: 'notif_receipt_saved_b',
    params: { vendor, source: 'kept' },
    createdAt: 1_725_000_000_000,
    read,
  };
}

describe('receipt notification reconciliation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetNotificationSubjectsByIds.mockResolvedValue([]);
    mockLoadFeedStrict.mockResolvedValue([]);
    mockLoadMutesStrict.mockResolvedValue({});
    mockSaveFeed.mockResolvedValue(undefined);
  });

  it('accepts only safe receipt-saved expense IDs and deduplicates them', () => {
    expect(receiptSavedExpenseId('receipt-saved-42')).toBe(42);
    expect(receiptSavedExpenseId('receipt-saved-0')).toBeNull();
    expect(receiptSavedExpenseId('receipt-saved--2')).toBeNull();
    expect(receiptSavedExpenseId('receipt-pending-edit')).toBeNull();
    expect(receiptSavedExpenseId('receipt-saved-9007199254740992')).toBeNull();

    expect(
      receiptSavedExpenseIds([
        notification('receipt-saved-42'),
        notification('receipt-saved-42'),
        notification('budget-2026-08-80'),
      ]),
    ).toEqual([42]);
  });

  it('replaces only the canonical vendor while preserving notification history', () => {
    const receipt = notification('receipt-saved-42', 'Eski AI adı', true);
    const budget = notification('budget-2026-08-80', 'Dokunma');

    const next = reconcileReceiptSavedNotifications(
      [receipt, budget],
      [{ expense_id: 42, vendor_name: 'Yeni Market' }],
    );

    expect(next[0]).toEqual({
      ...receipt,
      params: { vendor: 'Yeni Market', source: 'kept' },
    });
    expect(next[0].read).toBe(true);
    expect(next[0].createdAt).toBe(receipt.createdAt);
    expect(next[1]).toBe(budget);
  });

  it('retires a receipt notification after its canonical expense is deleted', () => {
    const receipt = notification('receipt-saved-42');
    const budget = notification('budget-2026-08-80', 'Dokunma');

    expect(
      reconcileReceiptSavedNotifications([receipt, budget], [
        { expense_id: 99, vendor_name: 'Başka kayıt' },
      ]),
    ).toEqual([budget]);
  });

  it('uses the neutral placeholder when the saved expense has no vendor', () => {
    const next = reconcileReceiptSavedNotifications(
      [notification('receipt-saved-42')],
      [{ expense_id: 42, vendor_name: null }],
    );

    expect(next[0].params?.vendor).toBe('—');
  });

  it('loads all receipt subjects in one batch during normal notification sync', async () => {
    const feed = [notification('receipt-saved-7'), notification('receipt-saved-8')];
    mockGetNotificationSubjectsByIds.mockResolvedValue([
      { expense_id: 7, vendor_name: 'Market A' },
      { expense_id: 8, vendor_name: 'Market B' },
    ]);

    const next = await reconcileReceiptSavedNotificationsFromDatabase(feed);

    expect(mockGetNotificationSubjectsByIds).toHaveBeenCalledTimes(1);
    expect(mockGetNotificationSubjectsByIds).toHaveBeenCalledWith([7, 8]);
    expect(next.map((item) => item.params?.vendor)).toEqual(['Market A', 'Market B']);
  });

  it('removes only missing receipt subjects during normal notification sync', async () => {
    const budget = notification('budget-2026-08-80', 'Dokunma');
    const feed = [notification('receipt-saved-7'), notification('receipt-saved-8'), budget];
    mockGetNotificationSubjectsByIds.mockResolvedValue([
      { expense_id: 8, vendor_name: 'Kalan Market' },
    ]);

    const next = await reconcileReceiptSavedNotificationsFromDatabase(feed);

    expect(next).toEqual([
      expect.objectContaining({ id: 'receipt-saved-8', params: expect.objectContaining({ vendor: 'Kalan Market' }) }),
      budget,
    ]);
  });

  it('refreshes an existing receipt notification without creating a manual one', async () => {
    const receipt = notification('receipt-saved-42');
    mockLoadFeedStrict.mockResolvedValue([receipt]);
    mockGetNotificationSubjectsByIds.mockResolvedValue([
      { expense_id: 42, vendor_name: 'Yeni Market' },
    ]);

    await refreshReceiptSavedNotification(42);

    expect(mockSaveFeed).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'receipt-saved-42',
        params: { vendor: 'Yeni Market', source: 'kept' },
      }),
    ]);

    jest.clearAllMocks();
    mockLoadFeedStrict.mockResolvedValue([notification('budget-2026-08-80')]);
    await refreshReceiptSavedNotification(42);

    expect(mockGetNotificationSubjectsByIds).not.toHaveBeenCalled();
    expect(mockSaveFeed).not.toHaveBeenCalled();
  });

  it('fails closed when the canonical vendor query fails', async () => {
    mockLoadFeedStrict.mockResolvedValue([notification('receipt-saved-42')]);
    mockGetNotificationSubjectsByIds.mockRejectedValue(new Error('db read failed'));

    await expect(refreshReceiptSavedNotification(42)).rejects.toThrow('db read failed');
    expect(mockSaveFeed).not.toHaveBeenCalled();
  });

  it('creates a new receipt notification from the canonical DB vendor', async () => {
    mockGetNotificationSubjectsByIds.mockResolvedValue([
      { expense_id: 42, vendor_name: 'Yeni Market' },
    ]);
    mockLoadFeedStrict.mockResolvedValue([notification('budget-2026-08-80')]);

    await appendReceiptSavedNotification(42);

    expect(mockGetNotificationSubjectsByIds).toHaveBeenCalledWith([42]);
    expect(mockSaveFeed).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'receipt-saved-42',
        params: { vendor: 'Yeni Market' },
        read: false,
      }),
      expect.objectContaining({ id: 'budget-2026-08-80' }),
    ]);
  });

  it('does not append while receipt notifications are muted or the expense is missing', async () => {
    mockLoadMutesStrict.mockResolvedValue({ receipt: true });
    await appendReceiptSavedNotification(42);

    expect(mockGetNotificationSubjectsByIds).not.toHaveBeenCalled();
    expect(mockLoadFeedStrict).not.toHaveBeenCalled();
    expect(mockSaveFeed).not.toHaveBeenCalled();

    jest.clearAllMocks();
    mockLoadMutesStrict.mockResolvedValue({});
    mockGetNotificationSubjectsByIds.mockResolvedValue([]);
    await appendReceiptSavedNotification(42);

    expect(mockLoadFeedStrict).not.toHaveBeenCalled();
    expect(mockSaveFeed).not.toHaveBeenCalled();
  });
});
