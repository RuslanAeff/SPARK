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
let mockMutationTail: Promise<void> = Promise.resolve();

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
  }> => ({
    feed: [],
    unreadCount: 0,
  }),
);
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
  deliverAndroidSystemNotifications: (items: unknown, options?: unknown) =>
    mockDeliverAndroidSystemNotifications(items, options),
  dismissAndroidSystemNotifications: (ids: readonly string[]) =>
    mockDismissAndroidSystemNotifications(ids),
}));

jest.mock('../../notifications/buildNotifications', () => ({
  runNotificationSync: (
    mutes: Partial<Record<NotificationMuteChannel, boolean>>,
  ) => mockRunNotificationSync(mutes),
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
  loadFeedStrict: jest.fn(async () => []),
  saveFeed: jest.fn(async () => undefined),
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
    mockMutationTail = Promise.resolve();
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
      { newlyCreatedIds: ['receipt-saved-7'] },
    );

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
      { newlyCreatedIds: ['sys-scan-err'] },
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
});
