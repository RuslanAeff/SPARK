import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';

import {
  NotificationsProvider,
  useNotifications,
} from '../NotificationsContext';
import type {
  InAppNotification,
  NotificationMuteChannel,
} from '../../notifications/types';

let mockStoredMutes: Partial<Record<NotificationMuteChannel, boolean>> = {};
let mockStoredFeed: InAppNotification[] = [];
let mockMutationTail: Promise<void> = Promise.resolve();
let mockSyncOrder: string[] = [];
let mockDeliveryActivated = true;

const mockLoadMutes = jest.fn(async () => ({ ...mockStoredMutes }));
const mockLoadMutesStrict = jest.fn(async () => ({ ...mockStoredMutes }));
const mockSaveMutes = jest.fn(
  async (next: Partial<Record<NotificationMuteChannel, boolean>>) => {
    mockStoredMutes = { ...next };
  },
);
const mockRunNotificationSync = jest.fn(
  async (_mutes?: Partial<Record<NotificationMuteChannel, boolean>>): Promise<{
    feed: InAppNotification[];
    unreadCount: number;
    createdIds?: string[];
    retiredIds?: string[];
  }> => ({
    feed: [],
    unreadCount: 0,
  }),
);
const mockAdvancePastDue = jest.fn(async (_today: string) => {
  mockSyncOrder.push('advance');
  return 0;
});
const mockSyncAndroidReminderSchedules = jest.fn(async (
  _t: unknown,
  _mutes: Partial<Record<NotificationMuteChannel, boolean>>,
) => {
  mockSyncOrder.push('scheduler');
  return {
    status: 'unsupported',
    scheduledIds: [],
    canceledIds: [],
    failedScheduleIds: [],
    failedCancelIds: [],
  };
});
const mockDeliverAndroidSystemNotifications = jest.fn(async (
  _items: unknown,
  _options?: unknown,
) => ({
  status: 'unsupported',
  deliveredIds: [],
  failedIds: [],
}));
const mockDismissAndroidSystemNotifications = jest.fn(async (
  _ids: readonly string[],
) => undefined);
const mockDismissFeedItems = jest.fn(async (_ids: readonly string[]) => ({
  removedIds: [] as string[],
  removedCount: 0,
  feed: [],
  unreadCount: 0,
}));
const mockLoadFeedStrict = jest.fn(async () => [...mockStoredFeed]);
const mockSaveFeed = jest.fn(async (next: InAppNotification[]) => {
  mockStoredFeed = [...next];
});

jest.mock('../RefreshContext', () => ({
  useRefresh: () => ({ refreshKey: 0 }),
}));

jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (key === 'month_05') return 'Mayıs';
      return params?.month ? `${key}:${params.month}` : key;
    },
  }),
}));

jest.mock('../../services/androidNotificationsSetup', () => ({
  isAndroidNotificationDeliveryActivated: () => mockDeliveryActivated,
  deliverAndroidSystemNotifications: (items: unknown, options?: unknown) =>
    mockDeliverAndroidSystemNotifications(items, options),
  dismissAndroidSystemNotifications: (ids: readonly string[]) =>
    mockDismissAndroidSystemNotifications(ids),
}));

jest.mock('../../services/reminderScheduler', () => ({
  syncAndroidReminderSchedules: (
    t: unknown,
    mutes: Partial<Record<NotificationMuteChannel, boolean>>,
  ) => mockSyncAndroidReminderSchedules(t, mutes),
}));

jest.mock('../../db/recurringPaymentReminderDao', () => ({
  RecurringPaymentReminderDao: {
    advancePastDue: (today: string) => mockAdvancePastDue(today),
  },
}));

jest.mock('../../utils/dateUtils', () => ({
  getToday: () => '2026-08-11',
  formatMonthYear: (_date: string, t?: (key: string) => string) =>
    `${t?.('month_05') ?? 'Mayıs'} 2026`,
  formatDateFull: (date: string) => date,
}));

jest.mock('../../notifications/buildNotifications', () => ({
  runNotificationSync: (
    mutes: Partial<Record<NotificationMuteChannel, boolean>>,
  ) => {
    mockSyncOrder.push('feed');
    return mockRunNotificationSync(mutes);
  },
}));

