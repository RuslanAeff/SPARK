import type { AndroidDeliveryState } from '../../notifications/storage';
import type { InAppNotification } from '../../notifications/types';
import { notificationPresentationRevision } from '../../notifications/presentation';

let mockPlatformOs = 'android';
let mockPlatformVersion: number | string = 33;
let mockExpoGo = false;
let mockDeliveryState: AndroidDeliveryState | null = null;
let mockLastResponse: any = null;
let mockResponseListener: ((response: any) => void) | null = null;
let mockMutationTail: Promise<void> = Promise.resolve();
let mockCanonicalFeed: InAppNotification[] = [];

const mockSetHandler = jest.fn();
const mockSetChannel = jest.fn(async (_id: string, _config: unknown) => null);
const mockGetPermissions = jest.fn(async () => ({
  status: 'granted',
  canAskAgain: true,
}));
const mockRequestPermissions = jest.fn(async () => ({
  status: 'granted',
  canAskAgain: true,
}));
const mockSchedule = jest.fn(async (request: { identifier?: string }) => request.identifier ?? 'native');
const mockDismiss = jest.fn(async (_identifier: string) => undefined);
const mockClearLastResponse = jest.fn(async () => undefined);
const mockGetLastResponse = jest.fn(async () => mockLastResponse);
const mockRemoveResponseListener = jest.fn();
const mockLoadDeliveryState = jest.fn(async () => mockDeliveryState);
const mockSaveDeliveryState = jest.fn(async (state: AndroidDeliveryState) => {
  mockDeliveryState = JSON.parse(JSON.stringify(state));
});

jest.mock('react-native', () => {
  return {
    Platform: {
      get OS() {
        return mockPlatformOs;
      },
      get Version() {
        return mockPlatformVersion;
      },
    },
  };
});

jest.mock('expo', () => ({
  isRunningInExpoGo: () => mockExpoGo,
}));

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 5, HIGH: 6 },
  AndroidNotificationVisibility: { PRIVATE: 2 },
  AndroidNotificationPriority: { DEFAULT: 'default', HIGH: 'high' },
  setNotificationHandler: (handler: unknown) => mockSetHandler(handler),
  setNotificationChannelAsync: (id: string, config: unknown) => mockSetChannel(id, config),
  getPermissionsAsync: () => mockGetPermissions(),
  requestPermissionsAsync: () => mockRequestPermissions(),
  scheduleNotificationAsync: (request: unknown) => mockSchedule(request as never),
  dismissNotificationAsync: (identifier: string) => mockDismiss(identifier),
  addNotificationResponseReceivedListener: (listener: (response: any) => void) => {
    mockResponseListener = listener;
    return { remove: mockRemoveResponseListener };
  },
  getLastNotificationResponseAsync: () => mockGetLastResponse(),
  clearLastNotificationResponseAsync: () => mockClearLastResponse(),
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
  loadAndroidDeliveryStateStrict: () => mockLoadDeliveryState(),
  loadFeedStrict: async () => mockCanonicalFeed,
  saveAndroidDeliveryState: (state: AndroidDeliveryState) => mockSaveDeliveryState(state),
}));

import {
  ANDROID_ALERTS_CHANNEL_ID,
  ANDROID_UPDATES_CHANNEL_ID,
  activateAndroidNotificationDelivery,
  deliverAndroidSystemNotifications,
  dismissAndroidSystemNotifications,
  ensureAndroidNotificationSetup,
  subscribeAndroidNotificationResponses,
  __setAndroidNotificationsModuleForTests,
  type AndroidSystemNotificationItem,
} from '../androidNotificationsSetup';

const mockedNotificationsModule = jest.requireMock('expo-notifications');

