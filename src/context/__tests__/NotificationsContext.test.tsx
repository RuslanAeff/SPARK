import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';

import {
  NotificationsProvider,
  useNotifications,
} from '../NotificationsContext';
import type { NotificationMuteChannel } from '../../notifications/types';

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
  async (_mutes?: Partial<Record<NotificationMuteChannel, boolean>>) => ({
    feed: [],
    unreadCount: 0,
  }),
);

jest.mock('../RefreshContext', () => ({
  useRefresh: () => ({ refreshKey: 0 }),
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
  dismissFeedItems: jest.fn(async () => ({
    removedIds: [],
    removedCount: 0,
    feed: [],
    unreadCount: 0,
  })),
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

    view.unmount();
  });
});
