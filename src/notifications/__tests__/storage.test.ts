import type { InAppNotification } from '../types';

const settings = new Map<string, string>();
const transactionWrites: Array<{ key: string; value: string }> = [];
let failReadKey: string | null = null;
let failWriteKey: string | null = null;
let webTransactionSettings: Map<string, string> | null = null;

const readSetting = jest.fn(async (_sql: string, args?: unknown[]) => {
  const key = String(args?.[0] ?? '');
  if (key === failReadKey) throw new Error(`read failed: ${key}`);
  const value = (webTransactionSettings ?? settings).get(key);
  return value === undefined ? null : { value };
});

const writeSetting = jest.fn(async (_sql: string, args?: unknown[]) => {
  const key = String(args?.[0] ?? '');
  const value = String(args?.[1] ?? '');
  transactionWrites.push({ key, value });
  if (key === failWriteKey) throw new Error(`write failed: ${key}`);
  (webTransactionSettings ?? settings).set(key, value);
  return { changes: 1, lastInsertRowId: 0 };
});

const mockDatabase = {
  getFirstAsync: readSetting,
  runAsync: writeSetting,
  withExclusiveTransactionAsync: jest.fn(
    async (
      task: (transaction: {
        getFirstAsync: typeof readSetting;
        runAsync: typeof writeSetting;
      }) => Promise<void>,
    ) => {
      const staged = new Map(settings);
      const transactionRead = jest.fn(async (_sql: string, args?: unknown[]) => {
        const key = String(args?.[0] ?? '');
        if (key === failReadKey) throw new Error(`read failed: ${key}`);
        const value = staged.get(key);
        return value === undefined ? null : { value };
      });
      const transactionWrite = jest.fn(async (_sql: string, args?: unknown[]) => {
        const key = String(args?.[0] ?? '');
        const value = String(args?.[1] ?? '');
        transactionWrites.push({ key, value });
        if (key === failWriteKey) throw new Error(`write failed: ${key}`);
        staged.set(key, value);
        return { changes: 1, lastInsertRowId: 0 };
      });

      await task({
        getFirstAsync: transactionRead as typeof readSetting,
        runAsync: transactionWrite as typeof writeSetting,
      });
      settings.clear();
      for (const [key, value] of staged) settings.set(key, value);
    },
  ),
  withTransactionAsync: jest.fn(async (task: () => Promise<void>) => {
    const staged = new Map(settings);
    webTransactionSettings = staged;
    try {
      await task();
      settings.clear();
      for (const [key, value] of staged) settings.set(key, value);
    } finally {
      webTransactionSettings = null;
    }
  }),
};

jest.mock('../../db/database', () => ({
  getDatabase: jest.fn(async () => mockDatabase),
}));

import {
  dismissFeedItems,
  enqueueNotificationMutation,
  loadAndroidDeliveryStateStrict,
  loadAndroidReminderScheduleStateStrict,
  saveAndroidDeliveryState,
  saveAndroidReminderScheduleSnapshot,
  saveNotificationSnapshot,
} from '../storage';

const makeNotification = (
  id: string,
  read: boolean,
  createdAt: number,
): InAppNotification => ({
  id,
  read,
  createdAt,
  severity: 'info',
  titleKey: `${id}-title`,
  bodyKey: `${id}-body`,
});

