import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import type { InAppNotification, NotificationMuteChannel } from '../notifications/types';
import { runNotificationSync } from '../notifications/buildNotifications';
import {
  dismissFeedItems,
  enqueueNotificationMutation,
  loadFeedStrict,
  saveFeed,
  loadMutesStrict,
  saveMutes,
  type DismissNotificationsResult,
} from '../notifications/storage';
import { useRefresh } from './RefreshContext';

interface NotificationsContextValue {
  feed: InAppNotification[];
  unreadCount: number;
  syncing: boolean;
  sync: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  dismiss: (id: string) => Promise<DismissNotificationsResult>;
  dismissMany: (ids: readonly string[]) => Promise<DismissNotificationsResult>;
  setMute: (channel: NotificationMuteChannel, muted: boolean) => Promise<void>;
  mutes: Partial<Record<NotificationMuteChannel, boolean>>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { refreshKey } = useRefresh();
  const [feed, setFeed] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [mutes, setMutes] = useState<Partial<Record<NotificationMuteChannel, boolean>>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSyncCountRef = useRef(0);

  const loadMutesState = useCallback(async () => {
    try {
      await enqueueNotificationMutation(async () => {
        setMutes(await loadMutesStrict());
      });
    } catch (error) {
      console.warn('[notifications] initial mutes load failed', error);
    }
  }, []);

  const sync = useCallback(async () => {
    pendingSyncCountRef.current += 1;
    setSyncing(true);
    try {
      await enqueueNotificationMutation(async () => {
        const m = await loadMutesStrict();
        setMutes(m);
        const { feed: next, unreadCount: uc } = await runNotificationSync(m);
        setFeed(next);
        setUnreadCount(uc);
      });
    } catch (error) {
      console.warn('[notifications] sync failed', error);
    } finally {
      pendingSyncCountRef.current = Math.max(0, pendingSyncCountRef.current - 1);
      if (pendingSyncCountRef.current === 0) setSyncing(false);
    }
  }, []);

  useEffect(() => {
    loadMutesState();
  }, [loadMutesState]);

  // P5: Debounce — ardışık triggerRefresh() çağrılarında fazladan sorgu engellenir
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void sync();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [refreshKey, sync]);

  const markRead = useCallback(async (id: string) => {
    await enqueueNotificationMutation(async () => {
      const cur = await loadFeedStrict();
      const next = cur.map((f) => (f.id === id ? { ...f, read: true } : f));
      await saveFeed(next);
      setFeed(next);
      setUnreadCount(next.filter((f) => !f.read).length);
    });
  }, []);

  const markAllRead = useCallback(async () => {
    await enqueueNotificationMutation(async () => {
      const cur = await loadFeedStrict();
      const next = cur.map((f) => ({ ...f, read: true }));
      await saveFeed(next);
      setFeed(next);
      setUnreadCount(0);
    });
  }, []);

  const dismissMany = useCallback(async (ids: readonly string[]) => {
    return enqueueNotificationMutation(async () => {
      const result = await dismissFeedItems(ids);
      setFeed(result.feed);
      setUnreadCount(result.unreadCount);
      return result;
    });
  }, []);

  const dismiss = useCallback(
    async (id: string) => dismissMany([id]),
    [dismissMany],
  );

  const setMute = useCallback(async (channel: NotificationMuteChannel, muted: boolean) => {
    await enqueueNotificationMutation(async () => {
      const current = await loadMutesStrict();
      const next = { ...current, [channel]: muted };
      await saveMutes(next);
      setMutes(next);
    });
    await sync();
  }, [sync]);

  const value = useMemo(
    () => ({
      feed,
      unreadCount,
      syncing,
      sync,
      markRead,
      markAllRead,
      dismiss,
      dismissMany,
      setMute,
      mutes,
    }),
    [feed, unreadCount, syncing, sync, markRead, markAllRead, dismiss, dismissMany, setMute, mutes]
  );

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }
  return ctx;
}
