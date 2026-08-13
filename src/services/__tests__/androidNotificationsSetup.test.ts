import type {
  AndroidDeliveryState,
  AndroidReminderDeliveryBaseline,
  AndroidReminderScheduleState,
} from '../../notifications/storage';
import type { InAppNotification } from '../../notifications/types';
import {
  notificationContentRevision,
  notificationPresentationRevision,
} from '../../notifications/presentation';

let mockPlatformOs = 'android';
let mockPlatformVersion: number | string = 33;
let mockExpoGo = false;
let mockDeliveryState: AndroidDeliveryState | null = null;
let mockReminderScheduleState: AndroidReminderScheduleState | null = null;
let mockScheduledRequests: any[] = [];
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
const mockGetAllScheduled = jest.fn(async () => [...mockScheduledRequests]);
const mockCancelScheduled = jest.fn(async (identifier: string) => {
  mockScheduledRequests = mockScheduledRequests.filter(
    (request) => request.identifier !== identifier,
  );
});
const mockDismiss = jest.fn(async (_identifier: string) => undefined);
const mockClearLastResponse = jest.fn(async () => undefined);
const mockGetLastResponse = jest.fn(async () => mockLastResponse);
const mockRemoveResponseListener = jest.fn();
const mockLoadDeliveryState = jest.fn(async () => mockDeliveryState);
const mockSaveDeliveryState = jest.fn(async (state: AndroidDeliveryState) => {
  mockDeliveryState = JSON.parse(JSON.stringify(state));
});
const mockLoadReminderScheduleState = jest.fn(async () => mockReminderScheduleState);
const mockSaveReminderScheduleSnapshot = jest.fn(async (
  state: AndroidReminderScheduleState,
  baselines: readonly AndroidReminderDeliveryBaseline[],
) => {
  mockReminderScheduleState = JSON.parse(JSON.stringify(state));
  mockDeliveryState ??= {
    version: 1,
    initializedAt: state.updatedAt,
    records: {},
  };
  const retainedFutureNativeIds = new Set(
    Object.values(state.records).map((record) => record.nativeIdentifier),
  );
  for (const [notificationId, record] of Object.entries(mockDeliveryState.records)) {
    if (
      record.nativeIdentifier?.startsWith('spark:future:v1:')
      && !retainedFutureNativeIds.has(record.nativeIdentifier)
    ) {
      delete mockDeliveryState.records[notificationId];
    }
  }
  for (const baseline of baselines) {
    mockDeliveryState.records[baseline.notificationId] = {
      handledAt: baseline.handledAt,
      nativeIdentifier: baseline.nativeIdentifier,
    };
  }
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
  SchedulableTriggerInputTypes: { DATE: 'date' },
  setNotificationHandler: (handler: unknown) => mockSetHandler(handler),
  setNotificationChannelAsync: (id: string, config: unknown) => mockSetChannel(id, config),
  getPermissionsAsync: () => mockGetPermissions(),
  requestPermissionsAsync: () => mockRequestPermissions(),
  scheduleNotificationAsync: (request: unknown) => mockSchedule(request as never),
  getAllScheduledNotificationsAsync: () => mockGetAllScheduled(),
  cancelScheduledNotificationAsync: (identifier: string) => mockCancelScheduled(identifier),
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
  loadAndroidReminderScheduleStateStrict: () => mockLoadReminderScheduleState(),
  loadFeedStrict: async () => mockCanonicalFeed,
  saveAndroidDeliveryState: (state: AndroidDeliveryState) => mockSaveDeliveryState(state),
  saveAndroidReminderScheduleSnapshot: (
    state: AndroidReminderScheduleState,
    baselines: readonly AndroidReminderDeliveryBaseline[],
  ) => mockSaveReminderScheduleSnapshot(state, baselines),
}));

import {
  ANDROID_ALERTS_CHANNEL_ID,
  ANDROID_UPDATES_CHANNEL_ID,
  activateAndroidNotificationDelivery,
  deliverAndroidSystemNotifications,
  dismissAndroidSystemNotifications,
  ensureAndroidNotificationSetup,
  reconcileAndroidReminderSchedules,
  subscribeAndroidNotificationResponses,
  __setAndroidNotificationsModuleForTests,
  type AndroidSystemNotificationItem,
  type AndroidReminderScheduleItem,
} from '../androidNotificationsSetup';

