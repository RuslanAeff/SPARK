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
import { loadFeed, saveFeed, loadMutes, saveMutes, loadRulesState, saveRulesState } from '../notifications/storage';
import { useRefresh } from './RefreshContext';

interface NotificationsContextValue {
  feed: InAppNotification[];
  unreadCount: number;
  syncing: boolean;
  sync: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  dismiss: (id: string) => Promise<void>;
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

  const loadMutesState = useCallback(async () => {
    setMutes(await loadMutes());
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      const m = await loadMutes();
      setMutes(m);
      const { feed: next, unreadCount: uc } = await runNotificationSync(m);
      setFeed(next);
      setUnreadCount(uc);
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    loadMutesState();
  }, [loadMutesState]);

  // P5: Debounce — ardışık triggerRefresh() çağrılarında fazladan sorgu engellenir
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      sync();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [refreshKey, sync]);

  const markRead = useCallback(async (id: string) => {
    const cur = await loadFeed();
    const next = cur.map((f) => (f.id === id ? { ...f, read: true } : f));
    setFeed(next);
    await saveFeed(next);
    setUnreadCount(next.filter((f) => !f.read).length);
  }, []);

  const markAllRead = useCallback(async () => {
    const cur = await loadFeed();
    const next = cur.map((f) => ({ ...f, read: true }));
    setFeed(next);
    await saveFeed(next);
    setUnreadCount(0);
  }, []);

  const dismiss = useCallback(async (id: string) => {
    const cur = await loadFeed();
    let next = cur.filter((f) => f.id !== id);
    const rules = await loadRulesState();
    if (id === 'sys-no-api-key') rules.apiDismissed = true;
    if (id === 'sys-scan-err') rules.scanErrorDismissed = true;
    await saveRulesState(rules);
    setFeed(next);
    await saveFeed(next);
    setUnreadCount(next.filter((f) => !f.read).length);
  }, []);

  const setMute = useCallback(async (channel: NotificationMuteChannel, muted: boolean) => {
    const m = { ...mutes, [channel]: muted };
    setMutes(m);
    await saveMutes(m);
    await sync();
  }, [mutes, sync]);

  const value = useMemo(
    () => ({
      feed,
      unreadCount,
      syncing,
      sync,
      markRead,
      markAllRead,
      dismiss,
      setMute,
      mutes,
    }),
    [feed, unreadCount, syncing, sync, markRead, markAllRead, dismiss, setMute, mutes]
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