describe('notification storage mutations', () => {
  beforeEach(() => {
    settings.clear();
    transactionWrites.length = 0;
    failReadKey = null;
    failWriteKey = null;
    webTransactionSettings = null;
    jest.clearAllMocks();
  });

  it('removes unique existing IDs with one atomic feed write', async () => {
    const initial = [
      makeNotification('one', false, 3),
      makeNotification('two', true, 2),
      makeNotification('three', false, 1),
    ];
    settings.set('notif_feed_v1', JSON.stringify(initial));
    settings.set('notif_rules_state_v1', JSON.stringify({}));

    const result = await dismissFeedItems(['one', 'one', 'missing', 'three']);

    expect(result.removedIds).toEqual(['one', 'three']);
    expect(result.removedCount).toBe(2);
    expect(result.feed.map((item) => item.id)).toEqual(['two']);
    expect(result.unreadCount).toBe(0);
    expect(mockDatabase.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(
      transactionWrites.filter(({ key }) => key === 'notif_feed_v1'),
    ).toHaveLength(1);
    expect(JSON.parse(settings.get('notif_feed_v1') ?? '[]')).toEqual([initial[1]]);
  });

  it('commits permanent system-dismissal flags with the feed', async () => {
    const initial = [
      makeNotification('sys-no-api-key', false, 3),
      makeNotification('sys-scan-err', false, 2),
      makeNotification('kept', true, 1),
    ];
    settings.set('notif_feed_v1', JSON.stringify(initial));
    settings.set(
      'notif_rules_state_v1',
      JSON.stringify({ apiDismissed: false, scanErrorDismissed: false }),
    );

    const result = await dismissFeedItems([
      'sys-no-api-key',
      'sys-scan-err',
      'not-present',
    ]);

    expect(result.feed.map((item) => item.id)).toEqual(['kept']);
    expect(JSON.parse(settings.get('notif_rules_state_v1') ?? '{}')).toMatchObject({
      apiDismissed: true,
      scanErrorDismissed: true,
    });
    expect(transactionWrites.map(({ key }) => key)).toEqual([
      'notif_feed_v1',
      'notif_rules_state_v1',
    ]);
  });

  it('records an explicit reminder dismissal atomically with the feed removal', async () => {
    const debtId = 'debt-due-v1-7-2026-08-14-3-0900-upcoming';
    const planId =
      'payplan-due-v1-123e4567-e89b-42d3-a456-426614174000-2026-08-14-3-0900-upcoming';
    settings.set('notif_feed_v1', JSON.stringify([
      makeNotification(debtId, false, 2),
      makeNotification(planId, false, 1),
    ]));
    settings.set(
      'notif_rules_state_v1',
      JSON.stringify({
        debtDueLast: { '7': '2026-08-14:3:09:00:upcoming' },
        paymentPlanDueLast: {
          '123e4567-e89b-42d3-a456-426614174000': '2026-08-14:3:09:00:upcoming',
        },
      }),
    );

    await dismissFeedItems([debtId, planId]);

    expect(JSON.parse(settings.get('notif_feed_v1') ?? '[]')).toEqual([]);
    expect(JSON.parse(settings.get('notif_rules_state_v1') ?? '{}')).toMatchObject({
      debtDueDismissed: { '7': '2026-08-14:3:09:00:upcoming' },
      paymentPlanDueDismissed: {
        '123e4567-e89b-42d3-a456-426614174000': '2026-08-14:3:09:00:upcoming',
      },
    });
    expect(transactionWrites.map(({ key }) => key)).toEqual([
      'notif_feed_v1',
      'notif_rules_state_v1',
    ]);
  });

  it('rolls back the feed when the companion rules write fails', async () => {
    const initialFeed = [makeNotification('kept', false, 1)];
    const initialRules = { apiDismissed: false };
    settings.set('notif_feed_v1', JSON.stringify(initialFeed));
    settings.set('notif_rules_state_v1', JSON.stringify(initialRules));
    failWriteKey = 'notif_rules_state_v1';

    await expect(
      saveNotificationSnapshot([], { apiDismissed: true }),
    ).rejects.toThrow('write failed: notif_rules_state_v1');

    expect(JSON.parse(settings.get('notif_feed_v1') ?? '[]')).toEqual(initialFeed);
    expect(JSON.parse(settings.get('notif_rules_state_v1') ?? '{}')).toEqual(initialRules);
    expect(transactionWrites.map(({ key }) => key)).toEqual([
      'notif_feed_v1',
      'notif_rules_state_v1',
    ]);
  });

  it('does not write when a strict dismissal read fails', async () => {
    settings.set(
      'notif_feed_v1',
      JSON.stringify([makeNotification('one', false, 1)]),
    );
    failReadKey = 'notif_feed_v1';

    await expect(dismissFeedItems(['one'])).rejects.toThrow(
      'read failed: notif_feed_v1',
    );

    expect(transactionWrites).toHaveLength(0);
    expect(JSON.parse(settings.get('notif_feed_v1') ?? '[]')).toHaveLength(1);
  });

  it('serializes mutations and keeps the queue usable after a failure', async () => {
    const order: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = enqueueNotificationMutation(async () => {
      order.push('first:start');
      await gate;
      order.push('first:end');
    });
    const second = enqueueNotificationMutation(async () => {
      order.push('second');
      throw new Error('expected test failure');
    });
    const third = enqueueNotificationMutation(async () => {
      order.push('third');
    });

    await Promise.resolve();
    expect(order).toEqual(['first:start']);
    releaseFirst?.();

    await first;
    await expect(second).rejects.toThrow('expected test failure');
    await third;
    expect(order).toEqual(['first:start', 'first:end', 'second', 'third']);
  });

  it('round-trips the Android delivery ledger without storing notification content', async () => {
    await saveAndroidDeliveryState({
      version: 1,
      initializedAt: 100,
      records: {
        receipt: { handledAt: 120, nativeIdentifier: 'spark:receipt' },
        baseline: { handledAt: 110 },
      },
    });

    await expect(loadAndroidDeliveryStateStrict()).resolves.toEqual({
      version: 1,
      initializedAt: 100,
      records: {
        receipt: { handledAt: 120, nativeIdentifier: 'spark:receipt' },
        baseline: { handledAt: 110 },
      },
    });
    expect(settings.get('notif_android_delivery_v1')).not.toContain('title');
    expect(settings.get('notif_android_delivery_v1')).not.toContain('body');
  });

  it('fails closed for an invalid Android delivery ledger', async () => {
    settings.set(
      'notif_android_delivery_v1',
      JSON.stringify({ version: 99, initializedAt: 1, records: {} }),
    );

    await expect(loadAndroidDeliveryStateStrict()).rejects.toThrow(
      'Android notification delivery state is invalid',
    );
  });

  it('atomically stores a strict PII-free future schedule ledger and delivery baseline', async () => {
    await saveAndroidReminderScheduleSnapshot({
      version: 1,
      updatedAt: 1_800_000_000_000,
      records: {
        'debt:7:2027-01-01:3:0900:upcoming': {
          nativeIdentifier: 'spark:future:v1:debt:7:2027-01-01:3:0900:upcoming',
          notificationId: 'debt-due-v1-7-2027-01-01-3-0900-upcoming',
          revision: 'presentation-revision-1',
          triggerAt: 1_800_086_400_000,
          scheduledAt: 1_800_000_000_000,
        },
      },
    }, [{
      notificationId: 'debt-due-v1-7-2027-01-01-3-0900-upcoming',
      nativeIdentifier: 'spark:future:v1:debt:7:2027-01-01:3:0900:upcoming',
      handledAt: 1_800_000_000_000,
    }]);

    await expect(loadAndroidReminderScheduleStateStrict()).resolves.toEqual({
      version: 1,
      updatedAt: 1_800_000_000_000,
      records: {
        'debt:7:2027-01-01:3:0900:upcoming': {
          nativeIdentifier: 'spark:future:v1:debt:7:2027-01-01:3:0900:upcoming',
          notificationId: 'debt-due-v1-7-2027-01-01-3-0900-upcoming',
          revision: 'presentation-revision-1',
          triggerAt: 1_800_086_400_000,
          scheduledAt: 1_800_000_000_000,
        },
      },
    });
    await expect(loadAndroidDeliveryStateStrict()).resolves.toMatchObject({
      records: {
        'debt-due-v1-7-2027-01-01-3-0900-upcoming': {
          nativeIdentifier: 'spark:future:v1:debt:7:2027-01-01:3:0900:upcoming',
        },
      },
    });
    expect(transactionWrites.map(({ key }) => key)).toEqual([
      'notif_android_reminder_schedule_v1',
      'notif_android_delivery_v1',
    ]);
    const snapshot = settings.get('notif_android_reminder_schedule_v1') ?? '';
    expect(snapshot).not.toContain('LandLord');
    expect(snapshot).not.toContain('title');
    expect(snapshot).not.toContain('body');
    expect(snapshot).not.toContain('amount');
  });

  it('preserves 512 live schedules separately from the newest 512 cleanup handles', async () => {
    const now = 1_800_000_000_000;
    const live = Array.from({ length: 512 }, (_, index) => {
      const scheduleId = `debt:live-${index + 1}:2027-01-01:0:0900:today`;
      return [scheduleId, {
        nativeIdentifier: `spark:future:v1:${scheduleId}`,
        notificationId: `debt-due-v1-live-${index + 1}-2027-01-01-0-0900-today`,
        revision: `live-native-${index + 1}`,
        feedRevision: `live-feed-${index + 1}`,
        triggerAt: now + index + 1,
        scheduledAt: now - 1_000,
      }];
    });
    const fired = Array.from({ length: 600 }, (_, index) => {
      const scheduleId = `debt:fired-${index + 1}:2026-01-01:0:0900:today`;
      return [scheduleId, {
        nativeIdentifier: `spark:future:v1:${scheduleId}`,
        notificationId: `debt-due-v1-fired-${index + 1}-2026-01-01-0-0900-today`,
        revision: `fired-native-${index + 1}`,
        feedRevision: `fired-feed-${index + 1}`,
        triggerAt: now - index - 1,
        scheduledAt: now - 10_000,
      }];
    });
    const records = Object.fromEntries([...live, ...fired]);

    await saveAndroidReminderScheduleSnapshot({
      version: 1,
      updatedAt: now,
      records,
    }, []);

    const stored = await loadAndroidReminderScheduleStateStrict();
    expect(Object.keys(stored?.records ?? {})).toHaveLength(1024);
    expect(stored?.records['debt:live-512:2027-01-01:0:0900:today']).toMatchObject({
      feedRevision: 'live-feed-512',
    });
    expect(stored?.records['debt:fired-512:2026-01-01:0:0900:today']).toBeDefined();
    expect(stored?.records['debt:fired-513:2026-01-01:0:0900:today']).toBeUndefined();
  });

  it('prunes canceled future delivery baselines while retaining live ones', async () => {
    settings.set('notif_android_delivery_v1', JSON.stringify({
      version: 1,
      initializedAt: 10,
      records: {
        canceled: {
          handledAt: 11,
          nativeIdentifier: 'spark:future:v1:canceled',
        },
        retained: {
          handledAt: 12,
          nativeIdentifier: 'spark:future:v1:retained',
        },
        immediate: {
          handledAt: 13,
          nativeIdentifier: 'spark:immediate:v1:receipt',
        },
      },
    }));

    await saveAndroidReminderScheduleSnapshot({
      version: 1,
      updatedAt: 20,
      records: {
        retained: {
          nativeIdentifier: 'spark:future:v1:retained',
          notificationId: 'retained',
          revision: 'r1',
          triggerAt: 30,
          scheduledAt: 10,
        },
      },
    }, []);

    await expect(loadAndroidDeliveryStateStrict()).resolves.toMatchObject({
      records: {
        retained: expect.objectContaining({ nativeIdentifier: 'spark:future:v1:retained' }),
        immediate: expect.objectContaining({ nativeIdentifier: 'spark:immediate:v1:receipt' }),
      },
    });
    expect((await loadAndroidDeliveryStateStrict())?.records.canceled).toBeUndefined();
  });

  it('fails closed for a malformed future schedule ledger and drops invalid records', async () => {
    settings.set(
      'notif_android_reminder_schedule_v1',
      JSON.stringify({ version: 9, updatedAt: 1, records: {} }),
    );
    await expect(loadAndroidReminderScheduleStateStrict()).rejects.toThrow(
      'Android reminder schedule state is invalid',
    );

    settings.set(
      'notif_android_reminder_schedule_v1',
      JSON.stringify({
        version: 1,
        updatedAt: 2,
        records: {
          unsafe: {
            nativeIdentifier: 'foreign:request',
            notificationId: 'valid-looking-id',
            revision: 'r1',
            triggerAt: 3,
            scheduledAt: 2,
          },
        },
      }),
    );
    await expect(loadAndroidReminderScheduleStateStrict()).resolves.toEqual({
      version: 1,
      updatedAt: 2,
      records: {},
    });
  });

  it('rolls back both future-schedule ledgers when the delivery baseline write fails', async () => {
    const initialSchedule = {
      version: 1,
      updatedAt: 10,
      records: {},
    };
    const initialDelivery = {
      version: 1,
      initializedAt: 10,
      records: {},
    };
    settings.set('notif_android_reminder_schedule_v1', JSON.stringify(initialSchedule));
    settings.set('notif_android_delivery_v1', JSON.stringify(initialDelivery));
    failWriteKey = 'notif_android_delivery_v1';

    await expect(saveAndroidReminderScheduleSnapshot({
      version: 1,
      updatedAt: 20,
      records: {
        one: {
          nativeIdentifier: 'spark:future:v1:one',
          notificationId: 'debt-due-v1-one',
          revision: 'r2',
          triggerAt: 30,
          scheduledAt: 20,
        },
      },
    }, [])).rejects.toThrow('write failed: notif_android_delivery_v1');

    expect(JSON.parse(settings.get('notif_android_reminder_schedule_v1') ?? '{}'))
      .toEqual(initialSchedule);
    expect(JSON.parse(settings.get('notif_android_delivery_v1') ?? '{}'))
      .toEqual(initialDelivery);
  });
});