jest.mock('../../notifications/storage', () => ({
  enqueueNotificationMutation: <T,>(task: () => Promise<T>): Promise<T> => {
    const result = mockMutationTail.then(task, task);
    mockMutationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  },
  loadMutes: () => mockLoadMutes(),
  loadMutesStrict: () => mockLoadMutesStrict(),
  saveMutes: (next: Partial<Record<NotificationMuteChannel, boolean>>) =>
    mockSaveMutes(next),
  loadFeedStrict: () => mockLoadFeedStrict(),
  saveFeed: (next: InAppNotification[]) => mockSaveFeed(next),
  dismissFeedItems: (ids: readonly string[]) => mockDismissFeedItems(ids),
}));

let latestContext: ReturnType<typeof useNotifications> | null = null;

function ContextProbe() {
  latestContext = useNotifications();
  return null;
}

describe('NotificationsProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStoredMutes = {};
    mockStoredFeed = [];
    mockMutationTail = Promise.resolve();
    mockSyncOrder = [];
    mockDeliveryActivated = true;
    latestContext = null;
  });

  it('preserves both mute changes when switches are updated concurrently', async () => {
    const view = await render(
      <NotificationsProvider>
        <ContextProbe />
      </NotificationsProvider>,
    );

    await waitFor(() => expect(latestContext).not.toBeNull());

    await act(async () => {
      await Promise.all([
        latestContext!.setMute('budget', true),
        latestContext!.setMute('receipt', true),
      ]);
    });

    expect(mockStoredMutes).toMatchObject({
      budget: true,
      receipt: true,
    });
    expect(latestContext!.mutes).toMatchObject({
      budget: true,
      receipt: true,
    });
    expect(mockSaveMutes).toHaveBeenCalledTimes(2);

    await view.unmount();
  });

  it('bridges newly created feed records to translated Android system notifications', async () => {
    mockRunNotificationSync.mockResolvedValueOnce({
      feed: [
        {
          id: 'receipt-saved-7',
          severity: 'info',
          titleKey: 'notif_receipt_saved_t',
          bodyKey: 'notif_receipt_saved_b',
          params: { month: '2026-05' },
          createdAt: 1_800_000_000_000,
          read: false,
        },
      ],
      unreadCount: 1,
      createdIds: ['receipt-saved-7'],
    });

    const view = await render(
      <NotificationsProvider>
        <ContextProbe />
      </NotificationsProvider>,
    );
    await waitFor(() => expect(latestContext).not.toBeNull());

    await act(async () => {
      await latestContext!.sync();
    });

    expect(mockDeliverAndroidSystemNotifications).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: 'receipt-saved-7',
          title: 'notif_receipt_saved_t:Mayıs 2026',
          body: 'notif_receipt_saved_b:Mayıs 2026',
          severity: 'info',
          read: false,
        }),
      ],
      { newlyCreatedIds: ['receipt-saved-7'], suppressedIds: [] },
    );

    await view.unmount();
  });

  it('keeps muted history in-app but excludes it from native retry delivery', async () => {
    const debtId = 'debt-due-v1-7-2026-08-14-3-0900-upcoming';
    mockStoredMutes = { debt: true };
    mockRunNotificationSync.mockResolvedValueOnce({
      feed: [
        {
          id: debtId,
          severity: 'warning',
          titleKey: 'notif_debt_due_upcoming_t',
          bodyKey: 'notif_debt_due_upcoming_b',
          createdAt: 1_800_000_000_000,
          read: false,
        },
        {
          id: 'receipt-saved-8',
          severity: 'info',
          titleKey: 'notif_receipt_saved_t',
          bodyKey: 'notif_receipt_saved_b',
          createdAt: 1_800_000_000_001,
          read: false,
        },
      ],
      unreadCount: 2,
      createdIds: [debtId, 'receipt-saved-8'],
    });

    const view = await render(
      <NotificationsProvider>
        <ContextProbe />
      </NotificationsProvider>,
    );
    await waitFor(() => expect(latestContext).not.toBeNull());
    await act(async () => {
      await latestContext!.sync();
    });

    expect(latestContext!.feed.map((item) => item.id)).toContain(debtId);
    expect(mockDeliverAndroidSystemNotifications).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 'receipt-saved-8' })],
      { newlyCreatedIds: ['receipt-saved-8'], suppressedIds: [debtId] },
    );
    await view.unmount();
  });

  it('cleans retired reminder copies from the Android tray before delivery', async () => {
    mockRunNotificationSync.mockResolvedValueOnce({
      feed: [],
      unreadCount: 0,
      createdIds: [],
      retiredIds: ['debt-due-v1-7-old'],
    });

    const view = await render(
      <NotificationsProvider>
        <ContextProbe />
      </NotificationsProvider>,
    );
    await waitFor(() => expect(latestContext).not.toBeNull());

    await act(async () => {
      await latestContext!.sync();
    });

    expect(mockDismissAndroidSystemNotifications).toHaveBeenCalledWith([
      'debt-due-v1-7-old',
    ]);
    expect(
      mockDismissAndroidSystemNotifications.mock.invocationCallOrder[0],
    ).toBeLessThan(mockDeliverAndroidSystemNotifications.mock.invocationCallOrder[0]);
    await view.unmount();
  });

  it('keeps raw scan diagnostics out of the Android system notification body', async () => {
    mockRunNotificationSync.mockResolvedValueOnce({
      feed: [
        {
          id: 'sys-scan-err',
          severity: 'warning',
          titleKey: 'notif_scan_err_t',
          bodyKey: 'notif_scan_err_b',
          params: { msg: 'sensitive transport diagnostic' },
          createdAt: 1_800_000_000_000,
          read: false,
        },
      ],
      unreadCount: 1,
      createdIds: ['sys-scan-err'],
    });

    const view = await render(
      <NotificationsProvider>
        <ContextProbe />
      </NotificationsProvider>,
    );
    await waitFor(() => expect(latestContext).not.toBeNull());
    await act(async () => {
      await latestContext!.sync();
    });

    expect(mockDeliverAndroidSystemNotifications).toHaveBeenCalledWith(
      [expect.objectContaining({ body: 'notif_scan_err_native_b' })],
      { newlyCreatedIds: ['sys-scan-err'], suppressedIds: [] },
    );
    expect(JSON.stringify(mockDeliverAndroidSystemNotifications.mock.calls)).not.toContain(
      'sensitive transport diagnostic',
    );
    await view.unmount();
  });

  it('removes the Android tray copy after an in-app notification is dismissed', async () => {
    mockDismissFeedItems.mockResolvedValueOnce({
      removedIds: ['one'],
      removedCount: 1,
      feed: [],
      unreadCount: 0,
    });

    const view = await render(
      <NotificationsProvider>
        <ContextProbe />
      </NotificationsProvider>,
    );
    await waitFor(() => expect(latestContext).not.toBeNull());

    await act(async () => {
      await latestContext!.dismiss('one');
    });

    expect(mockDismissAndroidSystemNotifications).toHaveBeenCalledWith(['one']);
    await view.unmount();
  });

  it('keeps a successful feed deletion successful when native tray cleanup fails', async () => {
    mockDismissFeedItems.mockResolvedValueOnce({
      removedIds: ['one'],
      removedCount: 1,
      feed: [],
      unreadCount: 0,
    });
    mockDismissAndroidSystemNotifications.mockRejectedValueOnce(new Error('native unavailable'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const view = await render(
      <NotificationsProvider>
        <ContextProbe />
      </NotificationsProvider>,
    );
    await waitFor(() => expect(latestContext).not.toBeNull());

    let result: Awaited<ReturnType<NonNullable<typeof latestContext>['dismiss']>> | undefined;
    await act(async () => {
      result = await latestContext!.dismiss('one');
    });

    expect(result).toMatchObject({ removedIds: ['one'], removedCount: 1 });
    expect(mockDismissAndroidSystemNotifications).toHaveBeenCalledWith(['one']);
    warn.mockRestore();
    await view.unmount();
  });

  it('preserves the old occurrence for feed/scheduling before advancing the recurring cursor', async () => {
    mockStoredMutes = { payment_plan: true };
    mockRunNotificationSync.mockResolvedValueOnce({
      feed: [],
      unreadCount: 0,
      createdIds: [],
      retiredIds: [],
    });

    const view = await render(
      <NotificationsProvider>
        <ContextProbe />
      </NotificationsProvider>,
    );
    await waitFor(() => expect(latestContext).not.toBeNull());

    await act(async () => {
      await latestContext!.sync();
    });

    expect(mockAdvancePastDue).toHaveBeenCalledWith('2026-08-11');
    expect(mockSyncOrder.slice(0, 3)).toEqual(['feed', 'scheduler', 'advance']);
    expect(mockSyncAndroidReminderSchedules).toHaveBeenCalledWith(
      expect.any(Function),
      { payment_plan: true },
    );
    expect(
      mockSyncAndroidReminderSchedules.mock.invocationCallOrder[0],
    ).toBeLessThan(mockDeliverAndroidSystemNotifications.mock.invocationCallOrder[0]);

    await view.unmount();
  });

  it('does not advance the recurring cursor before native delivery is activated', async () => {
    mockSyncAndroidReminderSchedules.mockImplementationOnce(async () => {
      mockSyncOrder.push('scheduler');
      return {
        status: 'not_ready',
        scheduledIds: [],
        canceledIds: [],
        failedScheduleIds: [],
        failedCancelIds: [],
      };
    });

    const view = await render(
      <NotificationsProvider>
        <ContextProbe />
      </NotificationsProvider>,
    );
    await waitFor(() => expect(latestContext).not.toBeNull());

    await act(async () => {
      await latestContext!.sync();
    });

    expect(mockSyncOrder).toEqual(['feed', 'scheduler']);
    expect(mockAdvancePastDue).not.toHaveBeenCalled();

    await view.unmount();
  });

  it('keeps a pre-reveal sync from gaining cursor authority if activation changes mid-run', async () => {
    let releaseFeed: ((value: {
      feed: InAppNotification[];
      unreadCount: number;
      createdIds: string[];
      retiredIds: string[];
    }) => void) | undefined;
    mockDeliveryActivated = false;
    mockRunNotificationSync.mockReturnValueOnce(new Promise((resolve) => {
      releaseFeed = resolve;
    }));

    const view = await render(
      <NotificationsProvider>
        <ContextProbe />
      </NotificationsProvider>,
    );
    await waitFor(() => expect(latestContext).not.toBeNull());

    let firstPending: Promise<void> | undefined;
    let secondPending: Promise<void> | undefined;
    await act(async () => {
      firstPending = latestContext!.sync();
      secondPending = latestContext!.sync();
      await Promise.resolve();
    });
    mockDeliveryActivated = true;
    releaseFeed?.({ feed: [], unreadCount: 0, createdIds: [], retiredIds: [] });
    await act(async () => {
      await Promise.all([firstPending, secondPending]);
    });

    expect(mockSyncAndroidReminderSchedules).toHaveBeenCalledTimes(2);
    expect(mockAdvancePastDue).not.toHaveBeenCalled();

    await act(async () => {
      await latestContext!.openFromNotification(
        'debt-due-v1-13-2027-01-01-0-0900-today',
      );
    });
    expect(mockAdvancePastDue).toHaveBeenCalledTimes(1);

    await view.unmount();
  });

  it('opens a delayed previous-stage reminder without a duplicate tray delivery', async () => {
    const uid = '123e4567-e89b-42d3-a456-426614174000';
    const tappedId = `payplan-due-v1-${uid}-2026-08-10-3-0900-today`;
    const currentId = `payplan-due-v1-${uid}-2026-08-10-3-0900-overdue`;
    const currentFeed: InAppNotification[] = [{
      id: currentId,
      severity: 'warning',
      titleKey: 'notif_payment_plan_date_passed_t',
      bodyKey: 'notif_payment_plan_date_passed_b',
      createdAt: 1_800_000_000_000,
      read: false,
    }];
    mockStoredFeed = [...currentFeed];
    mockRunNotificationSync.mockResolvedValueOnce({
      feed: currentFeed,
      unreadCount: 1,
      createdIds: [currentId],
      retiredIds: [],
    });

    const view = await render(
      <NotificationsProvider>
        <ContextProbe />
      </NotificationsProvider>,
    );
    await waitFor(() => expect(latestContext).not.toBeNull());

    await act(async () => {
      await latestContext!.openFromNotification(tappedId);
    });

    expect(mockDeliverAndroidSystemNotifications).not.toHaveBeenCalled();
    expect(mockSyncOrder.slice(0, 3)).toEqual(['feed', 'scheduler', 'advance']);
    expect(mockStoredFeed).toEqual([
      expect.objectContaining({ id: currentId, read: true }),
    ]);
    expect(latestContext!.feed).toEqual([
      expect.objectContaining({ id: currentId, read: true }),
    ]);

    await view.unmount();
  });

  it('keeps the committed in-app feed when future scheduler reconciliation fails', async () => {
    const nextFeed: InAppNotification[] = [{
      id: 'receipt-saved-9',
      severity: 'info',
      titleKey: 'notif_receipt_saved_t',
      bodyKey: 'notif_receipt_saved_b',
      createdAt: 1_800_000_000_000,
      read: false,
    }];
    mockRunNotificationSync.mockResolvedValueOnce({
      feed: nextFeed,
      unreadCount: 1,
      createdIds: ['receipt-saved-9'],
      retiredIds: [],
    });
    mockSyncAndroidReminderSchedules.mockRejectedValueOnce(
      new Error('native scheduler unavailable'),
    );
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const view = await render(
      <NotificationsProvider>
        <ContextProbe />
      </NotificationsProvider>,
    );
    await waitFor(() => expect(latestContext).not.toBeNull());

    await act(async () => {
      await latestContext!.sync();
    });

    expect(latestContext!.feed).toEqual(nextFeed);
    expect(latestContext!.unreadCount).toBe(1);
    expect(mockDeliverAndroidSystemNotifications).toHaveBeenCalledTimes(1);
    expect(mockSyncAndroidReminderSchedules).toHaveBeenCalledTimes(1);
    expect(mockAdvancePastDue).not.toHaveBeenCalled();

    warn.mockRestore();
    await view.unmount();
  });

  it('serializes a normal refresh and notification tap across feed, native, and cursor work', async () => {
    let releaseScheduler: (() => void) | undefined;
    mockSyncAndroidReminderSchedules.mockImplementationOnce(async () => {
      mockSyncOrder.push('scheduler');
      await new Promise<void>((resolve) => {
        releaseScheduler = resolve;
      });
      return {
        status: 'unsupported',
        scheduledIds: [],
        canceledIds: [],
        failedScheduleIds: [],
        failedCancelIds: [],
      };
    });

    const view = await render(
      <NotificationsProvider>
        <ContextProbe />
      </NotificationsProvider>,
    );
    await waitFor(() => expect(latestContext).not.toBeNull());

    let refresh: Promise<void> | undefined;
    let tap: Promise<void> | undefined;
    await act(async () => {
      refresh = latestContext!.sync();
      tap = latestContext!.openFromNotification(
        'debt-due-v1-12-2027-01-01-0-0900-today',
      );
      await Promise.resolve();
    });
    await waitFor(() => expect(mockSyncAndroidReminderSchedules).toHaveBeenCalledTimes(1));
    expect(mockRunNotificationSync).toHaveBeenCalledTimes(1);

    releaseScheduler?.();
    await act(async () => {
      await Promise.all([refresh, tap]);
    });

    expect(mockSyncOrder).toEqual([
      'feed', 'scheduler', 'advance',
      'feed', 'scheduler', 'advance',
    ]);
    expect(mockRunNotificationSync).toHaveBeenCalledTimes(2);
    expect(mockAdvancePastDue).toHaveBeenCalledTimes(2);

    await view.unmount();
  });
});
