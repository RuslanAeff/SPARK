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
  saveAndroidDeliveryState,
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
});