const mockedNotificationsModule = jest.requireMock('expo-notifications');

async function flushAsyncCallbacks(): Promise<void> {
  for (let index = 0; index < 10; index += 1) await Promise.resolve();
}

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

function reminder(
  scheduleId: string,
  triggerAt: number,
  overrides: Partial<AndroidReminderScheduleItem> = {},
): AndroidReminderScheduleItem {
  return {
    scheduleId,
    notificationId: `debt-due-v1-${scheduleId}`,
    triggerAt,
    title: 'Upcoming payment',
    body: 'A payment is approaching.',
    severity: 'warning',
    revision: `revision-${scheduleId}`,
    feedRevision: `feed-revision-${scheduleId}`,
    ...overrides,
  };
}

function ownedFutureRequest(value: AndroidReminderScheduleItem): any {
  return {
    identifier: `spark:future:v1:${value.scheduleId}`,
    content: {
      data: {
        sparkReminderOwner: 'spark-reminder-v1',
        sparkReminderRevision: value.revision,
        sparkNotificationId: value.notificationId,
        sparkReminderTriggerAt: value.triggerAt,
      },
    },
    trigger: { type: 'date', value: value.triggerAt },
  };
}

describe('Android system notification bridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatformOs = 'android';
    mockPlatformVersion = 33;
    mockExpoGo = false;
    mockDeliveryState = null;
    mockReminderScheduleState = null;
    mockScheduledRequests = [];
    mockLastResponse = null;
    mockResponseListener = null;
    mockMutationTail = Promise.resolve();
    mockCanonicalFeed = [];
    __setAndroidNotificationsModuleForTests(mockedNotificationsModule);
    activateAndroidNotificationDelivery();
    mockGetPermissions.mockResolvedValue({ status: 'granted', canAskAgain: true });
    mockRequestPermissions.mockResolvedValue({ status: 'granted', canAskAgain: true });
    mockSchedule.mockImplementation(async (request: { identifier?: string }) =>
      {
        mockScheduledRequests.push(request);
        return request.identifier ?? 'native';
      },
    );
    mockGetAllScheduled.mockImplementation(async () => [...mockScheduledRequests]);
    mockCancelScheduled.mockImplementation(async (identifier: string) => {
      mockScheduledRequests = mockScheduledRequests.filter(
        (request) => request.identifier !== identifier,
      );
    });
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

  it('baselines an hours-old unread receipt instead of redelivering it after an unrelated sync', async () => {
    const now = 1_800_000_000_000;
    const oldReceipt = item('receipt-saved-41', now - 3 * 60 * 60 * 1000);
    mockDeliveryState = {
      version: 1,
      initializedAt: now - 24 * 60 * 60 * 1000,
      records: {},
    };

    const result = await deliverAndroidSystemNotifications([oldReceipt], { now });

    expect(result.deliveredIds).toEqual([]);
    expect(mockSchedule).not.toHaveBeenCalled();
    expect(mockDeliveryState?.records[oldReceipt.id]).toEqual({ handledAt: now });
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
    expect(mockDeliveryState?.records).toEqual({});
    expect(mockSaveDeliveryState).toHaveBeenCalledTimes(1);

    const refreshed = item('one', 10);
    const delivery = await deliverAndroidSystemNotifications([refreshed], { now: 10 });
    expect(delivery.deliveredIds).toEqual(['one']);
  });

  it('baselines muted records so unmute does not deliver an old backlog', async () => {
    const muted = item('muted-debt', 100);
    mockDeliveryState = {
      version: 1,
      initializedAt: 1,
      records: { existing: { handledAt: 2 } },
    };

    const whileMuted = await deliverAndroidSystemNotifications([], {
      now: 200,
      suppressedIds: [muted.id],
    });
    const afterUnmute = await deliverAndroidSystemNotifications([muted], { now: 300 });

    expect(whileMuted.deliveredIds).toEqual([]);
    expect(mockDeliveryState?.records[muted.id]).toEqual({ handledAt: 200 });
    expect(afterUnmute.deliveredIds).toEqual([]);
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('does not read or mutate native future schedules before delivery activation', async () => {
    __setAndroidNotificationsModuleForTests(mockedNotificationsModule);
    const now = 1_800_000_000_000;

    const result = await reconcileAndroidReminderSchedules([
      reminder('debt:7:2027-01-01:3:0900:upcoming', now + 60_000),
    ], { now });

    expect(result).toEqual(expect.objectContaining({ status: 'not_ready' }));
    expect(mockGetAllScheduled).not.toHaveBeenCalled();
    expect(mockSchedule).not.toHaveBeenCalled();
    expect(mockCancelScheduled).not.toHaveBeenCalled();
  });

  it('creates a deterministic one-shot DATE request on the alerts channel', async () => {
    const now = 1_800_000_000_000;
    const desired = reminder(
      'debt:7:2027-01-01:3:0900:upcoming',
      now + 86_400_000,
    );

    const result = await reconcileAndroidReminderSchedules([desired], { now });

    expect(result).toMatchObject({
      status: 'ready',
      scheduledIds: [desired.scheduleId],
      failedScheduleIds: [],
    });
    expect(mockSchedule).toHaveBeenCalledWith(expect.objectContaining({
      identifier: `spark:future:v1:${desired.scheduleId}`,
      trigger: {
        type: 'date',
        date: new Date(desired.triggerAt),
        channelId: ANDROID_ALERTS_CHANNEL_ID,
      },
      content: expect.objectContaining({
        sound: 'default',
        priority: 'high',
        data: expect.objectContaining({
          sparkNotificationId: desired.notificationId,
          sparkReminderOwner: 'spark-reminder-v1',
          sparkReminderRevision: desired.revision,
          sparkReminderTriggerAt: desired.triggerAt,
        }),
      }),
    }));
    expect(JSON.stringify(mockSchedule.mock.calls)).not.toContain('LandLord');
  });

  it('adopts an exactly matching OS request without scheduling it again', async () => {
    const now = 1_800_000_000_000;
    const desired = reminder('plan:stable:2027-01-01:1:0900:upcoming', now + 60_000);
    mockScheduledRequests = [
      ownedFutureRequest(desired),
      {
        identifier: 'foreign-owner-request',
        content: { data: { owner: 'another-feature' } },
      },
    ];

    const result = await reconcileAndroidReminderSchedules([desired], { now });

    expect(result.scheduledIds).toEqual([]);
    expect(result.canceledIds).toEqual([]);
    expect(mockSchedule).not.toHaveBeenCalled();
    expect(mockCancelScheduled).not.toHaveBeenCalled();
    expect(mockReminderScheduleState?.records[desired.scheduleId]).toMatchObject({
      revision: desired.revision,
      triggerAt: desired.triggerAt,
    });
  });

  it('cancels and replaces a same-id request when revision or trigger changes', async () => {
    const now = 1_800_000_000_000;
    const desired = reminder('debt:9:2027-01-01:2:0800:upcoming', now + 120_000, {
      revision: 'new-revision',
    });
    mockScheduledRequests = [ownedFutureRequest({
      ...desired,
      revision: 'old-revision',
      triggerAt: now + 60_000,
    })];

    const result = await reconcileAndroidReminderSchedules([desired], { now });
    const nativeId = `spark:future:v1:${desired.scheduleId}`;

    expect(mockCancelScheduled).toHaveBeenCalledWith(nativeId);
    expect(mockSchedule).toHaveBeenCalledWith(expect.objectContaining({
      identifier: nativeId,
      trigger: expect.objectContaining({ date: new Date(desired.triggerAt) }),
    }));
    expect(result.canceledIds).toEqual([desired.scheduleId]);
    expect(result.scheduledIds).toEqual([desired.scheduleId]);
  });

  it('leaves foreign scheduled requests untouched while canceling stale owned ones', async () => {
    const now = 1_800_000_000_000;
    const stale = reminder('debt:stale:2027-01-01:0:0900:today', now + 60_000);
    mockScheduledRequests = [
      ownedFutureRequest(stale),
      {
        identifier: 'spark:future:v1:not-owned-without-marker',
        content: { data: {} },
      },
      {
        identifier: 'spark:immediate-feed-item',
        content: { data: { sparkNotificationId: 'receipt-saved-1' } },
      },
    ];

    const result = await reconcileAndroidReminderSchedules([], { now });

    expect(result.canceledIds).toEqual([stale.scheduleId]);
    expect(mockCancelScheduled).toHaveBeenCalledTimes(1);
    expect(mockCancelScheduled).toHaveBeenCalledWith(
      `spark:future:v1:${stale.scheduleId}`,
    );
  });

  it('dismisses a fired tray request from the previous ledger after its domain becomes inactive', async () => {
    const now = 1_800_000_000_000;
    const scheduleId = 'debt:7:2027-01-01:0:0900:today';
    const nativeIdentifier = `spark:future:v1:${scheduleId}`;
    mockReminderScheduleState = {
      version: 1,
      updatedAt: now - 60_000,
      records: {
        [scheduleId]: {
          nativeIdentifier,
          notificationId: 'debt-due-v1-7-2027-01-01-0-0900-today',
          revision: 'old-revision',
          triggerAt: now - 1_000,
          scheduledAt: now - 86_400_000,
        },
      },
    };
    // Tek-seferlik DATE alarmı tetiklendiği için scheduled envanter artık boş.
    mockScheduledRequests = [];

    await reconcileAndroidReminderSchedules([], {
      now,
    });

    expect(mockCancelScheduled).not.toHaveBeenCalled();
    expect(mockDismiss).toHaveBeenCalledWith(nativeIdentifier);
    expect(mockReminderScheduleState?.records).toEqual({});
  });

  it('keeps a fired tray request while the exact feed presentation remains canonical', async () => {
    const now = 1_800_000_000_000;
    const scheduleId = 'debt:7:2027-01-01:0:0900:today';
    const nativeIdentifier = `spark:future:v1:${scheduleId}`;
    const canonical: InAppNotification = {
      id: 'debt-due-v1-7-2027-01-01-0-0900-today',
      severity: 'warning',
      titleKey: 'notif_debt_due_today_t',
      bodyKey: 'notif_debt_due_today_b',
      createdAt: now,
      read: false,
    };
    mockReminderScheduleState = {
      version: 1,
      updatedAt: now - 60_000,
      records: {
        [scheduleId]: {
          nativeIdentifier,
          notificationId: 'debt-due-v1-7-2027-01-01-0-0900-today',
          revision: 'old-revision',
          feedRevision: notificationContentRevision(canonical),
          triggerAt: now - 1_000,
          scheduledAt: now - 86_400_000,
        },
      },
    };
    mockCanonicalFeed = [canonical];

    await reconcileAndroidReminderSchedules([], { now });

    expect(mockDismiss).not.toHaveBeenCalled();
    expect(mockReminderScheduleState?.records[scheduleId]).toMatchObject({
      nativeIdentifier,
      notificationId: 'debt-due-v1-7-2027-01-01-0-0900-today',
    });
  });

  it('retries fired tray cleanup when the canonical stage changed within the same family', async () => {
    const now = 1_800_000_000_000;
    const scheduleId = 'debt:10:2027-01-01:0:0900:today';
    const nativeIdentifier = `spark:future:v1:${scheduleId}`;
    mockReminderScheduleState = {
      version: 1,
      updatedAt: now - 60_000,
      records: {
        [scheduleId]: {
          nativeIdentifier,
          notificationId: 'debt-due-v1-10-2027-01-01-0-0900-today',
          revision: 'old-native-revision',
          feedRevision: 'old-feed-revision',
          triggerAt: now - 1_000,
          scheduledAt: now - 86_400_000,
        },
      },
    };
    mockCanonicalFeed = [{
      id: 'debt-due-v1-10-2027-01-01-0-0900-overdue',
      severity: 'critical',
      titleKey: 'notif_debt_due_overdue_t',
      bodyKey: 'notif_debt_due_overdue_b',
      createdAt: now,
      read: false,
    }];
    mockDismiss.mockRejectedValueOnce(new Error('tray temporarily unavailable'));

    await reconcileAndroidReminderSchedules([], { now });
    expect(mockReminderScheduleState?.records[scheduleId]).toBeDefined();

    await reconcileAndroidReminderSchedules([], { now: now + 1_000 });
    expect(mockDismiss).toHaveBeenCalledTimes(2);
    expect(mockReminderScheduleState?.records).toEqual({});
  });

  it('dismisses a fired tray when the same notification ID has newer financial content', async () => {
    const now = 1_800_000_000_000;
    const scheduleId = 'debt:11:2027-01-01:0:0900:today';
    const notificationId = 'debt-due-v1-11-2027-01-01-0-0900-today';
    const nativeIdentifier = `spark:future:v1:${scheduleId}`;
    mockReminderScheduleState = {
      version: 1,
      updatedAt: now - 60_000,
      records: {
        [scheduleId]: {
          nativeIdentifier,
          notificationId,
          revision: 'old-native-revision',
          feedRevision: 'old-feed-revision',
          triggerAt: now - 1_000,
          scheduledAt: now - 86_400_000,
        },
      },
    };
    mockCanonicalFeed = [{
      id: notificationId,
      severity: 'warning',
      titleKey: 'notif_debt_due_today_t',
      bodyKey: 'notif_debt_due_today_b',
      params: { amount: '90.00 PLN' },
      createdAt: now,
      read: false,
    }];

    await reconcileAndroidReminderSchedules([], { now });

    expect(mockDismiss).toHaveBeenCalledWith(nativeIdentifier);
    expect(mockReminderScheduleState?.records).toEqual({});
  });

  it('dismisses a fired tray request when its canonical feed family is muted', async () => {
    const now = 1_800_000_000_000;
    const scheduleId = 'debt:7:2027-01-01:0:0900:today';
    const nativeIdentifier = `spark:future:v1:${scheduleId}`;
    mockReminderScheduleState = {
      version: 1,
      updatedAt: now - 60_000,
      records: {
        [scheduleId]: {
          nativeIdentifier,
          notificationId: 'debt-due-v1-7-2027-01-01-0-0900-today',
          revision: 'old-revision',
          triggerAt: now - 1_000,
          scheduledAt: now - 86_400_000,
        },
      },
    };
    mockCanonicalFeed = [{
      id: 'debt-due-v1-7-2027-01-01-0-0900-overdue',
      severity: 'critical',
      titleKey: 'notif_debt_due_overdue_t',
      bodyKey: 'notif_debt_due_overdue_b',
      createdAt: now,
      read: false,
    }];

    await reconcileAndroidReminderSchedules([], { now, mutes: { debt: true } });

    expect(mockDismiss).toHaveBeenCalledWith(nativeIdentifier);
    expect(mockReminderScheduleState?.records).toEqual({});
  });

  it('retains a fired cleanup handle when tray dismissal fails so the next sync can retry', async () => {
    const now = 1_800_000_000_000;
    const scheduleId = 'debt:8:2027-01-01:0:0900:today';
    const nativeIdentifier = `spark:future:v1:${scheduleId}`;
    mockReminderScheduleState = {
      version: 1,
      updatedAt: now - 60_000,
      records: {
        [scheduleId]: {
          nativeIdentifier,
          notificationId: 'debt-due-v1-8-2027-01-01-0-0900-today',
          revision: 'old-revision',
          triggerAt: now - 1_000,
          scheduledAt: now - 86_400_000,
        },
      },
    };
    mockDismiss.mockRejectedValueOnce(new Error('tray temporarily unavailable'));

    await reconcileAndroidReminderSchedules([], { now });
    expect(mockReminderScheduleState?.records[scheduleId]).toBeDefined();

    await reconcileAndroidReminderSchedules([], { now: now + 1_000 });
    expect(mockDismiss).toHaveBeenCalledTimes(2);
    expect(mockReminderScheduleState?.records).toEqual({});
  });

  it('fails closed when the OS scheduled-request inventory cannot be read', async () => {
    const now = 1_800_000_000_000;
    mockGetAllScheduled.mockRejectedValueOnce(new Error('native inventory failed'));

    const result = await reconcileAndroidReminderSchedules([
      reminder('debt:inventory:2027-01-01:0:0900:today', now + 60_000),
    ], { now });

    expect(result.status).toBe('error');
    expect(mockSchedule).not.toHaveBeenCalled();
    expect(mockCancelScheduled).not.toHaveBeenCalled();
    expect(mockSaveReminderScheduleSnapshot).not.toHaveBeenCalled();
  });

  it('cancels stale owned requests but schedules nothing while permission is denied', async () => {
    const now = 1_800_000_000_000;
    const stale = reminder('plan:denied-stale:2027-01-01:0:0900:today', now + 60_000);
    const desired = reminder('debt:denied-new:2027-01-02:0:0900:today', now + 120_000);
    mockScheduledRequests = [ownedFutureRequest(stale)];
    mockGetPermissions.mockResolvedValue({ status: 'denied', canAskAgain: false });

    const result = await reconcileAndroidReminderSchedules([desired], { now });

    expect(result.status).toBe('denied');
    expect(result.canceledIds).toEqual([stale.scheduleId]);
    expect(mockCancelScheduled).toHaveBeenCalledWith(
      `spark:future:v1:${stale.scheduleId}`,
    );
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('contains partial cancel and schedule failures without blocking independent work', async () => {
    const now = 1_800_000_000_000;
    const cancelFails = reminder('debt:cancel-fails:2027-01-01:0:0900:today', now + 60_000);
    const cancelSucceeds = reminder('debt:cancel-ok:2027-01-01:0:0900:today', now + 60_000);
    const scheduleFails = reminder('debt:schedule-fails:2027-01-02:0:0900:today', now + 120_000);
    const scheduleSucceeds = reminder('debt:schedule-ok:2027-01-02:0:0900:today', now + 180_000);
    mockScheduledRequests = [
      ownedFutureRequest(cancelFails),
      ownedFutureRequest(cancelSucceeds),
    ];
    mockCancelScheduled.mockImplementation(async (identifier: string) => {
      if (identifier.endsWith(cancelFails.scheduleId)) throw new Error('cancel failed');
      mockScheduledRequests = mockScheduledRequests.filter(
        (request) => request.identifier !== identifier,
      );
    });
    mockSchedule.mockImplementation(async (request: { identifier?: string }) => {
      if (request.identifier?.endsWith(scheduleFails.scheduleId)) {
        throw new Error('schedule failed');
      }
      mockScheduledRequests.push(request);
      return request.identifier ?? 'native';
    });

    const result = await reconcileAndroidReminderSchedules(
      [scheduleFails, scheduleSucceeds],
      { now },
    );

    expect(result.failedCancelIds).toEqual([cancelFails.scheduleId]);
    expect(result.canceledIds).toEqual([cancelSucceeds.scheduleId]);
    expect(result.failedScheduleIds).toEqual([scheduleFails.scheduleId]);
    expect(result.scheduledIds).toEqual([scheduleSucceeds.scheduleId]);
  });

  it('counts failed stale cancellations against the 512 owned-request quota', async () => {
    const now = 1_800_000_000_000;
    const stale = reminder('debt:blocked-stale:2027-01-01:0:0900:today', now + 60_000);
    mockScheduledRequests = [ownedFutureRequest(stale)];
    mockCancelScheduled.mockRejectedValueOnce(new Error('cancel failed'));
    const desired = Array.from({ length: 512 }, (_, index) => reminder(
      `debt:quota-${index + 1}:2027-01-02:0:0900:today`,
      now + 120_000 + index,
    ));

    const result = await reconcileAndroidReminderSchedules(desired, { now });

    expect(result.failedCancelIds).toEqual([stale.scheduleId]);
    expect(result.scheduledIds).toHaveLength(511);
    expect(result.failedScheduleIds).toEqual([desired[511]?.scheduleId]);
    expect(mockSchedule).toHaveBeenCalledTimes(511);
  });

  it('rolls back newly created OS requests when the atomic ledger save fails', async () => {
    const now = 1_800_000_000_000;
    const desired = reminder('debt:ledger-fails:2027-01-02:0:0900:today', now + 60_000);
    mockSaveReminderScheduleSnapshot.mockRejectedValueOnce(new Error('sqlite failed'));

    const result = await reconcileAndroidReminderSchedules([desired], { now });

    expect(result.status).toBe('error');
    expect(result.scheduledIds).toEqual([]);
    expect(result.failedScheduleIds).toEqual([desired.scheduleId]);
    expect(mockCancelScheduled).toHaveBeenCalledWith(
      `spark:future:v1:${desired.scheduleId}`,
    );
  });

  it('baselines a future reminder so the immediate feed bridge does not duplicate it', async () => {
    const now = 1_800_000_000_000;
    const desired = reminder('debt:baseline:2027-01-02:0:0900:today', now + 60_000, {
      notificationId: 'debt-due-v1-7-2027-01-02-0-0900-today',
    });

    await reconcileAndroidReminderSchedules([desired], { now });
    const feedItem = item(desired.notificationId, desired.triggerAt);
    const immediate = await deliverAndroidSystemNotifications([feedItem], {
      now: desired.triggerAt,
      newlyCreatedIds: [desired.notificationId],
    });

    expect(immediate.deliveredIds).toEqual([]);
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    expect(mockDeliveryState?.records[desired.notificationId]).toMatchObject({
      nativeIdentifier: `spark:future:v1:${desired.scheduleId}`,
    });
  });

  it('falls back to immediate delivery after an overdue pending alarm is canceled', async () => {
    const now = 1_800_000_000_000;
    const notificationId = 'debt-due-v1-19-2027-01-01-0-0900-today';
    const expired = reminder('debt:19:2027-01-01:0:0900:today', now - 60_000, {
      notificationId,
    });
    const nativeIdentifier = `spark:future:v1:${expired.scheduleId}`;
    mockScheduledRequests = [ownedFutureRequest(expired)];
    mockDeliveryState = {
      version: 1,
      initializedAt: now - 120_000,
      records: {
        [notificationId]: { handledAt: now - 120_000, nativeIdentifier },
      },
    };
    mockReminderScheduleState = {
      version: 1,
      updatedAt: now - 120_000,
      records: {
        [expired.scheduleId]: {
          nativeIdentifier,
          notificationId,
          revision: expired.revision,
          feedRevision: expired.feedRevision,
          triggerAt: expired.triggerAt,
          scheduledAt: now - 180_000,
        },
      },
    };

    await reconcileAndroidReminderSchedules([], { now });
    expect(mockDeliveryState?.records[notificationId]).toBeUndefined();

    const immediate = await deliverAndroidSystemNotifications([
      item(notificationId, now),
    ], { now, newlyCreatedIds: [notificationId] });

    expect(mockCancelScheduled).toHaveBeenCalledWith(nativeIdentifier);
    expect(immediate.deliveredIds).toEqual([notificationId]);
    expect(mockSchedule).toHaveBeenCalledTimes(1);
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
    const warmResponse = {
      notification: {
        request: {
          identifier: 'spark:warm',
          content: { data: { sparkNotificationId: 'warm' } },
        },
      },
      actionIdentifier: 'default',
    };
    mockLastResponse = warmResponse;
    mockResponseListener?.(warmResponse);
    await flushAsyncCallbacks();

    expect(onOpen).toHaveBeenCalledWith('cold');
    expect(onOpen).toHaveBeenCalledWith('warm');
    expect(mockClearLastResponse).toHaveBeenCalledTimes(2);

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
    await flushAsyncCallbacks();

    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(mockClearLastResponse).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('does not let an older warm callback clear a newer response retry slot', async () => {
    let releaseOld: (() => void) | undefined;
    const oldResponse = {
      notification: {
        request: {
          identifier: 'spark:old-warm',
          content: { data: { sparkNotificationId: 'old-warm' } },
        },
      },
      actionIdentifier: 'default',
    };
    const newerResponse = {
      notification: {
        request: {
          identifier: 'spark:new-warm',
          content: { data: { sparkNotificationId: 'new-warm' } },
        },
      },
      actionIdentifier: 'default',
    };
    const onOpen = jest.fn((id: string) => (
      id === 'old-warm'
        ? new Promise<void>((resolve) => { releaseOld = resolve; })
        : Promise.reject(new Error('new route unavailable'))
    ));

    const unsubscribe = await subscribeAndroidNotificationResponses(onOpen);
    mockLastResponse = oldResponse;
    mockResponseListener?.(oldResponse);
    await flushAsyncCallbacks();
    mockLastResponse = newerResponse;
    mockResponseListener?.(newerResponse);
    await flushAsyncCallbacks();
    releaseOld?.();
    await flushAsyncCallbacks();

    expect(mockClearLastResponse).not.toHaveBeenCalled();
    expect(mockLastResponse).toBe(newerResponse);
    unsubscribe();
  });
});