function item(
  id: string,
  createdAt: number,
  overrides: Partial<AndroidSystemNotificationItem> = {},
): AndroidSystemNotificationItem {
  const value: AndroidSystemNotificationItem = {
    id,
    title: `Title ${id}`,
    body: `Body ${id}`,
    severity: 'info',
    createdAt,
    read: false,
    revision: '',
    ...overrides,
  };
  const canonical: InAppNotification = {
    id: value.id,
    severity: value.severity,
    titleKey: `title.${value.id}`,
    bodyKey: `body.${value.id}`,
    createdAt: value.createdAt,
    read: value.read,
  };
  if (!overrides.revision) {
    value.revision = notificationPresentationRevision(canonical);
  }
  mockCanonicalFeed = [
    ...mockCanonicalFeed.filter((entry) => entry.id !== value.id),
    canonical,
  ];
  return value;
}

describe('Android system notification bridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatformOs = 'android';
    mockPlatformVersion = 33;
    mockExpoGo = false;
    mockDeliveryState = null;
    mockLastResponse = null;
    mockResponseListener = null;
    mockMutationTail = Promise.resolve();
    mockCanonicalFeed = [];
    __setAndroidNotificationsModuleForTests(mockedNotificationsModule);
    activateAndroidNotificationDelivery();
    mockGetPermissions.mockResolvedValue({ status: 'granted', canAskAgain: true });
    mockRequestPermissions.mockResolvedValue({ status: 'granted', canAskAgain: true });
    mockSchedule.mockImplementation(async (request: { identifier?: string }) =>
      request.identifier ?? 'native',
    );
  });

  it('keeps the Expo Go guard and does not import/use native setup APIs', async () => {
    mockExpoGo = true;

    await expect(ensureAndroidNotificationSetup()).resolves.toBe('expo_go');

    expect(mockSetHandler).not.toHaveBeenCalled();
    expect(mockSetChannel).not.toHaveBeenCalled();
    expect(mockGetPermissions).not.toHaveBeenCalled();
  });

  it('creates both channels before requesting Android 13 permission', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'undetermined', canAskAgain: true });

    await expect(ensureAndroidNotificationSetup()).resolves.toBe('ready');

    expect(mockSetHandler).toHaveBeenCalledTimes(1);
    expect(mockSetChannel.mock.calls.map(([id]) => id)).toEqual([
      ANDROID_UPDATES_CHANNEL_ID,
      ANDROID_ALERTS_CHANNEL_ID,
    ]);
    expect(mockSetChannel.mock.invocationCallOrder[1]).toBeLessThan(
      mockRequestPermissions.mock.invocationCallOrder[0],
    );
    expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
  });

  it('uses the localized Android channel names supplied by the app language', async () => {
    await ensureAndroidNotificationSetup(true, {
      updatesName: 'Güncellemeler',
      updatesDescription: 'Fişler ve özetler',
      alertsName: 'Uyarılar',
      alertsDescription: 'Bütçe ve hedefler',
    });

    expect(mockSetChannel).toHaveBeenNthCalledWith(
      1,
      ANDROID_UPDATES_CHANNEL_ID,
      expect.objectContaining({ name: 'Güncellemeler', description: 'Fişler ve özetler' }),
    );
    expect(mockSetChannel).toHaveBeenNthCalledWith(
      2,
      ANDROID_ALERTS_CHANNEL_ID,
      expect.objectContaining({ name: 'Uyarılar', description: 'Bütçe ve hedefler' }),
    );
  });

  it('does not loop the permission prompt after a permanent denial', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'denied', canAskAgain: false });

    await expect(ensureAndroidNotificationSetup()).resolves.toBe('denied');
    expect(mockRequestPermissions).not.toHaveBeenCalled();
  });

  it('does not repeatedly prompt after a denied permission that can still be changed in OS settings', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'denied', canAskAgain: true });

    await expect(ensureAndroidNotificationSetup()).resolves.toBe('denied');
    await expect(ensureAndroidNotificationSetup()).resolves.toBe('denied');

    expect(mockRequestPermissions).not.toHaveBeenCalled();
  });

  it('does nothing before the startup reveal activates native delivery', async () => {
    __setAndroidNotificationsModuleForTests(mockedNotificationsModule);

    const result = await deliverAndroidSystemNotifications([
      item('hidden-during-boot', Date.now()),
    ]);

    expect(result.status).toBe('not_ready');
    expect(mockSetChannel).not.toHaveBeenCalled();
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('baselines old feed items and delivers a fresh item exactly once', async () => {
    const now = 1_800_000_000_000;
    const feed = [
      item('old', now - 86_400_000),
      item('fresh', now - 1_000),
    ];

    const first = await deliverAndroidSystemNotifications(feed, { now });
    const second = await deliverAndroidSystemNotifications(feed, { now: now + 2_000 });

    expect(first.deliveredIds).toEqual(['fresh']);
    expect(second.deliveredIds).toEqual([]);
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    expect(mockDeliveryState?.records.old).toEqual({ handledAt: now });
    expect(mockDeliveryState?.records.fresh.nativeIdentifier).toBe('spark:fresh');
    expect(mockSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'spark:fresh',
        trigger: { channelId: ANDROID_UPDATES_CHANNEL_ID },
        content: expect.objectContaining({
          data: expect.objectContaining({ sparkNotificationId: 'fresh' }),
          sound: false,
        }),
      }),
    );
  });

  it('serializes concurrent syncs so the same feed item is scheduled only once', async () => {
    const now = 1_800_000_000_000;
    const feed = [item('concurrent', now)];

    const [first, second] = await Promise.all([
      deliverAndroidSystemNotifications(feed, { now }),
      deliverAndroidSystemNotifications(feed, { now }),
    ]);

    expect([...first.deliveredIds, ...second.deliveredIds]).toEqual(['concurrent']);
    expect(mockSchedule).toHaveBeenCalledTimes(1);
  });

  it('does not resurrect a feed item deleted while native setup was pending', async () => {
    const now = 1_800_000_000_000;
    const stale = item('deleted-before-schedule', now);
    mockCanonicalFeed = [];

    const result = await deliverAndroidSystemNotifications([stale], { now });

    expect(result.deliveredIds).toEqual([]);
    expect(mockSchedule).not.toHaveBeenCalled();
    expect(mockDeliveryState?.records['deleted-before-schedule']).toEqual({ handledAt: now });
  });

  it('does not schedule a snapshot item that became read while setup was pending', async () => {
    const now = 1_800_000_000_000;
    const stale = item('read-before-schedule', now);
    mockCanonicalFeed = [{ ...mockCanonicalFeed[0], read: true }];

    const result = await deliverAndroidSystemNotifications([stale], { now });

    expect(result.deliveredIds).toEqual([]);
    expect(mockSchedule).not.toHaveBeenCalled();
    expect(mockDeliveryState?.records['read-before-schedule']).toEqual({ handledAt: now });
  });

  it('skips an outdated same-id text revision and later delivers the corrected one', async () => {
    const now = 1_800_000_000_000;
    const stale = item('receipt-saved-42', now);
    const correctedCanonical: InAppNotification = {
      ...mockCanonicalFeed[0],
      params: { vendor: 'Corrected Market' },
    };
    mockCanonicalFeed = [correctedCanonical];

    const first = await deliverAndroidSystemNotifications([stale], { now });
    const corrected = {
      ...stale,
      title: 'Corrected Market',
      revision: notificationPresentationRevision(correctedCanonical),
    };
    const second = await deliverAndroidSystemNotifications([corrected], { now: now + 1 });

    expect(first.deliveredIds).toEqual([]);
    expect(second.deliveredIds).toEqual(['receipt-saved-42']);
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    expect(mockSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.objectContaining({ title: 'Corrected Market' }) }),
    );
  });

  it('delivers an explicitly new warning through the alert channel', async () => {
    const now = 1_800_000_000_000;
    const warning = item('budget-warning', now - 86_400_000, { severity: 'warning' });

    const result = await deliverAndroidSystemNotifications([warning], {
      now,
      newlyCreatedIds: ['budget-warning'],
    });

    expect(result.deliveredIds).toEqual(['budget-warning']);
    expect(mockSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: { channelId: ANDROID_ALERTS_CHANNEL_ID },
        content: expect.objectContaining({ sound: 'default', priority: 'high' }),
      }),
    );
  });

  it('records partial success and retries only the failed item', async () => {
    const now = 1_800_000_000_000;
    const feed = [item('one', now), item('two', now)];
    mockSchedule.mockImplementationOnce(async () => {
      throw new Error('native failure');
    });

    const first = await deliverAndroidSystemNotifications(feed, { now });
    const second = await deliverAndroidSystemNotifications(feed, { now: now + 1_000 });

    expect(first.failedIds).toEqual(['one']);
    expect(first.deliveredIds).toEqual(['two']);
    expect(second.deliveredIds).toEqual(['one']);
    expect(mockSchedule).toHaveBeenCalledTimes(3);
  });

  it('dismisses the native side effect and retries when ledger persistence fails', async () => {
    const now = 1_800_000_000_000;
    const feed = [item('ledger-retry', now)];
    mockDeliveryState = { version: 1, initializedAt: now - 1_000, records: {} };
    mockSaveDeliveryState.mockRejectedValueOnce(new Error('sqlite write failed'));

    const first = await deliverAndroidSystemNotifications(feed, { now });
    const second = await deliverAndroidSystemNotifications(feed, { now: now + 1_000 });

    expect(first.failedIds).toEqual(['ledger-retry']);
    expect(mockDismiss).toHaveBeenCalledWith('spark:ledger-retry');
    expect(second.deliveredIds).toEqual(['ledger-retry']);
    expect(mockSchedule).toHaveBeenCalledTimes(2);
  });

  it('removes the matching native tray item when its feed record is dismissed', async () => {
    mockDeliveryState = {
      version: 1,
      initializedAt: 1,
      records: {
        one: { handledAt: 2, nativeIdentifier: 'spark:one' },
        baseline: { handledAt: 2 },
      },
    };

    await dismissAndroidSystemNotifications(['one', 'baseline', 'missing']);

    expect(mockDismiss).toHaveBeenCalledTimes(1);
    expect(mockDismiss).toHaveBeenCalledWith('spark:one');
  });

  it('handles the cold-start response once and subscribes to warm taps', async () => {
    const onOpen = jest.fn(async () => undefined);
    mockLastResponse = {
      notification: {
        request: {
          identifier: 'spark:cold',
          content: { data: { sparkNotificationId: 'cold' } },
        },
      },
      actionIdentifier: 'default',
    };

    const unsubscribe = await subscribeAndroidNotificationResponses(onOpen);
    mockResponseListener?.({
      notification: {
        request: {
          identifier: 'spark:warm',
          content: { data: { sparkNotificationId: 'warm' } },
        },
      },
      actionIdentifier: 'default',
    });
    await Promise.resolve();

    expect(onOpen).toHaveBeenCalledWith('cold');
    expect(onOpen).toHaveBeenCalledWith('warm');
    expect(mockClearLastResponse).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(mockRemoveResponseListener).toHaveBeenCalledTimes(1);
  });

  it('contains a synchronous tap callback failure and allows the same response to retry', async () => {
    const response = {
      notification: {
        request: {
          identifier: 'spark:retry',
          content: { data: { sparkNotificationId: 'retry' } },
        },
      },
      actionIdentifier: 'default',
    };
    mockLastResponse = response;
    const onOpen = jest
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('router not ready');
      })
      .mockResolvedValue(undefined);

    const unsubscribe = await subscribeAndroidNotificationResponses(onOpen);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(mockClearLastResponse).not.toHaveBeenCalled();

    mockResponseListener?.(response);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(onOpen).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});
